import { Suspense } from "react";
import Link from "next/link";
import { CheckCircle2, ChevronLeft, ChevronRight, Clock, Download, CalendarDays, MoreHorizontal, Plus, Users, XCircle, ArrowDown, ArrowUp } from "lucide-react";
import { StatCard } from "@/components/admin/dashboard-widgets";
import { EnrollmentsFilters } from "@/components/admin/enrollments-toolbar";
import { UsersPageSize, UsersSelectAll } from "@/components/admin/users-toolbar";
import { ButtonLink } from "@/components/ui/button";
import { Avatar } from "@/components/ui/avatar";
import { Alert, EmptyState } from "@/components/ui/feedback";
import { percentChange } from "@/lib/admin/dashboard";
import { ENROLLMENT_STATUS_UI, PAYMENT_STATUS_UI, enrollmentGroup, parseEnrollmentFilters, RAW_STATUS_LABEL } from "@/lib/admin/enrollments";
import { decideEnrollment } from "@/lib/admin/enrollments-actions";
import { loadEnrollmentOptions, loadEnrollments, loadEnrollmentStats } from "@/lib/admin/enrollments-queries";
import { sharePercent } from "@/lib/admin/sessions";
import { PAGE_SIZES, pageWindow } from "@/lib/admin/users";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { AdminPageHeader } from "@/components/admin/admin-page-header";

export const metadata = { title: "Inscriptions" };

const EXPORT_FORM = "enrollments-export";
const nf = new Intl.NumberFormat("fr-FR");
const RESULTS: Record<string, string> = {
  creee: "L’apprenant a été inscrit à la session.", attente: "La session est complète : l’apprenant a été ajouté en liste d’attente.",
  validee: "L’inscription a été validée.", refusee: "L’inscription a été refusée.", annulee: "L’inscription a été annulée.",
};
const time = (iso: string, timeZone: string) => new Intl.DateTimeFormat("fr-FR", { hour: "2-digit", minute: "2-digit", timeZone }).format(new Date(iso));

type SP = Promise<{ q?: string; formation?: string; session?: string; statut?: string; du?: string; au?: string; tri?: string; page?: string; par?: string; resultat?: string; erreur?: string }>;

async function Content({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const filters = parseEnrollmentFilters(sp);
  const size = PAGE_SIZES.includes(Number(sp.par)) ? Number(sp.par) : PAGE_SIZES[0];
  const requested = Math.max(1, Math.floor(Number(sp.page)) || 1);
  const [stats, options, first] = await Promise.all([loadEnrollmentStats(), loadEnrollmentOptions(), loadEnrollments(filters, size, (requested - 1) * size)]);
  if (first.failed) return <Alert>Impossible de charger les inscriptions. Vérifiez que la migration 37 est appliquée, puis réessayez.</Alert>;

  const pages = Math.max(1, Math.ceil(first.total / size));
  const page = Math.min(requested, pages);
  const data = page === requested ? first : await loadEnrollments(filters, size, (page - 1) * size);
  const from = data.total === 0 ? 0 : (page - 1) * size + 1;
  const to = Math.min(data.total, page * size);

  const href = (over: Record<string, string | number | undefined>) => {
    const u = new URLSearchParams();
    const cur: Record<string, string | number | undefined> = {
      q: filters.q, formation: filters.course, session: filters.session, statut: filters.status, du: filters.from, au: filters.to,
      tri: filters.asc ? "asc" : undefined, par: size === PAGE_SIZES[0] ? undefined : size, ...over,
    };
    for (const [k, v] of Object.entries(cur)) if (v !== undefined && v !== "" && v !== 1) u.set(k, String(v));
    return `/admin/inscriptions${u.size ? `?${u}` : ""}`;
  };
  const here = href({ page: page === 1 ? undefined : page });
  const exportParams = Object.entries({ q: filters.q, formation: filters.course, session: filters.session, statut: filters.status, du: filters.from, au: filters.to, tri: filters.asc ? "asc" : "" }).filter(([, v]) => v);

  const total = stats?.total.count ?? 0;
  const card = (key: "pending" | "validated" | "refused") => {
    const b = stats?.[key];
    return b ? { value: nf.format(b.count), trend: percentChange(b.month, b.prev), note: `${sharePercent(b.count, total)} % du total` } : { value: "—", trend: null, note: "" };
  };
  const totalCard = stats ? { value: nf.format(stats.total.count), trend: percentChange(stats.total.month, stats.total.prev), note: stats.total.month === 0 ? "Aucune inscription ce mois-ci" : `+ ${nf.format(stats.total.month)} ce mois-ci` } : { value: "—", trend: null, note: "" };
  const th = "px-3 py-3 font-semibold";

  return (
    <div className="space-y-6">
      <AdminPageHeader crumbs={[{ label: "Inscriptions" }]} icon="calendar-check" title="Gestion des inscriptions" description="Consultez, validez et suivez les inscriptions aux formations."
        actions={<>
          <div className="flex flex-wrap gap-2">
          <button type="submit" form={EXPORT_FORM} title="Exporte les lignes cochées, sinon le filtre courant" className="inline-flex items-center gap-2 rounded-lg border border-brand bg-white px-5 py-2.5 text-sm font-semibold text-brand hover:bg-brand-soft"><Download className="h-4 w-4" aria-hidden /> Exporter</button>
          <ButtonLink href="/admin/inscriptions/nouvelle"><Plus className="h-4 w-4" aria-hidden /> Nouvelle inscription</ButtonLink>
          </div>
        </>}
      />
      {sp.resultat && RESULTS[sp.resultat] && <Alert tone="success">{RESULTS[sp.resultat]}</Alert>}
      {sp.erreur && <Alert>{sp.erreur}</Alert>}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard icon={Users} tone="blue" label="Total inscriptions" {...totalCard} />
        <StatCard icon={Clock} tone="orange" label="En attente" {...card("pending")} />
        <StatCard icon={CheckCircle2} tone="green" label="Validées" {...card("validated")} />
        <StatCard icon={XCircle} tone="slate" label="Refusées ou annulées" {...card("refused")} />
      </div>

      <section className="rounded-2xl border border-line bg-white p-5 shadow-card">
        <EnrollmentsFilters values={filters} options={options} hidden={{ ...(filters.asc ? { tri: "asc" } : {}), ...(size !== PAGE_SIZES[0] ? { par: String(size) } : {}) }} />
        <form id={EXPORT_FORM} action="/admin/inscriptions/export" method="get" className="hidden">
          {exportParams.map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
        </form>

        {data.total === 0 ? (
          <div className="mt-4"><EmptyState title="Aucune inscription ne correspond"><Link href="/admin/inscriptions" className="font-semibold text-brand hover:underline">Réinitialiser les filtres</Link></EmptyState></div>
        ) : (
          <div className="mt-4 overflow-x-auto rounded-xl border border-line">
            <table className="w-full min-w-[62rem] text-left text-sm">
              <thead className="bg-surface text-xs text-brand-dark">
                <tr>
                  <th scope="col" className="w-10 px-3 py-3"><UsersSelectAll formId={EXPORT_FORM} /></th>
                  <th scope="col" className={th}>Apprenant</th>
                  <th scope="col" className={th}>Formation</th>
                  <th scope="col" className={th}>Session</th>
                  <th scope="col" className={th} aria-sort={filters.asc ? "ascending" : "descending"}>
                    <Link href={href({ tri: filters.asc ? undefined : "asc", page: 1 })} className="inline-flex items-center gap-1 hover:text-brand">Date d’inscription {filters.asc ? <ArrowUp className="h-3 w-3" aria-hidden /> : <ArrowDown className="h-3 w-3" aria-hidden />}</Link>
                  </th>
                  <th scope="col" className={th}>Statut</th>
                  <th scope="col" className={th}>Paiement</th>
                  <th scope="col" className={th}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {data.rows.map((e) => {
                  const group = enrollmentGroup(e.status);
                  const st = ENROLLMENT_STATUS_UI[group] ?? ENROLLMENT_STATUS_UI.pending;
                  const tz = e.session_timezone ?? "Africa/Abidjan";
                  const cancellable = ["pending_payment", "confirmed", "waitlisted", "suspended"].includes(e.status);
                  return (
                    <tr key={e.id} className="border-t border-line">
                      <td className="px-3 py-3"><input type="checkbox" name="id" value={e.id} form={EXPORT_FORM} aria-label={`Sélectionner ${e.learner_name}`} className="h-4 w-4 rounded border-line" /></td>
                      <td className="px-3 py-3">
                        <div className="flex items-center gap-3">
                          <Avatar name={e.learner_name} src={e.learner_avatar} size={40} />
                          <div className="min-w-0"><p className="font-bold text-brand-dark">{e.learner_name || e.learner_email}</p><p className="text-xs text-muted">{e.learner_phone || e.learner_email}</p></div>
                        </div>
                      </td>
                      <td className="max-w-52 px-3 py-3 text-brand-dark">{e.course_title}</td>
                      <td className="px-3 py-3">
                        {e.session_title
                          ? <span className="inline-flex items-center gap-1.5 rounded-lg bg-brand-soft px-2.5 py-1 text-xs font-semibold text-brand-dark"><CalendarDays className="h-3.5 w-3.5 text-brand" aria-hidden />{e.session_title}</span>
                          : <span className="text-xs text-muted">Sans session</span>}
                      </td>
                      <td className="whitespace-nowrap px-3 py-3 text-brand-dark">{formatDate(e.enrolled_at, tz)}<span className="block text-xs text-muted">{time(e.enrolled_at, tz)}</span></td>
                      <td className="px-3 py-3"><span title={RAW_STATUS_LABEL[e.status]} className={cn("whitespace-nowrap rounded-md px-3 py-1 text-xs font-semibold", st.tone)}>{st.label}</span></td>
                      <td className="px-3 py-3">{e.payment_status ? <span className={cn("whitespace-nowrap rounded-md px-3 py-1 text-xs font-semibold", PAYMENT_STATUS_UI[e.payment_status].tone)}>{PAYMENT_STATUS_UI[e.payment_status].label}</span> : <span className="text-xs text-muted">—</span>}</td>
                      <td className="px-3 py-3">
                        <details className="relative">
                          <summary aria-label={`Actions pour ${e.learner_name}`} className="flex h-9 w-10 cursor-pointer list-none items-center justify-center rounded-lg border border-line text-brand-dark hover:bg-brand-soft [&::-webkit-details-marker]:hidden"><MoreHorizontal className="h-4 w-4" aria-hidden /></summary>
                          <div className="absolute right-0 z-10 mt-1 w-52 rounded-lg border border-line bg-white py-1 text-sm shadow-card">
                            <Link href={`/admin/formations/${e.course_id}`} className="block px-3 py-2 text-brand-dark hover:bg-brand-soft">Voir la formation</Link>
                            {e.status === "pending_approval" && (["approve", "decline"] as const).map((d) => (
                              <form key={d} action={decideEnrollment}>
                                <input type="hidden" name="enrollmentId" value={e.id} /><input type="hidden" name="decision" value={d} /><input type="hidden" name="back" value={here} />
                                <button className={cn("block w-full px-3 py-2 text-left hover:bg-brand-soft", d === "approve" ? "text-success" : "text-danger")}>{d === "approve" ? "Valider l’inscription" : "Refuser l’inscription"}</button>
                              </form>
                            ))}
                            {cancellable && (
                              <form action={decideEnrollment}>
                                <input type="hidden" name="enrollmentId" value={e.id} /><input type="hidden" name="decision" value="cancel" /><input type="hidden" name="back" value={here} />
                                <button className="block w-full px-3 py-2 text-left text-danger hover:bg-brand-soft">Annuler l’inscription</button>
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
            <p>Affichage de {nf.format(from)} à {nf.format(to)} sur {nf.format(data.total)} inscription{data.total > 1 ? "s" : ""}</p>
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

export default function EnrollmentsPage({ searchParams }: { searchParams: SP }) {
  return (
    <Suspense fallback={<div className="h-96 animate-pulse rounded-2xl bg-white" aria-hidden />}>
      <Content searchParams={searchParams} />
    </Suspense>
  );
}
