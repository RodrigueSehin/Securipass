import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { CalendarDays, Clock, ClipboardCheck, Search } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { ButtonLink } from "@/components/ui/button";
import { Alert, EmptyState, PageHeader, StatusBadge } from "@/components/ui/feedback";
import { ProgressRing } from "@/components/learner/progress-ring";
import { formatDate, formatDateTime } from "@/lib/format";
import { formatGrade } from "@/lib/courses/grading";
import { cn, formatDuration } from "@/lib/utils";
import { loadLearnerState, type LearnerState, type LearnerEvaluation } from "@/lib/learner/queries";
import { evaluationState, evaluationStats, type EvalState } from "@/lib/learner/evaluations";
import { learnerErrorMessage } from "@/lib/learner/messages";

export const metadata = { title: "Mes évaluations" };

const TABS = [
  { key: "toutes", label: "Toutes" },
  { key: "a_venir", label: "À venir" },
  { key: "en_cours", label: "En cours" },
  { key: "terminees", label: "Terminées" },
] as const;
type TabKey = (typeof TABS)[number]["key"];

const TAB_CATEGORY = { a_venir: "upcoming", en_cours: "in_progress", terminees: "finished" } as const;

type Item = { ev: LearnerEvaluation; state: EvalState };

/** Note affichée sur l'échelle de la formation (« 12 / 20 »). */
const grade = (ev: LearnerEvaluation, percent: number) => formatGrade(percent, ev.course?.grading_scale ?? 100, ev.course?.grade_rounding ?? "none");

function classify(state: LearnerState): Item[] {
  return state.evaluations.map((ev) => ({
    ev,
    state: evaluationState(ev, state.attempts.filter((a) => a.evaluation_id === ev.id), state.now),
  }));
}

/** Badge et information de résultat, selon l'état réel de l'évaluation. */
function Outcome({ item }: { item: Item }) {
  const { ev, state } = item;
  if (state.category === "in_progress") {
    return (
      <>
        <StatusBadge tone="info">En cours</StatusBadge>
        <p className="mt-2 text-xs text-muted">Tentative ouverte{ev.due_at ? ` · échéance ${formatDateTime(ev.due_at)}` : ""}</p>
      </>
    );
  }
  if (state.category === "finished") {
    if (state.graded && ev.course?.show_results === false) {
      return (
        <>
          <StatusBadge>Terminée</StatusBadge>
          <p className="mt-2 text-xs text-muted">Les résultats ne sont pas communiqués pour cette formation.</p>
        </>
      );
    }
    if (state.graded) {
      return (
        <>
          <StatusBadge tone={state.passed ? "success" : "danger"}>{state.passed ? "Réussie" : "Non réussie"}</StatusBadge>
          <p className="mt-2 text-xs text-muted">Meilleur score</p>
          <p className={cn("text-xl font-extrabold", state.passed ? "text-success" : "text-danger")}>{state.bestScore === null ? "—" : grade(ev, state.bestScore)}</p>
        </>
      );
    }
    return <StatusBadge>Échue</StatusBadge>;
  }
  if (ev.kind !== "quiz") {
    return (
      <>
        <StatusBadge tone="warning">En attente de notation</StatusBadge>
        <p className="mt-2 text-xs text-muted">Notée par le formateur</p>
      </>
    );
  }
  if (state.openNow) {
    return (
      <>
        <StatusBadge tone="warning">À faire</StatusBadge>
        {ev.due_at && <p className="mt-2 text-xs text-muted">Échéance le {formatDateTime(ev.due_at)}</p>}
      </>
    );
  }
  return (
    <>
      <StatusBadge tone="warning">À venir</StatusBadge>
      {ev.available_at && <p className="mt-2 text-xs text-muted">Disponible le {formatDateTime(ev.available_at)}</p>}
    </>
  );
}

function Row({ item }: { item: Item }) {
  const { ev, state } = item;
  return (
    <li className="flex flex-col gap-4 p-5 md:flex-row md:items-center">
      <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-brand-soft text-brand" aria-hidden>
        <ClipboardCheck className="h-6 w-6" />
      </span>
      <div className="min-w-0 flex-1">
        <h2 className="font-bold text-brand-dark">{ev.title}</h2>
        <p className="text-sm text-muted">{ev.course?.title ?? "Formation"}</p>
        <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
          {ev.kind === "quiz" ? (
            <>
              <span className="flex items-center gap-1"><Clock className="h-3.5 w-3.5" aria-hidden />{ev.time_limit_minutes ? formatDuration(ev.time_limit_minutes) : "Durée libre"}</span>
              <span>Tentative : {state.submitted} / {ev.max_attempts}</span>
            </>
          ) : <span>{ev.kind === "assignment" ? "Devoir" : ev.kind === "case_study" ? "Étude de cas" : "Évaluation pratique"} noté par le formateur</span>}
          {ev.weight_percent > 0 && <span>Pondération : {ev.weight_percent} %</span>}
          <span>Note minimale : {grade(ev, ev.passing_score)}</span>
        </p>
      </div>
      <div className="md:w-44 md:shrink-0">
        <Outcome item={item} />
      </div>
      <div className="flex flex-wrap gap-2 md:shrink-0">
        {state.category === "in_progress" && <ButtonLink href={`/app/evaluations/${ev.id}`} variant="cta">Continuer</ButtonLink>}
        <ButtonLink href={`/app/evaluations/${ev.id}`} variant={state.category === "in_progress" ? "outline" : "primary"}>
          {ev.kind === "quiz" && state.category === "upcoming" && state.openNow ? "Commencer" : "Voir les détails"}
        </ButtonLink>
      </div>
    </li>
  );
}

function Aside({ items }: { items: Item[] }) {
  const stats = evaluationStats(items);
  const byCourse = new Map<string, { title: string; scores: number[] }>();
  for (const { ev, state: s } of items) {
    if (s.bestScore === null) continue;
    const entry = byCourse.get(ev.course_id) ?? { title: ev.course?.title ?? "Formation", scores: [] };
    entry.scores.push(s.bestScore);
    byCourse.set(ev.course_id, entry);
  }
  const upcoming = items
    .filter(({ state: s, ev }) => s.category !== "finished" && (ev.due_at || ev.available_at))
    .sort((a, b) => new Date(a.ev.due_at ?? a.ev.available_at!).getTime() - new Date(b.ev.due_at ?? b.ev.available_at!).getTime())
    .slice(0, 3);

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-line bg-white p-5">
        <h2 className="mb-2 font-bold text-brand-dark">Mes résultats globaux</h2>
        <ProgressRing percent={stats.successRate} label="Taux de réussite" />
        <ul className="mt-4 space-y-2 text-sm">
          <li className="flex justify-between"><span className="text-brand-dark">Évaluations réussies</span><span className="font-bold text-success">{stats.passed}</span></li>
          <li className="flex justify-between"><span className="text-brand-dark">En cours</span><span className="font-bold text-brand">{stats.inProgress}</span></li>
          <li className="flex justify-between"><span className="text-brand-dark">À venir</span><span className="font-bold text-cta">{stats.upcoming}</span></li>
          <li className="flex justify-between"><span className="text-brand-dark">Non réussies</span><span className="font-bold text-danger">{stats.failed}</span></li>
        </ul>
      </section>

      {byCourse.size > 0 && (
        <section className="rounded-2xl border border-line bg-white p-5">
          <h2 className="mb-3 font-bold text-brand-dark">Mes notes par formation</h2>
          <ul className="space-y-4">
            {[...byCourse.values()].map((c) => {
              const avg = Math.round(c.scores.reduce((a, b) => a + b, 0) / c.scores.length);
              return (
                <li key={c.title}>
                  <div className="flex justify-between text-sm"><span className="font-medium text-brand-dark">{c.title}</span><span className="font-bold text-brand-dark">{avg} %</span></div>
                  <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-surface" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={avg} aria-label={`Moyenne de ${c.title}`}>
                    <div className={cn("h-full rounded-full", avg >= 50 ? "bg-success" : "bg-danger")} style={{ width: `${avg}%` }} />
                  </div>
                </li>
              );
            })}
          </ul>
          <p className="mt-3 text-xs text-muted">Moyenne des meilleurs scores de chaque évaluation.</p>
        </section>
      )}

      <section className="rounded-2xl border border-line bg-white p-5">
        <h2 className="mb-3 font-bold text-brand-dark">Prochaines évaluations</h2>
        {upcoming.length === 0 ? (
          <p className="text-sm text-muted">Aucune évaluation planifiée.</p>
        ) : (
          <ul className="space-y-4">
            {upcoming.map(({ ev }) => {
              const iso = ev.due_at ?? ev.available_at!;
              const day = new Date(iso).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", timeZone: "Africa/Abidjan" });
              return (
                <li key={ev.id}>
                  <Link href={`/app/evaluations/${ev.id}`} className="flex gap-3 hover:underline">
                    <span className="flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-xl bg-brand-soft text-center text-xs font-bold text-brand-dark">{day}</span>
                    <span className="min-w-0">
                      <span className="block truncate font-semibold text-brand-dark">{ev.title}</span>
                      <span className="flex items-center gap-1 text-xs text-muted"><CalendarDays className="h-3.5 w-3.5" aria-hidden />{ev.due_at ? `Échéance ${formatDate(ev.due_at)}` : `Disponible le ${formatDate(ev.available_at!)}`}</span>
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}

async function Page({ searchParams }: { searchParams: Promise<{ statut?: string; q?: string; erreur?: string }> }) {
  const { statut, q, erreur } = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/connexion?redirect=/app/evaluations");

  const state = await loadLearnerState(supabase, user.id);
  const all = classify(state);
  const tab: TabKey = TABS.some((t) => t.key === statut) ? (statut as TabKey) : "toutes";
  const search = (q ?? "").trim().toLowerCase().slice(0, 80);
  const matches = (i: Item) => !search || `${i.ev.title} ${i.ev.course?.title ?? ""}`.toLowerCase().includes(search);
  const shown = all
    .filter((i) => tab === "toutes" || i.state.category === TAB_CATEGORY[tab])
    .filter(matches);
  const count = (key: TabKey) => (key === "toutes" ? all : all.filter((i) => i.state.category === TAB_CATEGORY[key as keyof typeof TAB_CATEGORY])).length;

  return (
    <>
      <PageHeader title="Mes évaluations" description="Consultez vos quiz et examens. Suivez vos résultats et identifiez les prochaines évaluations." />
      {erreur && <div className="mb-4"><Alert>{learnerErrorMessage(erreur)}</Alert></div>}

      <div className="grid gap-6 xl:grid-cols-[1fr_20rem]">
        <div className="min-w-0 space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            {TABS.map((t) => (
              <Link
                key={t.key}
                href={t.key === "toutes" ? "/app/evaluations" : `/app/evaluations?statut=${t.key}`}
                aria-current={t.key === tab ? "page" : undefined}
                className={cn("rounded-lg border px-4 py-2 text-sm font-semibold",
                  t.key === tab ? "border-brand bg-brand-dark text-white" : "border-line bg-white text-brand-dark hover:border-brand")}
              >
                {t.label} ({count(t.key)})
              </Link>
            ))}
          </div>

          <form role="search" action="/app/evaluations" className="relative max-w-md">
            {tab !== "toutes" && <input type="hidden" name="statut" value={tab} />}
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-brand" aria-hidden />
            <input name="q" type="search" defaultValue={q ?? ""} placeholder="Rechercher une évaluation…" aria-label="Rechercher une évaluation"
              className="w-full rounded-xl border border-line bg-white py-2.5 pl-9 pr-3 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20" />
          </form>

          {all.length === 0 ? (
            <EmptyState title="Aucune évaluation pour le moment">Les évaluations de vos formations apparaîtront ici lorsqu’elles seront publiées.</EmptyState>
          ) : shown.length === 0 ? (
            <EmptyState title="Aucune évaluation ne correspond" />
          ) : (
            <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-white">
              {shown.map((item) => <Row key={item.ev.id} item={item} />)}
            </ul>
          )}
        </div>

        <Aside items={all} />
      </div>
    </>
  );
}

export default function EvaluationsPage({ searchParams }: { searchParams: Promise<{ statut?: string; q?: string; erreur?: string }> }) {
  return (
    <Suspense fallback={<div className="h-96 animate-pulse rounded-2xl bg-white" aria-hidden />}>
      <Page searchParams={searchParams} />
    </Suspense>
  );
}
