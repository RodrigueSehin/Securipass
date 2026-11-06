import { Suspense } from "react";
import Link from "next/link";
import { ArrowDown, ArrowUp, CalendarDays, CheckCircle2, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Clock, Eye, LayoutGrid, List, MoreVertical, Pencil, Play, Plus, Users, XCircle, type LucideIcon } from "lucide-react";
import { PageSizeSelect, SessionFilters } from "@/components/sessions/session-filters";
import { SessionCalendar, SessionDistribution, SessionThumb, UpcomingSessions } from "@/components/sessions/session-panels";
import { ButtonLink } from "@/components/ui/button";
import { Alert, EmptyState, StatusBadge } from "@/components/ui/feedback";
import { paginate } from "@/lib/courses/course-list";
import { listMySessions, type MySession } from "@/lib/courses/instructor-queries";
import { MODES } from "@/lib/courses/labels";
import { formatShortDate, formatTimeRange } from "@/lib/format";
import {
  DISPLAY_STATUS, computeKpis, displayStatus, distribution, filterSessions, isMonth, monthGrid, shiftMonth, type Kpi,
} from "@/lib/sessions/dashboard";
import { listDrafts } from "@/lib/sessions/wizard-queries";
import { cn } from "@/lib/utils";

export const metadata = { title: "Mes sessions" };

const SIZES = [8, 16, 24];
const RESULTS: Record<string, string> = {
  creee: "La session a été créée.", creees: "Les sessions ont été créées.", brouillon: "La session a été enregistrée comme brouillon.",
  assistant: "Votre progression est enregistrée : reprenez la création depuis « Sessions en cours de création ».",
};
const currentTime = () => Date.now();
const KPI_META = {
  planned: { label: "Sessions planifiées", icon: CalendarDays, tone: "bg-brand-soft text-brand" },
  in_progress: { label: "En cours", icon: Play, tone: "bg-success/15 text-success" },
  completed: { label: "Terminées", icon: CheckCircle2, tone: "bg-warning/15 text-warning" },
  cancelled: { label: "Annulées", icon: XCircle, tone: "bg-danger/10 text-danger" },
} as const;

type SP = Promise<{ q?: string; course?: string; status?: string; date?: string; vue?: string; page?: string; par?: string; mois?: string; resultat?: string }>;

function KpiCard({ kpi }: { kpi: Kpi }) {
  const m = KPI_META[kpi.key];
  const Icon = m.icon;
  return (
    <div className="flex items-center gap-4 rounded-2xl border border-line bg-white p-5 shadow-card">
      <span className={cn("flex h-14 w-14 shrink-0 items-center justify-center rounded-xl", m.tone)}><Icon className="h-7 w-7" aria-hidden /></span>
      <span>
        <span className="block text-3xl font-extrabold leading-none text-brand-dark">{kpi.value}</span>
        <span className="mt-1 block text-sm text-muted">{m.label}</span>
        {kpi.trend && (
          <span className={cn("mt-0.5 inline-flex items-center gap-1 text-xs font-semibold", kpi.trend.up === (kpi.key !== "cancelled") ? "text-success" : "text-danger")}>
            {kpi.trend.text} {kpi.trend.up ? <ArrowUp className="h-3 w-3" aria-hidden /> : <ArrowDown className="h-3 w-3" aria-hidden />}
          </span>
        )}
      </span>
    </div>
  );
}

function Actions({ s }: { s: MySession }) {
  const base = `/formateur/formations/${s.course_id}/sessions/${s.id}`;
  const btn = "flex h-9 w-9 items-center justify-center rounded-lg border border-line text-brand hover:bg-brand-soft";
  const item = "block px-3 py-2 text-brand-dark hover:bg-brand-soft";
  return (
    <div className="flex items-center gap-2">
      <Link href={base} aria-label={`Voir ${s.title}`} className={btn}><Eye className="h-4 w-4" aria-hidden /></Link>
      <Link href={base} aria-label={`Modifier ${s.title}`} className={btn}><Pencil className="h-4 w-4" aria-hidden /></Link>
      <details className="relative">
        <summary aria-label={`Plus d’actions pour ${s.title}`} className={cn(btn, "cursor-pointer list-none text-brand-dark [&::-webkit-details-marker]:hidden")}>
          <MoreVertical className="h-4 w-4" aria-hidden />
        </summary>
        <div className="absolute right-0 z-10 mt-1 w-60 rounded-lg border border-line bg-white py-1 text-sm shadow-card">
          <Link href={base} className={item}>Participants et gestion</Link>
          <Link href={`/formateur/formations/${s.course_id}/sessions`} className={item}>Toutes les sessions de la formation</Link>
          <Link href={`/formateur/formations/${s.course_id}`} className={item}>Voir la formation</Link>
        </div>
      </details>
    </div>
  );
}

const modeClass = (m: MySession["delivery_mode"]) => (m === "onsite" ? "bg-warning/15 text-warning" : "bg-brand-soft text-brand");

type NavItem = readonly [LucideIcon, number, string, boolean];

async function Dashboard({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const [all, drafts] = await Promise.all([listMySessions(), listDrafts()]);
  const now = currentTime();
  const courses = [...new Map(all.map((s) => [s.course_id, s.course?.title ?? "Formation"])).entries()].map(([id, title]) => ({ id, title }));

  const filters = {
    q: sp.q?.trim().slice(0, 100) ?? "",
    course: courses.some((c) => c.id === sp.course) ? sp.course! : "",
    status: sp.status && sp.status in DISPLAY_STATUS ? sp.status : "",
    date: ["avenir", "passees", "mois"].includes(sp.date ?? "") ? sp.date! : "",
  };
  const view = sp.vue === "grille" ? "grille" : "liste";
  const size = SIZES.includes(Number(sp.par)) ? Number(sp.par) : SIZES[0];
  const month = isMonth(sp.mois) ? sp.mois : new Date(now).toISOString().slice(0, 7);

  const filtered = filterSessions(all, filters, now);
  const pg = paginate(filtered, Number(sp.page), size);
  const kpis = computeKpis(all, now);
  const upcoming = all.filter((s) => ["planned", "in_progress"].includes(displayStatus(s, now))).sort((a, b) => a.start_at.localeCompare(b.start_at)).slice(0, 3);
  const dist = distribution(all, now);
  const days = monthGrid(month, all, now);

  const href = (over: Record<string, string | number | undefined>) => {
    const u = new URLSearchParams();
    const cur: Record<string, string | number | undefined> = {
      q: filters.q, course: filters.course, status: filters.status, date: filters.date, vue: view === "grille" ? "grille" : undefined,
      par: size === SIZES[0] ? undefined : size, mois: isMonth(sp.mois) ? sp.mois : undefined, ...over,
    };
    for (const [k, v] of Object.entries(cur)) if (v !== undefined && v !== "" && v !== 1) u.set(k, String(v));
    const s = u.toString();
    return `/formateur/sessions${s ? `?${s}` : ""}`;
  };
  const exportParams = new URLSearchParams(Object.entries(filters).filter(([, v]) => v));
  const exportHref = `/formateur/sessions/export${exportParams.size ? `?${exportParams}` : ""}`;

  const pageNav = (items: NavItem[]) => items.map(([Icon, n, label, on]) => on
    ? <Link key={label} href={href({ page: n })} aria-label={label} className="rounded-lg border border-line p-2 hover:bg-brand-soft"><Icon className="h-4 w-4" aria-hidden /></Link>
    : <span key={label} aria-hidden className="rounded-lg border border-line p-2 opacity-40"><Icon className="h-4 w-4" /></span>);

  return (
    <>
      {sp.resultat && RESULTS[sp.resultat] && <div className="mb-4"><Alert tone="success">{RESULTS[sp.resultat]}</Alert></div>}
      {drafts.length > 0 && (
        <div className="mb-4 rounded-xl border border-line bg-white p-4 shadow-card">
          <p className="mb-2 text-sm font-semibold text-brand-dark">Sessions en cours de création</p>
          <ul className="flex flex-wrap gap-2">
            {drafts.map((d) => (
              <li key={d.id}><Link href={`/formateur/sessions/nouvelle/${d.id}?etape=${Math.min(4, d.step)}`} className="inline-flex items-center rounded-lg border border-brand px-3 py-1.5 text-sm font-semibold text-brand hover:bg-brand-soft">{d.title || "Session sans titre"} · reprendre</Link></li>
            ))}
          </ul>
        </div>
      )}
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-3xl font-extrabold text-brand-dark">Mes sessions</h1>
          <p className="mt-1 text-brand-dark/80">Planifiez, gérez et suivez toutes vos sessions de formation.</p>
        </div>
        <ButtonLink href="/formateur/sessions/nouvelle"><Plus className="h-4 w-4" aria-hidden /> Créer une session</ButtonLink>
      </div>

      <div className="grid gap-6 2xl:grid-cols-[minmax(0,1fr)_24rem]">
        <div className="min-w-0 space-y-6">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{kpis.map((k) => <KpiCard key={k.key} kpi={k} />)}</div>

          <section className="overflow-hidden rounded-2xl border border-line bg-white shadow-card">
            <div className="flex flex-wrap items-center">
              <div className="min-w-0 flex-1">
                <SessionFilters values={filters} courses={courses} exportHref={exportHref}
                  hidden={{ ...(view === "grille" ? { vue: "grille" } : {}), ...(size !== SIZES[0] ? { par: String(size) } : {}) }} />
              </div>
              <div className="flex gap-1 border-b border-line p-4" role="group" aria-label="Affichage">
                <Link href={href({ vue: undefined, page: 1 })} aria-label="Vue liste" aria-current={view === "liste" ? "true" : undefined}
                  className={cn("flex h-10 w-10 items-center justify-center rounded-lg", view === "liste" ? "bg-brand text-white" : "text-brand hover:bg-brand-soft")}><List className="h-5 w-5" aria-hidden /></Link>
                <Link href={href({ vue: "grille", page: 1 })} aria-label="Vue grille" aria-current={view === "grille" ? "true" : undefined}
                  className={cn("flex h-10 w-10 items-center justify-center rounded-lg", view === "grille" ? "bg-brand text-white" : "text-brand hover:bg-brand-soft")}><LayoutGrid className="h-5 w-5" aria-hidden /></Link>
              </div>
            </div>

            {all.length === 0 ? (
              <div className="p-4"><EmptyState title="Aucune session pour le moment">Planifiez votre première session avec « Créer une session ».</EmptyState></div>
            ) : filtered.length === 0 ? (
              <div className="p-4"><EmptyState title="Aucune session ne correspond"><Link href="/formateur/sessions" className="font-semibold text-brand hover:underline">Réinitialiser les filtres</Link></EmptyState></div>
            ) : view === "liste" ? (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[56rem] text-left text-sm">
                  <thead className="bg-surface text-xs text-brand-dark">
                    <tr>
                      {["Session", "Formation", "Dates", "Format", "Participants", "Statut", "Actions"].map((h) => <th key={h} scope="col" className="px-4 py-3 font-semibold">{h}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {pg.items.map((s) => {
                      const st = DISPLAY_STATUS[displayStatus(s, now)];
                      return (
                        <tr key={s.id} className="border-t border-line">
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-3">
                              <SessionThumb session={s} />
                              <div>
                                <Link href={`/formateur/formations/${s.course_id}/sessions/${s.id}`} className="font-bold text-brand-dark hover:text-brand hover:underline">{s.title}</Link>
                                <p className="text-xs text-muted">{s.reference}</p>
                              </div>
                            </div>
                          </td>
                          <td className="max-w-48 px-4 py-3 text-brand-dark">{s.course?.title}</td>
                          <td className="whitespace-nowrap px-4 py-3 text-xs text-muted">
                            <span className="flex items-center gap-1.5"><CalendarDays className="h-3.5 w-3.5 text-brand" aria-hidden />{formatShortDate(s.start_at, s.timezone)}</span>
                            <span className="mt-1 flex items-center gap-1.5"><Clock className="h-3.5 w-3.5 text-brand" aria-hidden />{formatTimeRange(s.start_at, s.end_at, s.timezone)}</span>
                          </td>
                          <td className="px-4 py-3"><span className={cn("rounded-md px-2.5 py-1 text-xs font-semibold", modeClass(s.delivery_mode))}>{MODES[s.delivery_mode]}</span></td>
                          <td className="whitespace-nowrap px-4 py-3 text-brand-dark"><Users className="mr-1.5 inline h-4 w-4 text-brand" aria-hidden />{s.taken} / {s.capacity}</td>
                          <td className="px-4 py-3"><StatusBadge tone={st.tone}>{st.label}</StatusBadge></td>
                          <td className="px-4 py-3"><Actions s={s} /></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <ul className="grid gap-4 p-4 sm:grid-cols-2 xl:grid-cols-3">
                {pg.items.map((s) => {
                  const st = DISPLAY_STATUS[displayStatus(s, now)];
                  return (
                    <li key={s.id} className="rounded-xl border border-line p-4">
                      <div className="flex items-start gap-3">
                        <SessionThumb session={s} size={56} />
                        <div className="min-w-0 flex-1">
                          <Link href={`/formateur/formations/${s.course_id}/sessions/${s.id}`} className="font-bold text-brand-dark hover:text-brand hover:underline">{s.title}</Link>
                          <p className="text-xs text-muted">{s.reference}</p>
                        </div>
                        <StatusBadge tone={st.tone}>{st.label}</StatusBadge>
                      </div>
                      <p className="mt-3 text-sm text-brand-dark">{s.course?.title}</p>
                      <p className="mt-1 text-xs text-muted">{formatShortDate(s.start_at, s.timezone)} · {formatTimeRange(s.start_at, s.end_at, s.timezone)}</p>
                      <div className="mt-3 flex items-center justify-between gap-2">
                        <span className={cn("rounded-md px-2.5 py-1 text-xs font-semibold", modeClass(s.delivery_mode))}>{MODES[s.delivery_mode]}</span>
                        <span className="text-sm text-brand-dark"><Users className="mr-1 inline h-4 w-4 text-brand" aria-hidden />{s.taken} / {s.capacity}</span>
                        <Actions s={s} />
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}

            {filtered.length > 0 && (
              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line px-4 py-3 text-sm text-brand-dark">
                <p>Affichage de {pg.from} à {pg.to} sur {pg.total} session{pg.total > 1 ? "s" : ""}</p>
                <nav aria-label="Pagination" className="flex items-center gap-1">
                  {pageNav([[ChevronsLeft, 1, "Première page", pg.page > 1], [ChevronLeft, pg.page - 1, "Page précédente", pg.page > 1]])}
                  {Array.from({ length: pg.pages }, (_, i) => i + 1).map((n) => (
                    <Link key={n} href={href({ page: n })} aria-current={n === pg.page ? "page" : undefined}
                      className={cn("min-w-9 rounded-lg border px-2.5 py-2 text-center font-semibold", n === pg.page ? "border-brand bg-brand text-white" : "border-line hover:bg-brand-soft")}>{n}</Link>
                  ))}
                  {pageNav([[ChevronRight, pg.page + 1, "Page suivante", pg.page < pg.pages], [ChevronsRight, pg.pages, "Dernière page", pg.page < pg.pages]])}
                </nav>
                <PageSizeSelect value={size} options={SIZES} hrefs={Object.fromEntries(SIZES.map((n) => [n, href({ par: n === SIZES[0] ? undefined : n, page: 1 })]))} />
              </div>
            )}
          </section>
        </div>

        <aside className="space-y-6">
          <SessionCalendar month={month} days={days}
            prevHref={href({ mois: shiftMonth(month, -1), page: 1 })} nextHref={href({ mois: shiftMonth(month, 1), page: 1 })} />
          <UpcomingSessions sessions={upcoming} allHref={href({ date: "avenir", page: 1 })} />
          <SessionDistribution items={dist} total={all.length} />
        </aside>
      </div>
    </>
  );
}

export default function MySessionsPage({ searchParams }: { searchParams: SP }) {
  return (
    <Suspense fallback={<div className="h-96 animate-pulse rounded-2xl bg-white" aria-hidden />}>
      <Dashboard searchParams={searchParams} />
    </Suspense>
  );
}
