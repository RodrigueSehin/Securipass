import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Search } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { categoryUi } from "@/content/categories";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState, PageHeader } from "@/components/ui/feedback";
import { Competencies, FormationItem, GlobalJourney, Recommended, type FormationRow, type Recommendation } from "@/components/learner/formation-list-parts";
import { summarize } from "@/lib/courses/detail";
import { loadLearnerState } from "@/lib/learner/queries";
import { courseProgress } from "@/lib/learner/progress";
import { LIST_TABS, competencyProgress, countByStatus, isListTab, listStatus, matchesTab, type ListStatus, type ListTab } from "@/lib/learner/formations";
import { formatShortDate } from "@/lib/format";
import { publicImage } from "@/lib/images";
import { cn, formatDuration } from "@/lib/utils";

export const metadata = { title: "Mes formations" };

type SP = Promise<{ statut?: string; q?: string }>;

const hours = (minutes: number) => String(Number((minutes / 60).toFixed(1))).replace(".", ",");
const normalize = (v: string) => v.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase().trim();

function tabHref(tab: ListTab, q: string) {
  const p = new URLSearchParams();
  if (tab !== "toutes") p.set("statut", tab);
  if (q) p.set("q", q);
  const s = p.toString();
  return `/app/formations${s ? `?${s}` : ""}`;
}

async function List({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const tab: ListTab = isListTab(sp.statut) ? sp.statut : "toutes";
  const q = sp.q?.trim().slice(0, 100) ?? "";

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/connexion?redirect=/app/formations");

  const [state, certsRes] = await Promise.all([
    loadLearnerState(supabase, user.id),
    supabase.from("certificates").select("course_id, status").neq("status", "revoked").returns<{ course_id: string; status: string }[]>(),
  ]);
  const now = state.now;
  const certified = new Set((certsRes.data ?? []).map((c) => c.course_id));

  type Entry = { row: FormationRow; progress: ReturnType<typeof courseProgress>; competencies: string[] };
  const entries: Entry[] = state.enrollments.flatMap((e): Entry[] => {
    const course = e.course;
    if (!course) return [];
    const progress = courseProgress(state.contents, state.doneIds, course.id);
    const dates = state.contents.filter((c) => c.course_id === course.id).map((c) => state.completedAt.get(c.id)).filter((d): d is string => Boolean(d));
    const lastActivity = dates.sort().at(-1) ?? null;
    const status = listStatus({ enrollmentStatus: e.status, total: progress.total, done: progress.done, lastActivityAt: lastActivity, now });
    if (!status) return [];
    const ui = categoryUi(course.category?.slug, course.category?.name);
    const dateByStatus: Record<ListStatus, [string, string | null]> = {
      in_progress: ["Date de fin prévue", e.session?.end_at ?? null],
      completed: ["Terminée le", lastActivity],
      waiting: ["Début prévu le", e.session?.start_at ?? null],
      abandoned: ["Dernière activité", lastActivity],
    };
    const [dateLabel, dateIso] = dateByStatus[status];
    return [{
      progress,
      competencies: status === "waiting" ? [] : course.competencies ?? [],
      row: {
        id: course.id, enrollmentId: e.id, title: course.title, summary: summarize(course.description, 140),
        cover: course.cover_url ?? (ui.image ? publicImage(`home/${ui.image}`) : null),
        status, percent: status === "waiting" ? 0 : progress.percent,
        modules: new Set(state.contents.filter((c) => c.course_id === course.id).map((c) => c.module_position)).size,
        doneHours: hours(progress.doneMinutes), totalHours: hours(progress.totalMinutes),
        certifying: Boolean(course.certificate_conditions),
        dateLabel: dateIso ? dateLabel : null, dateValue: dateIso ? formatShortDate(dateIso, e.session?.timezone) : null,
        openHref: `/app/formations/${course.id}`,
        certificateHref: certified.has(course.id) ? "/app/certificats" : null,
        cancellable: ["confirmed", "waitlisted", "pending_payment", "pending_approval"].includes(e.status),
        showProgress: course.show_progress !== false,
      },
    }];
  });

  if (entries.length === 0) {
    return (
      <EmptyState title="Vous n’êtes inscrit à aucune formation pour le moment">
        Parcourez le catalogue pour trouver la formation qui vous convient.
        <div className="mt-4"><ButtonLink href="/formations" variant="cta">Découvrir les formations</ButtonLink></div>
      </EmptyState>
    );
  }

  const counts = countByStatus(entries.map((x) => x.row.status));
  const shown = entries.filter((x) => matchesTab(x.row.status, tab) && (!q || normalize(x.row.title).includes(normalize(q))));

  // Parcours global : formations suivies (hors attente)
  const followed = entries.filter((x) => x.row.status !== "waiting");
  const total = followed.reduce((n, x) => n + x.progress.total, 0);
  const done = followed.reduce((n, x) => n + x.progress.done, 0);
  const percent = total === 0 ? 0 : Math.round((done / total) * 100);
  const doneMinutes = followed.reduce((n, x) => n + x.progress.doneMinutes, 0);
  const totalMinutes = followed.reduce((n, x) => n + x.progress.totalMinutes, 0);
  const competencies = competencyProgress(followed.map((x) => ({ competencies: x.competencies, percent: x.row.percent })));

  // Formations recommandées : formations publiées non suivies, celles des catégories déjà suivies d'abord
  const enrolledIds = new Set(state.enrollments.map((e) => e.course?.id));
  const followedCategories = new Set(state.enrollments.map((e) => e.course?.category?.slug).filter(Boolean));
  const { data: pool } = await supabase
    .from("courses")
    .select("id, title, slug, cover_url, duration_minutes, category:categories(slug, name)")
    .eq("status", "published").order("published_at", { ascending: false }).limit(30)
    .returns<{ id: string; title: string; slug: string; cover_url: string | null; duration_minutes: number; category: { slug: string; name: string } | null }[]>();
  const candidates = (pool ?? []).filter((c) => !enrolledIds.has(c.id));
  const stats = candidates.length
    ? await supabase.rpc("course_rating_stats", { p_courses: candidates.map((c) => c.id) })
    : { data: [] as { course_id: string; average: number; total: number }[] };
  const rating = new Map<string, { average: number; total: number }>(
    (stats.data ?? []).map((s: { course_id: string; average: number | string; total: number }) => [s.course_id, { average: Number(s.average), total: s.total }]),
  );
  const recommended: Recommendation[] = candidates
    .sort((a, b) =>
      Number(followedCategories.has(b.category?.slug)) - Number(followedCategories.has(a.category?.slug))
      || (rating.get(b.id)?.average ?? 0) - (rating.get(a.id)?.average ?? 0))
    .slice(0, 3)
    .map((c) => {
      const ui = categoryUi(c.category?.slug, c.category?.name);
      return {
        id: c.id, title: c.title, slug: c.slug, cover: c.cover_url ?? (ui.image ? publicImage(`home/${ui.image}`) : null),
        durationLabel: formatDuration(c.duration_minutes), rating: rating.get(c.id) ?? null,
      };
    });

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_20rem]">
      <div className="min-w-0">
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <nav aria-label="Filtrer par statut" className="flex flex-1 flex-wrap gap-2">
            {LIST_TABS.map((t) => (
              <Link key={t.key} href={tabHref(t.key, q)} aria-current={t.key === tab ? "page" : undefined}
                className={cn("rounded-lg border px-4 py-2 text-sm font-semibold",
                  t.key === tab ? "border-brand-dark bg-brand-dark text-white" : "border-line bg-white text-brand-dark hover:border-brand")}>
                {t.label} ({counts[t.key]})
              </Link>
            ))}
          </nav>
          <form role="search" className="flex gap-2">
            {tab !== "toutes" && <input type="hidden" name="statut" value={tab} />}
            <div className="relative">
              <Search className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden />
              <input name="q" type="search" defaultValue={q} placeholder="Rechercher dans mes formations…" aria-label="Rechercher dans mes formations"
                className="w-56 rounded-lg border border-line bg-white py-2 pl-3 pr-9 text-sm" />
            </div>
            <button className="rounded-lg border border-line bg-white px-4 py-2 text-sm font-semibold text-brand-dark hover:border-brand">Filtrer</button>
          </form>
        </div>

        {shown.length === 0 ? (
          <EmptyState title="Aucune formation ne correspond">
            <Link href="/app/formations" className="font-semibold text-brand hover:underline">Réinitialiser les filtres</Link>
          </EmptyState>
        ) : (
          <ul className="rounded-2xl border border-line bg-white shadow-card">
            {shown.map((x) => <FormationItem key={x.row.enrollmentId} row={x.row} />)}
          </ul>
        )}
      </div>

      <aside className="space-y-6">
        <GlobalJourney
          percent={percent} doneHours={hours(doneMinutes)} totalHours={hours(totalMinutes)}
          counts={{ running: counts.en_cours, completed: counts.terminees, waiting: counts.en_attente, abandoned: counts.abandonnees }}
        />
        <Competencies items={competencies} />
        <Recommended items={recommended} />
      </aside>
    </div>
  );
}

export default function MyCoursesPage({ searchParams }: { searchParams: SP }) {
  return (
    <>
      <PageHeader title="Mes formations" description="Retrouvez ici toutes vos formations et suivez votre progression." />
      <Suspense fallback={<div className="h-96 animate-pulse rounded-2xl bg-white" aria-hidden />}>
        <List searchParams={searchParams} />
      </Suspense>
    </>
  );
}
