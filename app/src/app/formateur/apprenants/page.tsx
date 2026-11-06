import { Suspense } from "react";
import Link from "next/link";
import { ArrowUp, ArrowDown, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, CheckCircle2, Eye, GraduationCap, LayoutGrid, List, MessageSquare, MoreVertical, Plus, Users, XCircle, type LucideIcon } from "lucide-react";
import { LearnerFilters, EXPORT_FORM_ID, PageSize, SelectAll } from "@/components/learners/learner-toolbar";
import { Avatar } from "@/components/ui/avatar";
import { ButtonLink } from "@/components/ui/button";
import { Alert, EmptyState } from "@/components/ui/feedback";
import { paginate } from "@/lib/courses/course-list";
import { relativeTime } from "@/lib/format";
import { filterLearners, LEARNER_STATUS, overviewStats, topCourses, type LearnerRow } from "@/lib/learners/overview";
import { loadLearnerOverview } from "@/lib/learners/queries";
import { listPendingRegistrations } from "@/lib/learners/wizard-queries";
import { cn } from "@/lib/utils";

export const metadata = { title: "Mes apprenants" };

const SIZES = [10, 20, 50];
const currentTime = () => Date.now();
const COLORS = { in_progress: "#0639d9", completed: "#16a34a", late: "#f59e0b", dropped: "#ef4444" } as const;
const GROUP_LABEL = { in_progress: "En cours", completed: "Terminés", late: "En retard", dropped: "Abandons" } as const;

type SP = Promise<{ n?: string; echecs?: string; q?: string; session?: string; status?: string; course?: string; vue?: string; page?: string; par?: string; resultat?: string }>;

const monthYear = (iso: string) => {
  const s = new Intl.DateTimeFormat("fr-FR", { month: "short", year: "numeric", timeZone: "Africa/Abidjan" }).format(new Date(iso));
  return s.charAt(0).toUpperCase() + s.slice(1).replace(/\.?\s/, ". ").replace("..", ".");
};
const shortDate = (iso: string) => new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "short", year: "numeric", timeZone: "Africa/Abidjan" }).format(new Date(iso));

function Kpi({ icon: Icon, tone, value, label, bar }: { icon: LucideIcon; tone: string; value: number; label: string; bar?: { percent: number; color: string; text: string } | { text: string; up: boolean } | null }) {
  return (
    <div className="flex items-center gap-4 rounded-2xl border border-line bg-white p-5 shadow-card">
      <span className={cn("flex h-14 w-14 shrink-0 items-center justify-center rounded-xl", tone)}><Icon className="h-7 w-7" aria-hidden /></span>
      <span className="min-w-0 flex-1">
        <span className="block text-3xl font-extrabold leading-none text-brand-dark">{value}</span>
        <span className="mt-1 block text-sm text-muted">{label}</span>
        {bar && "percent" in bar && (
          <span className="mt-1 flex items-center gap-2 text-xs font-semibold" style={{ color: bar.color }}>
            {bar.text}
            <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface"><span className="block h-full rounded-full" style={{ width: `${bar.percent}%`, background: bar.color }} /></span>
          </span>
        )}
        {bar && "up" in bar && (
          <span className={cn("mt-1 inline-flex items-center gap-1 text-xs font-semibold", bar.up ? "text-success" : "text-danger")}>
            {bar.text} {bar.up ? <ArrowUp className="h-3 w-3" aria-hidden /> : <ArrowDown className="h-3 w-3" aria-hidden />}
          </span>
        )}
      </span>
    </div>
  );
}

function Progress({ r }: { r: LearnerRow }) {
  const color = r.status === "completed" ? "#16a34a" : r.status === "late" ? "#f59e0b" : "#0639d9";
  return (
    <div className="flex items-center gap-2">
      <span className="h-1.5 w-24 overflow-hidden rounded-full bg-surface" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={r.percent} aria-label={`Progression de ${r.name}`}>
        <span className="block h-full rounded-full" style={{ width: `${r.percent}%`, background: color }} />
      </span>
      <span className="text-xs text-brand-dark">{r.percent}%</span>
    </div>
  );
}

function Actions({ r }: { r: LearnerRow }) {
  const btn = "flex h-9 w-9 items-center justify-center rounded-lg border border-line text-brand hover:bg-brand-soft";
  const item = "block px-3 py-2 text-brand-dark hover:bg-brand-soft";
  return (
    <div className="flex items-center gap-2">
      <Link href={`/formateur/apprenants/${r.id}`} aria-label={`Voir la fiche de ${r.name}`} className={btn}><Eye className="h-4 w-4" aria-hidden /></Link>
      <a href={`mailto:${r.email}`} aria-label={`Écrire à ${r.name}`} className={btn}><MessageSquare className="h-4 w-4" aria-hidden /></a>
      <details className="relative">
        <summary aria-label={`Plus d’actions pour ${r.name}`} className={cn(btn, "cursor-pointer list-none text-brand-dark [&::-webkit-details-marker]:hidden")}><MoreVertical className="h-4 w-4" aria-hidden /></summary>
        <div className="absolute right-0 z-10 mt-1 w-56 rounded-lg border border-line bg-white py-1 text-sm shadow-card">
          <Link href={`/formateur/apprenants/${r.id}`} className={item}>Voir la fiche</Link>
          {r.sessionId && <Link href={`/formateur/formations/${r.courseId}/sessions/${r.sessionId}`} className={item}>Voir la session</Link>}
          <Link href={`/formateur/formations/${r.courseId}`} className={item}>Voir la formation</Link>
        </div>
      </details>
    </div>
  );
}

const Badge = ({ s }: { s: LearnerRow["status"] }) => <span className={cn("inline-flex rounded-md px-2.5 py-1 text-xs font-semibold", LEARNER_STATUS[s].tone)}>{LEARNER_STATUS[s].label}</span>;

async function Content({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const now = currentTime();
  const [data, pending] = await Promise.all([loadLearnerOverview(now), listPendingRegistrations()]);
  if (data.failed) return <Alert>Impossible de charger vos apprenants. Réessayez.</Alert>;

  const filters = {
    q: sp.q?.trim().slice(0, 100) ?? "",
    session: data.sessions.some((s) => s.id === sp.session) ? sp.session! : "",
    status: sp.status && sp.status in LEARNER_STATUS ? sp.status : "",
    course: data.courses.some((c) => c.id === sp.course) ? sp.course! : "",
  };
  const view = sp.vue === "grille" ? "grille" : "liste";
  const size = SIZES.includes(Number(sp.par)) ? Number(sp.par) : SIZES[0];
  const filtered = filterLearners(data.rows, filters);
  const pg = paginate(filtered, Number(sp.page), size);
  const stats = overviewStats(data.rows, now);
  const top = topCourses(data.rows);

  const href = (over: Record<string, string | number | undefined>) => {
    const u = new URLSearchParams();
    const cur: Record<string, string | number | undefined> = { ...filters, vue: view === "grille" ? "grille" : undefined, par: size === SIZES[0] ? undefined : size, ...over };
    for (const [k, v] of Object.entries(cur)) if (v !== undefined && v !== "" && v !== 1) u.set(k, String(v));
    return `/formateur/apprenants${u.size ? `?${u}` : ""}`;
  };
  const nav = (items: readonly (readonly [LucideIcon, number, string, boolean])[]) => items.map(([Icon, n, label, on]) => on
    ? <Link key={label} href={href({ page: n })} aria-label={label} className="rounded-lg border border-line p-2 hover:bg-brand-soft"><Icon className="h-4 w-4" aria-hidden /></Link>
    : <span key={label} aria-hidden className="rounded-lg border border-line p-2 opacity-40"><Icon className="h-4 w-4" /></span>);

  // Anneau de répartition
  const r = 70;
  const c = 2 * Math.PI * r;
  let offset = 0;

  return (
    <>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-3xl font-extrabold text-brand-dark">Mes apprenants</h1>
          <p className="mt-1 text-brand-dark/80">Suivez et accompagnez tous les apprenants inscrits à vos sessions.</p>
        </div>
        <ButtonLink href="/formateur/apprenants/nouveau"><Plus className="h-4 w-4" aria-hidden /> Ajouter un apprenant</ButtonLink>
      </div>
      {sp.resultat === "ajoute" && (
        <div className="mb-4">
          <Alert tone={Number(sp.n) > 0 ? "success" : "error"}>
            {Number(sp.n) > 0 ? `L’apprenant a été inscrit à ${sp.n} session${Number(sp.n) > 1 ? "s" : ""}.` : "L’apprenant n’a pu être inscrit à aucune session."}
            {Number(sp.echecs) > 0 && ` ${sp.echecs} session${Number(sp.echecs) > 1 ? "s" : ""} n’a pas pu être ajoutée (complète, fermée ou déjà inscrit).`}
          </Alert>
        </div>
      )}
      {sp.resultat === "attente" && <div className="mb-4"><Alert tone="info">Fiche enregistrée : cette personne n’a pas encore de compte. Ses inscriptions seront faites automatiquement dès qu’elle créera son compte avec cette adresse e-mail.</Alert></div>}
      {pending.length > 0 && (
        <div className="mb-4 rounded-xl border border-line bg-white p-4 shadow-card">
          <p className="mb-2 text-sm font-semibold text-brand-dark">En attente de la création d’un compte</p>
          <ul className="flex flex-wrap gap-2">
            {pending.map((p) => <li key={p.id} className="rounded-lg bg-surface px-3 py-1.5 text-sm text-brand-dark">{p.name} · {p.email} · {p.sessions} session{p.sessions > 1 ? "s" : ""}</li>)}
          </ul>
        </div>
      )}

      <div className="grid gap-6 2xl:grid-cols-[minmax(0,1fr)_24rem]">
        <div className="min-w-0 space-y-6">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Kpi icon={Users} tone="bg-brand-soft text-brand" value={stats.total} label="Apprenants au total" bar={stats.trend} />
            <Kpi icon={GraduationCap} tone="bg-success/15 text-success" value={stats.inProgress.count} label="En cours" bar={{ percent: stats.inProgress.percent, color: "#0639d9", text: `${stats.inProgress.percent}%` }} />
            <Kpi icon={CheckCircle2} tone="bg-success/15 text-success" value={stats.completed.count} label="Terminés" bar={{ percent: stats.completed.percent, color: "#16a34a", text: `${stats.completed.percent}%` }} />
            <Kpi icon={XCircle} tone="bg-danger/10 text-danger" value={stats.dropped.count} label="Abandons" bar={{ percent: stats.dropped.percent, color: "#ef4444", text: `${stats.dropped.percent}%` }} />
          </div>

          <section className="overflow-hidden rounded-2xl border border-line bg-white shadow-card">
            <div className="flex flex-wrap items-center gap-2 border-b border-line p-4">
              <LearnerFilters values={filters} courses={data.courses} sessions={data.sessions}
                hidden={{ ...(view === "grille" ? { vue: "grille" } : {}), ...(size !== SIZES[0] ? { par: String(size) } : {}) }} />
              <div className="flex gap-1" role="group" aria-label="Affichage">
                <Link href={href({ vue: undefined, page: 1 })} aria-label="Vue liste" aria-current={view === "liste" ? "true" : undefined}
                  className={cn("flex h-10 w-10 items-center justify-center rounded-lg", view === "liste" ? "bg-brand text-white" : "text-brand hover:bg-brand-soft")}><List className="h-5 w-5" aria-hidden /></Link>
                <Link href={href({ vue: "grille", page: 1 })} aria-label="Vue grille" aria-current={view === "grille" ? "true" : undefined}
                  className={cn("flex h-10 w-10 items-center justify-center rounded-lg", view === "grille" ? "bg-brand text-white" : "text-brand hover:bg-brand-soft")}><LayoutGrid className="h-5 w-5" aria-hidden /></Link>
              </div>
            </div>
            <form id={EXPORT_FORM_ID} action="/formateur/apprenants/export" method="get" className="hidden">
              {Object.entries(filters).map(([k, v]) => v && <input key={k} type="hidden" name={k} value={v} />)}
            </form>

            {data.rows.length === 0 ? (
              <div className="p-4"><EmptyState title="Aucun apprenant pour le moment">Les apprenants inscrits à vos formations apparaîtront ici.</EmptyState></div>
            ) : filtered.length === 0 ? (
              <div className="p-4"><EmptyState title="Aucun apprenant ne correspond"><Link href="/formateur/apprenants" className="font-semibold text-brand hover:underline">Réinitialiser les filtres</Link></EmptyState></div>
            ) : view === "liste" ? (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[60rem] text-left text-sm">
                  <thead className="bg-surface text-xs text-brand-dark">
                    <tr>
                      <th scope="col" className="w-10 px-4 py-3"><SelectAll /></th>
                      {["Apprenant", "Email", "Formation", "Session", "Progression", "Statut", "Dernière activité", "Actions"].map((h) => <th key={h} scope="col" className="px-3 py-3 font-semibold">{h}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {pg.items.map((l) => (
                      <tr key={l.id} className="border-t border-line">
                        <td className="px-4 py-3"><input type="checkbox" name="id" value={l.id} form={EXPORT_FORM_ID} aria-label={`Sélectionner ${l.name}`} className="h-4 w-4 rounded border-line" /></td>
                        <td className="px-3 py-3"><div className="flex items-center gap-3"><Avatar name={l.name} src={l.avatar} /><Link href={`/formateur/apprenants/${l.id}`} className="font-bold text-brand-dark hover:text-brand hover:underline">{l.name}</Link></div></td>
                        <td className="max-w-44 truncate px-3 py-3 text-muted" title={l.email}>{l.email}</td>
                        <td className="max-w-40 truncate px-3 py-3 text-brand-dark" title={l.course}>{l.course}</td>
                        <td className="whitespace-nowrap px-3 py-3 text-brand-dark">{l.sessionStart ? monthYear(l.sessionStart) : "—"}</td>
                        <td className="px-3 py-3"><Progress r={l} /></td>
                        <td className="px-3 py-3"><Badge s={l.status} /></td>
                        <td className="whitespace-nowrap px-3 py-3 text-brand-dark">{l.lastActivity ? shortDate(l.lastActivity) : "--"}</td>
                        <td className="px-3 py-3"><Actions r={l} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <ul className="grid gap-4 p-4 sm:grid-cols-2 xl:grid-cols-3">
                {pg.items.map((l) => (
                  <li key={l.id} className="rounded-xl border border-line p-4">
                    <div className="flex items-center gap-3">
                      <Avatar name={l.name} src={l.avatar} size={44} />
                      <div className="min-w-0 flex-1">
                        <Link href={`/formateur/apprenants/${l.id}`} className="font-bold text-brand-dark hover:text-brand hover:underline">{l.name}</Link>
                        <p className="truncate text-xs text-muted">{l.email}</p>
                      </div>
                      <Badge s={l.status} />
                    </div>
                    <p className="mt-3 text-sm text-brand-dark">{l.course}</p>
                    <p className="text-xs text-muted">{l.sessionStart ? `Session ${monthYear(l.sessionStart)}` : "Sans session"} · {l.lastActivity ? shortDate(l.lastActivity) : "aucune activité"}</p>
                    <div className="mt-3 flex items-center justify-between gap-2"><Progress r={l} /><Actions r={l} /></div>
                  </li>
                ))}
              </ul>
            )}

            {filtered.length > 0 && (
              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line px-4 py-3 text-sm text-brand-dark">
                <p>Affichage de {pg.from} à {pg.to} sur {pg.total} apprenant{pg.total > 1 ? "s" : ""}</p>
                <nav aria-label="Pagination" className="flex items-center gap-1">
                  {nav([[ChevronsLeft, 1, "Première page", pg.page > 1], [ChevronLeft, pg.page - 1, "Page précédente", pg.page > 1]])}
                  {Array.from({ length: Math.min(pg.pages, 7) }, (_, i) => {
                    const start = Math.max(1, Math.min(pg.page - 3, pg.pages - 6));
                    return start + i;
                  }).filter((n) => n >= 1 && n <= pg.pages).map((n) => (
                    <Link key={n} href={href({ page: n })} aria-current={n === pg.page ? "page" : undefined}
                      className={cn("min-w-9 rounded-lg border px-2.5 py-2 text-center font-semibold", n === pg.page ? "border-brand bg-brand text-white" : "border-line hover:bg-brand-soft")}>{n}</Link>
                  ))}
                  {nav([[ChevronRight, pg.page + 1, "Page suivante", pg.page < pg.pages], [ChevronsRight, pg.pages, "Dernière page", pg.page < pg.pages]])}
                </nav>
                <PageSize value={size} options={SIZES} hrefs={Object.fromEntries(SIZES.map((n) => [n, href({ par: n === SIZES[0] ? undefined : n, page: 1 })]))} />
              </div>
            )}
          </section>
        </div>

        <aside className="space-y-6">
          <section className="rounded-2xl border border-line bg-white p-5 shadow-card">
            <h2 className="mb-3 text-lg font-extrabold text-brand-dark">Répartition par statut</h2>
            <div className="flex flex-wrap items-center justify-center gap-4">
              <svg viewBox="0 0 200 200" className="h-40 w-40 shrink-0" role="img" aria-label={`${stats.total} apprenants : ${stats.parts.map((p) => `${GROUP_LABEL[p.key]} ${p.count}`).join(", ")}`}>
                <circle cx="100" cy="100" r={r} fill="none" stroke="#eef2f7" strokeWidth="28" />
                {stats.total > 0 && stats.parts.map((p) => {
                  const len = (p.count / stats.total) * c;
                  const el = <circle key={p.key} cx="100" cy="100" r={r} fill="none" stroke={COLORS[p.key]} strokeWidth="28" strokeDasharray={`${len} ${c - len}`} strokeDashoffset={-offset} transform="rotate(-90 100 100)" />;
                  offset += len;
                  return el;
                })}
                <text x="100" y="102" textAnchor="middle" className="fill-brand-dark" style={{ fontSize: 34, fontWeight: 800 }}>{stats.total}</text>
                <text x="100" y="124" textAnchor="middle" className="fill-muted" style={{ fontSize: 13 }}>apprenants</text>
              </svg>
              <dl className="min-w-40 flex-1 space-y-2 text-sm">
                {stats.parts.map((p) => (
                  <div key={p.key} className="flex items-center justify-between gap-3">
                    <dt className="flex items-center gap-2 text-brand-dark"><span className="h-2.5 w-2.5 rounded-full" style={{ background: COLORS[p.key] }} aria-hidden />{GROUP_LABEL[p.key]}</dt>
                    <dd className="text-muted">{p.count} ({p.percent}%)</dd>
                  </div>
                ))}
              </dl>
            </div>
          </section>

          <section className="rounded-2xl border border-line bg-white p-5 shadow-card">
            <h2 className="mb-3 text-lg font-extrabold text-brand-dark">Top formations suivies</h2>
            {top.length === 0 ? <p className="text-sm text-muted">Aucune formation suivie pour le moment.</p> : (
              <ol className="space-y-3">
                {top.map((t) => (
                  <li key={t.id}>
                    <Link href={href({ course: t.id, page: 1 })} className="flex items-center gap-3 hover:text-brand">
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand-soft text-brand"><GraduationCap className="h-5 w-5" aria-hidden /></span>
                      <span className="flex-1 text-sm text-brand-dark">{t.title}</span>
                      <span className="text-sm font-semibold text-brand-dark">{t.count}</span>
                    </Link>
                  </li>
                ))}
              </ol>
            )}
          </section>

          <section className="rounded-2xl border border-line bg-white p-5 shadow-card">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-lg font-extrabold text-brand-dark">Activité récente</h2>
              <Link href={href({ page: 1 })} className="text-sm font-semibold text-brand hover:underline">Voir tout</Link>
            </div>
            {data.activity.length === 0 ? <p className="text-sm text-muted">Aucune activité récente.</p> : (
              <ul className="space-y-4">
                {data.activity.map((a) => (
                  <li key={a.id} className="flex gap-3">
                    <Avatar name={a.name} src={a.avatar} size={40} />
                    <p className="text-sm text-brand-dark">
                      <span className="font-bold">{a.name}</span> {a.verb}<br />{a.subject}
                      <span className="block text-xs text-muted">{relativeTime(a.at, data.now).replace("Il y a", "il y a")}</span>
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </aside>
      </div>
    </>
  );
}

export default function LearnersPage({ searchParams }: { searchParams: SP }) {
  return (
    <Suspense fallback={<div className="h-96 animate-pulse rounded-2xl bg-white" aria-hidden />}>
      <Content searchParams={searchParams} />
    </Suspense>
  );
}
