import { Suspense } from "react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Button, ButtonLink } from "@/components/ui/button";
import { Alert, EmptyState, PageHeader, StatusBadge } from "@/components/ui/feedback";
import { formatDateTime } from "@/lib/format";
import { formatGrade } from "@/lib/courses/grading";
import { formatDuration } from "@/lib/utils";
import { loadLearnerState } from "@/lib/learner/queries";
import { evaluationState } from "@/lib/learner/evaluations";
import { evaluationStatus, learnerErrorMessage } from "@/lib/learner/messages";
import { startEvaluation, submitEvaluation } from "@/lib/learner/actions";

export const metadata = { title: "Évaluation" };

const uuid = /^[0-9a-f-]{36}$/i;

type Option = { id: string; label: string };
type Question = { id: string; prompt: string; kind: "single" | "multiple"; options: Option[]; points: number };

const RESULT_BANNERS: Record<string, { tone: "success" | "info"; text: string }> = {
  envoyee: { tone: "success", text: "Vos réponses ont été enregistrées et notées." },
  expiree: { tone: "info", text: "Le délai de la tentative était dépassé : elle a été close sans notation." },
};

async function Evaluation({ id, resultat, erreur }: { id: string; resultat?: string; erreur?: string }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`/connexion?redirect=/app/evaluations/${id}`);

  const state = await loadLearnerState(supabase, user.id);
  const ev = state.evaluations.find((e) => e.id === id);
  if (!ev) {
    return (
      <EmptyState title="Évaluation introuvable">
        Seules les évaluations publiées de vos formations sont accessibles.
        <div className="mt-4"><ButtonLink href="/app/evaluations" variant="outline">Retour à mes évaluations</ButtonLink></div>
      </EmptyState>
    );
  }

  const mine = state.attempts.filter((a) => a.evaluation_id === id);
  const open = mine.find((a) => a.submitted_at === null);
  const submitted = mine.filter((a) => a.submitted_at !== null).length;
  const status = evaluationStatus(mine);
  const expired = ev.due_at !== null && new Date(ev.due_at).getTime() <= state.now;
  const st = evaluationState(ev, mine, state.now);
  const canStart = st.openNow && !open && st.category !== "finished";
  const manual = ev.kind !== "quiz";
  const grade = state.grades.find((g) => g.evaluation_id === id);
  const showResults = ev.course?.show_results !== false;
  const fmt = (percent: number) => formatGrade(percent, ev.course?.grading_scale ?? 100, ev.course?.grade_rounding ?? "none");
  const lastGraded = [...mine].filter((a) => a.submitted_at).sort((a, b) => (b.submitted_at! > a.submitted_at! ? 1 : -1))[0];

  let questions: Question[] = [];
  if (open) {
    const { data } = await supabase
      .from("evaluation_questions")
      .select("id, prompt, kind, options, points")
      .eq("evaluation_id", id)
      .order("position")
      .returns<Question[]>();
    questions = data ?? [];
  }

  const banner = resultat && RESULT_BANNERS[resultat];

  return (
    <>
      <PageHeader
        title={ev.title}
        description={`${ev.course?.title ?? "Formation"} · note minimale ${fmt(ev.passing_score)}${ev.weight_percent > 0 ? ` · pondération ${ev.weight_percent} %` : ""}`}
        actions={<StatusBadge tone={status.tone}>{status.label}</StatusBadge>}
      />

      {banner && <div className="mb-4"><Alert tone={banner.tone}>{banner.text}</Alert></div>}
      {erreur && <div className="mb-4"><Alert>{learnerErrorMessage(erreur)}</Alert></div>}

      <dl className="mb-6 grid gap-3 rounded-2xl border border-line bg-white p-5 text-sm sm:grid-cols-2 lg:grid-cols-4">
        <div><dt className="text-muted">Échéance</dt><dd className="font-semibold text-brand-dark">{ev.due_at ? formatDateTime(ev.due_at) : "Aucune"}</dd></div>
        <div><dt className="text-muted">Durée</dt><dd className="font-semibold text-brand-dark">{ev.time_limit_minutes ? formatDuration(ev.time_limit_minutes) : "Libre"}</dd></div>
        <div><dt className="text-muted">{manual ? "Notation" : "Tentatives"}</dt><dd className="font-semibold text-brand-dark">{manual ? "Par le formateur" : `${submitted} / ${ev.max_attempts}`}</dd></div>
        <div><dt className="text-muted">Dernier résultat</dt><dd className="font-semibold text-brand-dark">{lastGraded?.score_percent != null ? (showResults ? fmt(lastGraded.score_percent) : "Non communiqué") : "—"}</dd></div>
      </dl>

      {ev.instructions && <div className="mb-6 whitespace-pre-line rounded-2xl border border-line bg-white p-5 text-sm text-brand-dark">{ev.instructions}</div>}

      {manual ? (
        <div className="rounded-2xl border border-line bg-white p-5">
          {grade ? (
            showResults ? (
              <>
                <p className="text-sm text-muted">Votre note</p>
                <p className={`text-3xl font-extrabold ${grade.score_percent >= ev.passing_score ? "text-success" : "text-danger"}`}>{fmt(grade.score_percent)}</p>
                {grade.feedback && <p className="mt-3 whitespace-pre-line rounded-lg bg-surface p-3 text-sm text-brand-dark">{grade.feedback}</p>}
              </>
            ) : (
              <p className="text-sm text-muted">Votre travail a été noté. Les résultats ne sont pas communiqués pour cette formation.</p>
            )
          ) : (
            <p className="text-sm text-muted">Cette activité est notée par le formateur : votre note apparaîtra ici dès qu’elle sera saisie, et vous serez notifié.</p>
          )}
        </div>
      ) : open ? (
        <form action={submitEvaluation} className="space-y-4">
          <input type="hidden" name="attemptId" value={open.id} />
          <input type="hidden" name="evaluationId" value={id} />
          {open.deadline_at && (
            <p className="text-sm text-muted">Temps limite pour cette tentative : <span className="font-semibold text-brand-dark">{formatDateTime(open.deadline_at)}</span>. Une tentative envoyée après ce délai n’est pas notée.</p>
          )}
          {questions.length === 0 && <EmptyState title="Aucune question pour le moment" />}
          {questions.map((q, i) => (
            <fieldset key={q.id} className="rounded-2xl border border-line bg-white p-5">
              <legend className="px-1 font-semibold text-brand-dark">
                {i + 1}. {q.prompt} <span className="text-xs font-normal text-muted">({q.kind === "multiple" ? "plusieurs réponses" : "une réponse"})</span>
              </legend>
              <div className="mt-2 space-y-2">
                {q.options.map((o) => (
                  <label key={o.id} className="flex cursor-pointer items-start gap-3 rounded-lg p-2 hover:bg-brand-soft">
                    <input
                      type={q.kind === "multiple" ? "checkbox" : "radio"}
                      name={`q_${q.id}`}
                      value={o.id}
                      className="mt-1 h-4 w-4 accent-[var(--color-brand)]"
                    />
                    <span className="text-sm text-brand-dark">{o.label}</span>
                  </label>
                ))}
              </div>
            </fieldset>
          ))}
          {questions.length > 0 && <Button variant="cta">Envoyer mes réponses</Button>}
        </form>
      ) : canStart ? (
        <div className="rounded-2xl border border-line bg-white p-5">
          <p className="text-sm text-muted">Une fois commencée, la tentative doit être envoyée avant l’échéance.</p>
          <form action={startEvaluation} className="mt-4">
            <input type="hidden" name="evaluationId" value={id} />
            <Button variant="cta">Commencer l’évaluation</Button>
          </form>
        </div>
      ) : (
        <EmptyState title={st.category === "upcoming" && !st.openNow ? "Cette évaluation n’est pas encore ouverte" : expired ? "L’échéance de cette évaluation est dépassée" : "Vous n’avez plus de tentative disponible"}>
          {ev.available_at && st.category === "upcoming" && !st.openNow ? <>Ouverture le {formatDateTime(ev.available_at)}.</> : null}
          Les réponses correctes ne sont pas affichées.
        </EmptyState>
      )}

      <p className="mt-6 text-sm text-muted">
        <Link href="/app/evaluations" className="font-semibold text-brand hover:underline">Retour à mes évaluations</Link>
      </p>
    </>
  );
}

export default function EvaluationPage({ params, searchParams }: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ resultat?: string; erreur?: string }>;
}) {
  return (
    <Suspense fallback={<div className="h-96 animate-pulse rounded-2xl bg-white" aria-hidden />}>
      <Resolved params={params} searchParams={searchParams} />
    </Suspense>
  );
}

async function Resolved({ params, searchParams }: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ resultat?: string; erreur?: string }>;
}) {
  const [{ id }, { resultat, erreur }] = await Promise.all([params, searchParams]);
  if (!uuid.test(id)) notFound();
  return <Evaluation id={id} resultat={resultat} erreur={erreur} />;
}
