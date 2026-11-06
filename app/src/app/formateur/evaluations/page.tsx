import { Suspense } from "react";
import Link from "next/link";
import { CheckCircle2, ChevronDown, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Clock, Eye, MoreVertical, Pencil, Plus, Users, XCircle, type LucideIcon } from "lucide-react";
import { AssessmentForm, PageSizeSelect, RosterFilters, SessionPicker } from "@/components/instructor/assessment-controls";
import { Avatar } from "@/components/ui/avatar";
import { ButtonLink } from "@/components/ui/button";
import { Alert, EmptyState } from "@/components/ui/feedback";
import { paginate } from "@/lib/courses/course-list";
import { formatGrade } from "@/lib/courses/grading";
import { MODES } from "@/lib/courses/labels";
import { formatShortDate, formatTimeRange } from "@/lib/format";
import { ASSESSMENT_SIZES, ASSESSMENT_STATUS, ASSESSMENT_TABS, assessmentCounts, filterRoster, parseAssessmentFilters, percentOf, questionResult, type AssessmentStatus, type AssessmentTab, type RosterRow } from "@/lib/instructor/assessments";
import { loadAssessmentRoster, loadLearnerAssessment, type AssessmentSession, type LearnerAssessment } from "@/lib/instructor/assessments-queries";
import { MEETING_PLATFORMS, type MeetingPlatform } from "@/lib/sessions/timezones";
import { cn } from "@/lib/utils";

export const metadata = { title: "Évaluations" };

type SP = Promise<{ session?: string; apprenant?: string; q?: string; statut?: string; page?: string; par?: string; onglet?: string }>;

const dateTime = (iso: string) => new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Africa/Abidjan" }).format(new Date(iso));
const sessionLabel = (s: AssessmentSession) => s.title;
const sessionWhen = (s: AssessmentSession) => {
  const where = s.mode === "online" ? `En ligne${s.platform && s.platform in MEETING_PLATFORMS ? ` (${MEETING_PLATFORMS[s.platform as MeetingPlatform]})` : ""}` : MODES[s.mode] + (s.location ? ` · ${s.location}` : "");
  return `${formatShortDate(s.startAt)} · ${formatTimeRange(s.startAt, s.endAt)} | ${where}`;
};

const Badge = ({ s }: { s: AssessmentStatus }) => <span className={cn("inline-flex rounded-md px-2.5 py-1 text-xs font-semibold", ASSESSMENT_STATUS[s].tone)}>{ASSESSMENT_STATUS[s].label}</span>;

function Kpi({ icon: Icon, tone, color, value, label, percent }: { icon: LucideIcon; tone: string; color?: string; value: number; label: string; percent?: number }) {
  return (
    <div className="flex items-center gap-4 rounded-2xl border border-line bg-white p-5 shadow-card">
      <span className={cn("flex h-14 w-14 shrink-0 items-center justify-center rounded-xl", tone)}><Icon className="h-7 w-7" aria-hidden /></span>
      <span className="min-w-0 flex-1">
        <span className="block text-3xl font-extrabold leading-none text-brand-dark">{value}</span>
        <span className="mt-1 block text-sm text-muted">{label}</span>
        {percent !== undefined && color && (
          <span className="mt-1 flex items-center gap-2 text-xs font-semibold" style={{ color }}>
            {percent} %
            <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface"><span className="block h-full rounded-full" style={{ width: `${percent}%`, background: color }} /></span>
          </span>
        )}
      </span>
    </div>
  );
}

function QuestionList({ data, scale }: { data: LearnerAssessment; scale: number }) {
  if (data.quizzes.length === 0) return <p className="rounded-xl bg-surface p-4 text-sm text-muted">Aucun quiz avec questions n’est rattaché à cette session. Les activités notées par vos soins apparaissent plus bas.</p>;
  return (
    <div className="space-y-5">
      {data.quizzes.map((quiz) => (
        <div key={quiz.evaluationId}>
          <p className="mb-2 flex flex-wrap items-baseline justify-between gap-2 text-sm font-bold text-brand-dark">
            {quiz.title}
            <span className="text-xs font-normal text-muted">{quiz.submittedAt ? `Rendu le ${dateTime(quiz.submittedAt)}${quiz.scorePercent !== null ? ` · ${formatGrade(quiz.scorePercent, scale)}` : ""}` : "Pas encore rendu"}</span>
          </p>
          <ol className="divide-y divide-line rounded-xl border border-line">
            {quiz.questions.map((q, i) => {
              const r = questionResult(q.points, q.correct, q.chosen ?? undefined);
              return (
                <li key={q.id}>
                  <details className="group">
                    <summary className="flex cursor-pointer list-none items-center gap-3 p-3 [&::-webkit-details-marker]:hidden">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-soft text-sm font-bold text-brand">{i + 1}</span>
                      <span className="min-w-0 flex-1 text-sm text-brand-dark">{q.prompt}<span className="block text-xs text-muted">{q.kind === "multiple" ? "Question à choix multiple" : "Question à choix unique"}</span></span>
                      <span className={cn("text-sm font-bold", q.chosen === null ? "text-muted" : r.right ? "text-success" : "text-danger")}>{q.chosen === null ? "—" : r.earned}/{q.points}</span>
                      <ChevronDown className="h-4 w-4 text-muted transition group-open:rotate-180" aria-hidden />
                    </summary>
                    <ul className="space-y-1 px-4 pb-3 text-sm">
                      {q.options.map((o) => {
                        const picked = q.chosen?.includes(o.id) ?? false;
                        const ok = q.correct.includes(o.id);
                        return (
                          <li key={o.id} className={cn("flex items-center justify-between gap-2 rounded-lg px-3 py-1.5", ok ? "bg-success/10 text-brand-dark" : picked ? "bg-danger/10 text-brand-dark" : "text-brand-dark/80")}>
                            <span>{o.label}</span>
                            <span className="shrink-0 text-xs font-semibold">{picked && "Réponse de l’apprenant"}{picked && ok && " · "}{ok && "Bonne réponse"}</span>
                          </li>
                        );
                      })}
                    </ul>
                  </details>
                </li>
              );
            })}
          </ol>
        </div>
      ))}
    </div>
  );
}

function Panel({ session, learner, data, tab, hrefTab }: { session: AssessmentSession; learner: RosterRow; data: LearnerAssessment; tab: AssessmentTab; hrefTab: (t: AssessmentTab) => string }) {
  return (
    <aside className="space-y-4 rounded-2xl border border-line bg-white p-5 shadow-card">
      <h2 className="text-xl font-extrabold text-brand-dark">Évaluation de l’apprenant</h2>
      <div className="flex items-center gap-3">
        <Avatar name={learner.name} src={learner.avatar} size={64} />
        <div className="min-w-0 flex-1">
          <p className="font-bold text-brand-dark">{learner.name}</p>
          <p className="truncate text-sm text-muted">{learner.email}</p>
        </div>
        <div className="text-right text-xs text-muted">
          <Badge s={learner.status} />
          {learner.scorePercent !== null && <p className="mt-1">Note finale<br /><span className="text-sm font-bold text-brand-dark">{formatGrade(learner.scorePercent, session.scale)}</span></p>}
        </div>
      </div>
      <nav className="flex border-b border-line" aria-label="Sections de l’évaluation">
        {(Object.keys(ASSESSMENT_TABS) as AssessmentTab[]).map((t) => (
          <Link key={t} href={hrefTab(t)} aria-current={t === tab ? "page" : undefined} className={cn("flex-1 border-b-2 px-2 py-2.5 text-center text-sm font-semibold", t === tab ? "border-brand text-brand" : "border-transparent text-muted hover:text-brand")}>{ASSESSMENT_TABS[t]}</Link>
        ))}
      </nav>

      {tab === "evaluation" && (
        <>
          <section className="space-y-3">
            <h3 className="text-sm font-bold text-brand-dark">Questions et réponses <span className="font-normal text-muted">(points obtenus)</span></h3>
            <QuestionList data={data} scale={session.scale} />
            {data.grades.length > 0 && (
              <div>
                <p className="mb-2 text-sm font-bold text-brand-dark">Activités notées par vous</p>
                <ul className="divide-y divide-line rounded-xl border border-line text-sm">
                  {data.grades.map((g) => <li key={g.evaluationId} className="flex items-center justify-between gap-2 p-3 text-brand-dark">{g.title}<span className="font-bold">{formatGrade(g.scorePercent, session.scale)}</span></li>)}
                </ul>
              </div>
            )}
          </section>
          <AssessmentForm key={learner.learnerId} sessionId={session.id} learnerId={learner.learnerId} scale={session.scale} passMark={session.passMark}
            saved={data.saved ? { scorePercent: data.saved.scorePercent, passed: data.saved.passed, comment: data.saved.comment } : null} />
        </>
      )}

      {tab === "commentaires" && (
        <div className="space-y-3 text-sm">
          <div className="rounded-xl bg-surface p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted">Commentaire global</p>
            <p className="mt-1 whitespace-pre-line text-brand-dark">{data.saved?.comment || "Aucun commentaire pour le moment. Ajoutez-en un depuis l’onglet Évaluation."}</p>
          </div>
          {data.grades.filter((g) => g.feedback).map((g) => (
            <div key={g.evaluationId} className="rounded-xl border border-line p-4">
              <p className="text-xs font-semibold text-muted">{g.title}</p>
              <p className="mt-1 whitespace-pre-line text-brand-dark">{g.feedback}</p>
            </div>
          ))}
        </div>
      )}

      {tab === "historique" && (
        data.history.length === 0 ? <p className="rounded-xl bg-surface p-4 text-sm text-muted">Aucune activité enregistrée pour cet apprenant.</p> : (
          <ol className="space-y-3 text-sm">
            {data.history.map((h, i) => (
              <li key={i} className="flex gap-3">
                <span className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full bg-brand" aria-hidden />
                <p className="text-brand-dark"><span className="font-semibold">{h.label}</span> · {h.detail}<span className="block text-xs text-muted">{dateTime(h.at)}</span></p>
              </li>
            ))}
          </ol>
        )
      )}
    </aside>
  );
}

async function Content({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const f = parseAssessmentFilters(sp);
  const roster = await loadAssessmentRoster(sp.session ?? "");
  if (roster.failed) return <Alert>Impossible de charger vos évaluations. Réessayez.</Alert>;
  const { session } = roster;

  const head = (
    <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
      <div>
        <h1 className="text-3xl font-extrabold text-brand-dark">Évaluations</h1>
        <p className="mt-1 text-brand-dark/80">Évaluez les apprenants de vos sessions et suivez leur progression.</p>
      </div>
      {session && (
        <div className="flex flex-wrap items-center gap-3">
          <div>
            <p className="mb-1 text-xs font-semibold text-brand-dark">Session</p>
            <SessionPicker sessions={roster.sessions.map((s) => ({ id: s.id, label: sessionLabel(s) }))} value={session.id} />
            <p className="mt-1 text-xs text-muted">{sessionWhen(session)}</p>
          </div>
          <ButtonLink href={`/formateur/evaluations?session=${session.id}&statut=evaluated`} variant="outline"><Eye className="h-4 w-4" aria-hidden /> Voir les résultats</ButtonLink>
          <ButtonLink href={`/formateur/formations/nouveau/${session.courseId}?etape=3`}><Plus className="h-4 w-4" aria-hidden /> Créer une évaluation</ButtonLink>
        </div>
      )}
    </div>
  );
  if (!session) {
    return <>{head}<EmptyState title="Aucune session à évaluer">Vos sessions publiées et leurs apprenants apparaîtront ici.</EmptyState></>;
  }

  const counts = assessmentCounts(roster.rows.map((r) => r.status));
  const filtered = filterRoster(roster.rows, f);
  const pg = paginate(filtered, f.page, f.size);
  const selected = roster.rows.find((r) => r.learnerId === sp.apprenant) ?? pg.items[0] ?? null;
  const detail = selected ? await loadLearnerAssessment(session, selected.learnerId) : null;

  const href = (over: Record<string, string | number | undefined>) => {
    const u = new URLSearchParams();
    const cur: Record<string, string | number | undefined> = { session: session.id, q: f.q, statut: f.status, par: f.size === ASSESSMENT_SIZES[0] ? undefined : f.size, page: f.page, apprenant: selected?.learnerId, onglet: undefined, ...over };
    for (const [k, v] of Object.entries(cur)) if (v !== undefined && v !== "" && v !== 1) u.set(k, String(v));
    return `/formateur/evaluations?${u}`;
  };
  const nav = (items: readonly (readonly [LucideIcon, number, string, boolean])[]) => items.map(([Icon, n, label, on]) => on
    ? <Link key={label} href={href({ page: n })} aria-label={label} className="rounded-lg border border-line p-2 hover:bg-brand-soft"><Icon className="h-4 w-4" aria-hidden /></Link>
    : <span key={label} aria-hidden className="rounded-lg border border-line p-2 opacity-40"><Icon className="h-4 w-4" /></span>);
  const btn = "flex h-9 w-9 items-center justify-center rounded-lg border border-line text-brand hover:bg-brand-soft";

  return (
    <>
      {head}
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_26rem]">
        <div className="min-w-0 space-y-6">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Kpi icon={Users} tone="bg-brand-soft text-brand" value={counts.total} label="Apprenants inscrits" />
            <Kpi icon={CheckCircle2} tone="bg-success/15 text-success" color="#16a34a" value={counts.evaluated} label="Évalués" percent={percentOf(counts.evaluated, counts.total)} />
            <Kpi icon={Clock} tone="bg-brand-soft text-brand" color="#0639d9" value={counts.inProgress} label="En cours" percent={percentOf(counts.inProgress, counts.total)} />
            <Kpi icon={XCircle} tone="bg-danger/10 text-danger" color="#ef4444" value={counts.notEvaluated} label="Non évalués" percent={percentOf(counts.notEvaluated, counts.total)} />
          </div>

          <section className="overflow-hidden rounded-2xl border border-line bg-white shadow-card">
            <div className="space-y-3 border-b border-line p-4">
              <div>
                <h2 className="text-xl font-extrabold text-brand-dark">Liste des apprenants</h2>
                <p className="text-sm text-brand-dark/80">Sélectionnez un apprenant pour saisir ou consulter son évaluation.</p>
              </div>
              <RosterFilters session={session.id} q={f.q} status={f.status} hrefReset={`/formateur/evaluations?session=${session.id}`} />
            </div>
            {roster.rows.length === 0 ? (
              <div className="p-4"><EmptyState title="Aucun apprenant inscrit">Les apprenants confirmés de cette session apparaîtront ici.</EmptyState></div>
            ) : filtered.length === 0 ? (
              <div className="p-4"><EmptyState title="Aucun apprenant ne correspond"><Link href={`/formateur/evaluations?session=${session.id}`} className="font-semibold text-brand hover:underline">Réinitialiser les filtres</Link></EmptyState></div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[40rem] text-left text-sm">
                  <thead className="bg-surface text-xs text-brand-dark">
                    <tr>{["Apprenant", "Formation / Session", "Statut", "Note", "Actions"].map((h) => <th key={h} scope="col" className="px-3 py-3 font-semibold">{h}</th>)}</tr>
                  </thead>
                  <tbody>
                    {pg.items.map((r) => (
                      <tr key={r.learnerId} className={cn("border-t border-line", selected?.learnerId === r.learnerId && "bg-brand-soft/50")} aria-selected={selected?.learnerId === r.learnerId}>
                        <td className="px-3 py-3">
                          <div className="flex items-center gap-3">
                            <Avatar name={r.name} src={r.avatar} size={44} />
                            <div className="min-w-0"><Link href={href({ apprenant: r.learnerId })} className="font-bold text-brand-dark hover:text-brand hover:underline">{r.name}</Link><p className="truncate text-xs text-muted">{r.email}</p></div>
                          </div>
                        </td>
                        <td className="max-w-52 px-3 py-3 text-brand-dark"><span className="line-clamp-2" title={session.courseTitle}>{session.courseTitle}</span></td>
                        <td className="px-3 py-3"><Badge s={r.status} /></td>
                        <td className="whitespace-nowrap px-3 py-3 font-semibold text-brand-dark">{r.scorePercent !== null ? formatGrade(r.scorePercent, session.scale) : "—"}</td>
                        <td className="px-3 py-3">
                          <div className="flex items-center gap-2">
                            <Link href={href({ apprenant: r.learnerId, onglet: "historique" })} aria-label={`Voir l’historique de ${r.name}`} className={btn}><Eye className="h-4 w-4" aria-hidden /></Link>
                            <Link href={href({ apprenant: r.learnerId })} aria-label={`Évaluer ${r.name}`} className={btn}><Pencil className="h-4 w-4" aria-hidden /></Link>
                            <details className="relative">
                              <summary aria-label={`Plus d’actions pour ${r.name}`} className={cn(btn, "cursor-pointer list-none text-brand-dark [&::-webkit-details-marker]:hidden")}><MoreVertical className="h-4 w-4" aria-hidden /></summary>
                              <div className="absolute right-0 z-10 mt-1 w-52 rounded-lg border border-line bg-white py-1 text-sm shadow-card">
                                <Link href={`/formateur/apprenants/${r.learnerId}`} className="block px-3 py-2 text-brand-dark hover:bg-brand-soft">Voir la fiche</Link>
                                <Link href={`/formateur/formations/${session.courseId}/sessions/${session.id}`} className="block px-3 py-2 text-brand-dark hover:bg-brand-soft">Voir la session</Link>
                                <a href={`mailto:${r.email}`} className="block px-3 py-2 text-brand-dark hover:bg-brand-soft">Écrire à l’apprenant</a>
                              </div>
                            </details>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {filtered.length > 0 && (
              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line px-4 py-3 text-sm text-brand-dark">
                <p>Affichage de {pg.from} à {pg.to} sur {pg.total} apprenant{pg.total > 1 ? "s" : ""}</p>
                <nav aria-label="Pagination" className="flex items-center gap-1">
                  {nav([[ChevronsLeft, 1, "Première page", pg.page > 1], [ChevronLeft, pg.page - 1, "Page précédente", pg.page > 1]])}
                  {Array.from({ length: Math.min(pg.pages, 5) }, (_, i) => Math.max(1, Math.min(pg.page - 2, pg.pages - 4)) + i).filter((n) => n >= 1 && n <= pg.pages).map((n) => (
                    <Link key={n} href={href({ page: n })} aria-current={n === pg.page ? "page" : undefined}
                      className={cn("min-w-9 rounded-lg border px-2.5 py-2 text-center font-semibold", n === pg.page ? "border-brand bg-brand text-white" : "border-line hover:bg-brand-soft")}>{n}</Link>
                  ))}
                  {nav([[ChevronRight, pg.page + 1, "Page suivante", pg.page < pg.pages], [ChevronsRight, pg.pages, "Dernière page", pg.page < pg.pages]])}
                </nav>
                <PageSizeSelect value={f.size} options={ASSESSMENT_SIZES} hrefs={Object.fromEntries(ASSESSMENT_SIZES.map((n) => [n, href({ par: n === ASSESSMENT_SIZES[0] ? undefined : n, page: 1 })]))} />
              </div>
            )}
          </section>
        </div>

        {selected && detail ? (
          <Panel session={session} learner={selected} data={detail} tab={f.tab} hrefTab={(t) => href({ onglet: t === "evaluation" ? undefined : t })} />
        ) : (
          <aside className="rounded-2xl border border-line bg-white p-5 shadow-card"><EmptyState title="Aucun apprenant sélectionné">Choisissez un apprenant dans la liste pour l’évaluer.</EmptyState></aside>
        )}
      </div>
    </>
  );
}

export default function TrainerEvaluationsPage({ searchParams }: { searchParams: SP }) {
  return (
    <Suspense fallback={<div className="h-96 animate-pulse rounded-2xl bg-white" aria-hidden />}>
      <Content searchParams={searchParams} />
    </Suspense>
  );
}
