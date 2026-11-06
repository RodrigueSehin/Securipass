import { Suspense } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowDown, ArrowUp, CalendarDays, CalendarRange, CheckCircle2, ChevronLeft, ChevronRight, Clock, Download, MapPin, MoreHorizontal, Play, Plus, XCircle } from "lucide-react";
import { StatCard } from "@/components/admin/dashboard-widgets";
import { SessionsFilters } from "@/components/admin/sessions-toolbar";
import { UsersPageSize, UsersSelectAll } from "@/components/admin/users-toolbar";
import { ButtonLink } from "@/components/ui/button";
import { Avatar } from "@/components/ui/avatar";
import { Alert, EmptyState } from "@/components/ui/feedback";
import { categoryUi } from "@/content/categories";
import { percentChange } from "@/lib/admin/dashboard";
import { formatDayRange, parseSessionFilters, sharePercent, SESSION_STATUS_UI, type SessionRow } from "@/lib/admin/sessions";
import { loadSessionCourses, loadSessions, loadSessionStats } from "@/lib/admin/sessions-queries";
import { setSessionStatus } from "@/lib/admin/sessions-actions";
import { PAGE_SIZES, pageWindow } from "@/lib/admin/users";
import { MODES } from "@/lib/courses/labels";
import { formatTimeRange } from "@/lib/format";
import { publicImage } from "@/lib/images";
import { cn } from "@/lib/utils";
import { AdminPageHeader } from "@/components/admin/admin-page-header";

export const metadata = { title: "Sessions" };

const EXPORT_FORM = "sessions-export";
const nf = new Intl.NumberFormat("fr-FR");
const RESULTS: Record<string, string> = { creee: "La session a été créée.", brouillon: "La session a été enregistrée comme brouillon : le formateur la voit dans son espace.", annulee: "La session a été annulée.", retablie: "La session a été rétablie." };

type SP = Promise<{ q?: string; formation?: string; statut?: string; mode?: string; du?: string; au?: string; tri?: string; page?: string; par?: string; resultat?: string; erreur?: string }>;

function cover(s: SessionRow): string | null {
  const ui = categoryUi(s.category_slug, s.category_name ?? undefined);
  return s.course_cover ?? (ui.image ? publicImage(`home/${ui.image}`) : null);
}

async function Content({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const filters = parseSessionFilters(sp);
  const size = PAGE_SIZES.includes(Number(sp.par)) ? Number(sp.par) : PAGE_SIZES[0];
  const requested = Math.max(1, Math.floor(Number(sp.page)) || 1);
  const [stats, courses, first] = await Promise.all([loadSessionStats(), loadSessionCourses(), loadSessions(filters, size, (requested - 1) * size)]);
  if (first.failed) return <Alert>Impossible de charger les sessions. Vérifiez que la migration 35 est appliquée, puis réessayez.</Alert>;

  const pages = Math.max(1, Math.ceil(first.total / size));
  const page = Math.min(requested, pages);
  const data = page === requested ? first : await loadSessions(filters, size, (page - 1) * size);
  const from = data.total === 0 ? 0 : (page - 1) * size + 1;
  const to = Math.min(data.total, page * size);

  const href = (over: Record<string, string | number | undefined>) => {
    const u = new URLSearchParams();
    const cur: Record<string, string | number | undefined> = {
      q: filters.q, formation: filters.course, statut: filters.status, mode: filters.mode, du: filters.from, au: filters.to,
      tri: filters.asc ? "asc" : undefined, par: size === PAGE_SIZES[0] ? undefined : size, ...over,
    };
    for (const [k, v] of Object.entries(cur)) if (v !== undefined && v !== "" && v !== 1) u.set(k, String(v));
    return `/admin/sessions${u.size ? `?${u}` : ""}`;
  };
  const here = href({ page: page === 1 ? undefined : page });
  const exportParams = Object.entries({ q: filters.q, formation: filters.course, statut: filters.status, mode: filters.mode, du: filters.from, au: filters.to, tri: filters.asc ? "asc" : "" }).filter(([, v]) => v);

  const total = stats?.total.count ?? 0;
  const card = (key: "in_progress" | "planned" | "completed" | "cancelled") => {
    const b = stats?.[key];
    return b ? { value: nf.format(b.count), trend: percentChange(b.month, b.prev), note: `${sharePercent(b.count, total)} % du total` } : { value: "—", trend: null, note: "" };
  };
  const totalCard = stats ? { value: nf.format(stats.total.count), trend: percentChange(stats.total.month, stats.total.prev), note: stats.total.month === 0 ? "Aucune session ce mois-ci" : `+ ${nf.format(stats.total.month)} ce mois-ci` } : { value: "—", trend: null, note: "" };
  const th = "px-3 py-3 font-semibold";

  return (
    <div className="space-y-6">
      <AdminPageHeader crumbs={[{ label: "Sessions" }]} icon="calendar" title="Sessions" description="Gérez les sessions des formations, suivez les inscriptions et l’avancement des apprenants."
        actions={<>
          <div className="flex flex-wrap gap-2">
          <button type="submit" form={EXPORT_FORM} title="Exporte les lignes cochées, sinon le filtre courant" className="inline-flex items-center gap-2 rounded-lg border border-brand bg-white px-5 py-2.5 text-sm font-semibold text-brand hover:bg-brand-soft"><Download className="h-4 w-4" aria-hidden /> Exporter</button>
          <ButtonLink href="/admin/sessions/nouvelle"><Plus className="h-4 w-4" aria-hidden /> Ajouter une session</ButtonLink>
          </div>
        </>}
      />
      {sp.resultat && RESULTS[sp.resultat] && <Alert tone="success">{RESULTS[sp.resultat]}</Alert>}
      {sp.erreur && <Alert>{sp.erreur}</Alert>}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <StatCard icon={CalendarDays} tone="blue" label="Total sessions" {...totalCard} />
        <StatCard icon={Play} tone="green" label="En cours" {...card("in_progress")} />
        <StatCard icon={Clock} tone="orange" label="À venir" {...card("planned")} />
        <StatCard icon={CheckCircle2} tone="purple" label="Terminées" {...card("completed")} />
        <StatCard icon={XCircle} tone="slate" label="Annulées" {...card("cancelled")} />
      </div>

      <section className="rounded-2xl border border-line bg-white p-5 shadow-card">
        <SessionsFilters values={filters} courses={courses} hidden={{ ...(filters.asc ? { tri: "asc" } : {}), ...(size !== PAGE_SIZES[0] ? { par: String(size) } : {}) }} />
        <form id={EXPORT_FORM} action="/admin/sessions/export" method="get" className="hidden">
          {exportParams.map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
        </form>

        {data.total === 0 ? (
          <div className="mt-4"><EmptyState title="Aucune session ne correspond"><Link href="/admin/sessions" className="font-semibold text-brand hover:underline">Réinitialiser les filtres</Link></EmptyState></div>
        ) : (
          <div className="mt-4 overflow-x-auto rounded-xl border border-line">
            <table className="w-full min-w-[68rem] text-left text-sm">
              <thead className="bg-surface text-xs text-brand-dark">
                <tr>
                  <th scope="col" className="w-10 px-3 py-3"><UsersSelectAll formId={EXPORT_FORM} /></th>
                  <th scope="col" className={th}>Session</th>
                  <th scope="col" className={th}>Formation</th>
                  <th scope="col" className={th}>Formateur</th>
                  <th scope="col" className={th} aria-sort={filters.asc ? "ascending" : "descending"}>
                    <Link href={href({ tri: filters.asc ? undefined : "asc", page: 1 })} className="inline-flex items-center gap-1 hover:text-brand">Dates {filters.asc ? <ArrowUp className="h-3 w-3" aria-hidden /> : <ArrowDown className="h-3 w-3" aria-hidden />}</Link>
                  </th>
                  <th scope="col" className={th}>Lieu / Mode</th>
                  <th scope="col" className={th}>Apprenants</th>
                  <th scope="col" className={th}>Statut</th>
                  <th scope="col" className={th}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {data.rows.map((s) => {
                  const st = SESSION_STATUS_UI[s.display_status] ?? SESSION_STATUS_UI.planned;
                  const img = cover(s);
                  const fill = s.capacity > 0 ? Math.min(100, Math.round((s.taken / s.capacity) * 100)) : 0;
                  return (
                    <tr key={s.id} className="border-t border-line">
                      <td className="px-3 py-3"><input type="checkbox" name="id" value={s.id} form={EXPORT_FORM} aria-label={`Sélectionner ${s.title}`} className="h-4 w-4 rounded border-line" /></td>
                      <td className="px-3 py-3">
                        <div className="flex items-center gap-3">
                          <span className="relative flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-brand-dark">
                            {img ? <Image src={img} alt="" fill sizes="44px" className="object-cover" unoptimized={img.startsWith("http")} /> : <CalendarRange className="h-5 w-5 text-white/80" aria-hidden />}
                          </span>
                          <div className="min-w-0"><p className="font-bold text-brand-dark">{s.title}</p><p className="text-xs text-muted">{s.reference}</p></div>
                        </div>
                      </td>
                      <td className="max-w-44 px-3 py-3 font-semibold text-brand">{s.course_title}</td>
                      <td className="px-3 py-3">
                        <div className="flex items-center gap-2"><Avatar name={s.instructor_name} src={s.instructor_avatar} size={32} /><span className="text-xs text-brand-dark">{s.instructor_name}</span></div>
                      </td>
                      <td className="whitespace-nowrap px-3 py-3 text-xs text-brand-dark">
                        <span className="flex items-center gap-1.5"><CalendarDays className="h-3.5 w-3.5 text-muted" aria-hidden />{formatDayRange(s.start_at, s.end_at, s.timezone)}</span>
                        <span className="mt-0.5 flex items-center gap-1.5 text-muted"><Clock className="h-3.5 w-3.5" aria-hidden />{formatTimeRange(s.start_at, s.end_at, s.timezone)}</span>
                      </td>
                      <td className="px-3 py-3 text-xs text-brand-dark">
                        <span className="flex items-start gap-1.5"><MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted" aria-hidden />
                          <span>{s.delivery_mode === "online" ? "En ligne" : s.location ?? MODES[s.delivery_mode]}<span className="block text-muted">{MODES[s.delivery_mode]}</span></span></span>
                      </td>
                      <td className="min-w-28 px-3 py-3">
                        <p className="text-sm font-semibold text-brand-dark">{s.taken} / {s.capacity}</p>
                        <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-line" role="progressbar" aria-label="Places occupées" aria-valuemin={0} aria-valuemax={100} aria-valuenow={fill}><div className={cn("h-full rounded-full", st.bar)} style={{ width: `${fill}%` }} /></div>
                      </td>
                      <td className="px-3 py-3"><span className={cn("whitespace-nowrap rounded-md px-3 py-1 text-xs font-semibold", st.tone)}>{st.label}</span></td>
                      <td className="px-3 py-3">
                        <details className="relative">
                          <summary aria-label={`Actions pour ${s.title}`} className="flex h-9 w-10 cursor-pointer list-none items-center justify-center rounded-lg border border-line text-brand-dark hover:bg-brand-soft [&::-webkit-details-marker]:hidden"><MoreHorizontal className="h-4 w-4" aria-hidden /></summary>
                          <div className="absolute right-0 z-10 mt-1 w-52 rounded-lg border border-line bg-white py-1 text-sm shadow-card">
                            <Link href={`/admin/formations/${s.course_id}`} className="block px-3 py-2 text-brand-dark hover:bg-brand-soft">Voir la formation</Link>
                            {(s.raw_status === "scheduled" || s.raw_status === "cancelled") && s.display_status !== "completed" && (
                              <form action={setSessionStatus}>
                                <input type="hidden" name="sessionId" value={s.id} />
                                <input type="hidden" name="status" value={s.raw_status === "cancelled" ? "scheduled" : "cancelled"} />
                                <input type="hidden" name="back" value={here} />
                                <button className={cn("block w-full px-3 py-2 text-left hover:bg-brand-soft", s.raw_status === "cancelled" ? "text-success" : "text-danger")}>{s.raw_status === "cancelled" ? "Rétablir la session" : "Annuler la session"}</button>
                              </form>
                            )}
                          </div>
                        </details>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {data.total > 0 && (
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm text-brand-dark">
            <p>Affichage de {nf.format(from)} à {nf.format(to)} sur {nf.format(data.total)} session{data.total > 1 ? "s" : ""}</p>
            <nav aria-label="Pagination" className="flex items-center gap-1">
              {page > 1 ? <Link href={href({ page: page - 1 })} aria-label="Page précédente" className="rounded-lg border border-line p-2 hover:bg-brand-soft"><ChevronLeft className="h-4 w-4" aria-hidden /></Link>
                : <span aria-hidden className="rounded-lg border border-line p-2 opacity-40"><ChevronLeft className="h-4 w-4" /></span>}
              {pageWindow(page, pages).map((n, i) => n === "…"
                ? <span key={`e${i}`} className="px-1 text-muted">…</span>
                : <Link key={n} href={href({ page: n })} aria-current={n === page ? "page" : undefined} className={cn("min-w-9 rounded-lg border px-2.5 py-2 text-center font-semibold", n === page ? "border-brand bg-brand text-white" : "border-line hover:bg-brand-soft")}>{n}</Link>)}
              {page < pages ? <Link href={href({ page: page + 1 })} aria-label="Page suivante" className="rounded-lg border border-line p-2 hover:bg-brand-soft"><ChevronRight className="h-4 w-4" aria-hidden /></Link>
                : <span aria-hidden className="rounded-lg border border-line p-2 opacity-40"><ChevronRight className="h-4 w-4" /></span>}
            </nav>
            <UsersPageSize value={size} options={PAGE_SIZES} hrefs={Object.fromEntries(PAGE_SIZES.map((n) => [n, href({ par: n === PAGE_SIZES[0] ? undefined : n, page: 1 })]))} />
          </div>
        )}
      </section>
    </div>
  );
}

export default function SessionsPage({ searchParams }: { searchParams: SP }) {
  return (
    <Suspense fallback={<div className="h-96 animate-pulse rounded-2xl bg-white" aria-hidden />}>
      <Content searchParams={searchParams} />
    </Suspense>
  );
}
