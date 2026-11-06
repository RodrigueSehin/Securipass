import { Suspense } from "react";
import Link from "next/link";
import { ArrowDown, ArrowUp, ArrowUpDown, Award, Building2, ChevronLeft, ChevronRight, Clock, Download, MoreHorizontal, Plus, Sparkles, Users } from "lucide-react";
import { StatCard } from "@/components/admin/dashboard-widgets";
import { CompaniesFilters } from "@/components/admin/companies-toolbar";
import { UsersPageSize, UsersSelectAll } from "@/components/admin/users-toolbar";
import { ButtonLink } from "@/components/ui/button";
import { Avatar } from "@/components/ui/avatar";
import { Alert, EmptyState } from "@/components/ui/feedback";
import { percentChange } from "@/lib/admin/dashboard";
import { COMPANY_STATUS, industryTone, parseCompanyFilters, type CompanyStatus } from "@/lib/admin/companies";
import { loadCompanies, loadCompanyOptions, loadCompanyStats } from "@/lib/admin/companies-queries";
import { setCompanyStatus } from "@/lib/admin/companies-actions";
import { PAGE_SIZES, pageWindow } from "@/lib/admin/users";
import { cn } from "@/lib/utils";
import { AdminPageHeader } from "@/components/admin/admin-page-header";

export const metadata = { title: "Entreprises" };

const EXPORT_FORM = "companies-export";
const nf = new Intl.NumberFormat("fr-FR");
const rf = new Intl.NumberFormat("fr-FR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const date = (iso: string) => new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "short", year: "numeric", timeZone: "Africa/Abidjan" }).format(new Date(iso));
const TONES = ["bg-brand-soft text-brand", "bg-success/15 text-success", "bg-cta/15 text-cta-dark", "bg-[#ede9fe] text-[#6d28d9]", "bg-danger/10 text-danger", "bg-[#ccfbf1] text-[#0f766e]"] as const;
const RESULTS: Record<string, string> = { creee: "L’entreprise a été enregistrée.", active: "L’entreprise a été activée.", attente: "L’entreprise a été mise en attente.", suspendue: "L’entreprise a été désactivée." };
const ACTIONS: Record<CompanyStatus, [CompanyStatus, string, string][]> = {
  active: [["pending", "Mettre en attente", "text-brand-dark"], ["suspended", "Désactiver", "text-danger"]],
  pending: [["active", "Activer", "text-success"], ["suspended", "Désactiver", "text-danger"]],
  suspended: [["active", "Réactiver", "text-success"]],
};

type SP = Promise<{ q?: string; secteur?: string; statut?: string; ville?: string; tri?: string; page?: string; par?: string; resultat?: string; erreur?: string }>;

async function Content({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const filters = parseCompanyFilters(sp);
  const size = PAGE_SIZES.includes(Number(sp.par)) ? Number(sp.par) : PAGE_SIZES[0];
  const requested = Math.max(1, Math.floor(Number(sp.page)) || 1);
  const [stats, options, first] = await Promise.all([loadCompanyStats(), loadCompanyOptions(), loadCompanies(filters, size, (requested - 1) * size)]);
  if (first.failed) return <Alert>Impossible de charger les entreprises. Vérifiez que la migration 32 est appliquée, puis réessayez.</Alert>;

  const pages = Math.max(1, Math.ceil(first.total / size));
  const page = Math.min(requested, pages);
  const data = page === requested ? first : await loadCompanies(filters, size, (page - 1) * size);
  const from = data.total === 0 ? 0 : (page - 1) * size + 1;
  const to = Math.min(data.total, page * size);

  const href = (over: Record<string, string | number | undefined>) => {
    const u = new URLSearchParams();
    const cur: Record<string, string | number | undefined> = {
      q: filters.q, secteur: filters.industry, statut: filters.status, ville: filters.city,
      tri: filters.sort === "recent" ? undefined : filters.sort, par: size === PAGE_SIZES[0] ? undefined : size, ...over,
    };
    for (const [k, v] of Object.entries(cur)) if (v !== undefined && v !== "" && v !== 1) u.set(k, String(v));
    return `/admin/entreprises${u.size ? `?${u}` : ""}`;
  };
  const here = href({ page: page === 1 ? undefined : page });
  const exportParams = Object.entries({ q: filters.q, secteur: filters.industry, statut: filters.status, ville: filters.city, tri: filters.sort === "recent" ? "" : filters.sort }).filter(([, v]) => v);

  const block = (b?: { count: number; month: number; prev: number }) =>
    b ? { value: nf.format(b.count), trend: percentChange(b.month, b.prev), note: b.month === 0 ? "Aucune variation" : `+ ${nf.format(b.month)} ce mois-ci` } : { value: "—", trend: null, note: "" };
  const share = stats && stats.total.count > 0 ? Math.round((stats.active.count / stats.total.count) * 100) : null;
  const th = "px-3 py-3 font-semibold";
  const sortIcon = (on: "asc" | "desc" | null) => on === "asc" ? <ArrowUp className="h-3 w-3" aria-hidden /> : on === "desc" ? <ArrowDown className="h-3 w-3" aria-hidden /> : <ArrowUpDown className="h-3 w-3" aria-hidden />;

  return (
    <div className="space-y-6">
      <AdminPageHeader crumbs={[{ label: "Entreprises" }]} icon="building" title="Entreprises" description="Gérez les entreprises clientes, leurs contacts, formations et performances."
        actions={<>
          <div className="flex flex-wrap gap-2"><button type="submit" form={EXPORT_FORM} title="Exporte les lignes cochées, sinon le filtre courant" className="inline-flex items-center gap-2 rounded-lg border border-brand bg-white px-5 py-2.5 text-sm font-semibold text-brand hover:bg-brand-soft"><Download className="h-4 w-4" aria-hidden /> Exporter</button><ButtonLink href="/admin/entreprises/nouvelle"><Plus className="h-4 w-4" aria-hidden /> Ajouter une entreprise</ButtonLink></div>
        </>}
      />
      {sp.resultat && RESULTS[sp.resultat] && <Alert tone="success">{RESULTS[sp.resultat]}</Alert>}
      {sp.erreur && <Alert>{sp.erreur}</Alert>}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <StatCard icon={Building2} tone="blue" label="Total entreprises" {...block(stats?.total)} />
        <StatCard icon={Users} tone="green" label="Entreprises actives" {...{ ...block(stats?.active), note: share === null ? "" : `${share} % du total` }} />
        <StatCard icon={Clock} tone="orange" label="En cours de formation" value={stats ? nf.format(stats.in_training.companies) : "—"} note={stats ? `${nf.format(stats.in_training.learners)} apprenant${stats.in_training.learners > 1 ? "s" : ""}` : ""} />
        <StatCard icon={Award} tone="purple" label="Formations terminées" value={stats ? nf.format(stats.completed.count) : "—"} trend={stats ? percentChange(stats.completed.month, stats.completed.prev) : null}
          note={stats?.completed.rating_avg != null ? `Taux de satisfaction : ${rf.format(stats.completed.rating_avg)}/5` : "Aucun avis"} />
        <StatCard icon={Sparkles} tone="slate" label="Nouvelles entreprises" value={stats ? nf.format(stats.new.month) : "—"} trend={stats ? percentChange(stats.new.month, stats.new.prev) : null} note="Ce mois-ci" />
      </div>

      <section className="rounded-2xl border border-line bg-white p-5 shadow-card">
        <CompaniesFilters values={filters} options={options} hidden={{ ...(filters.sort !== "recent" ? { tri: filters.sort } : {}), ...(size !== PAGE_SIZES[0] ? { par: String(size) } : {}) }} />
        <form id={EXPORT_FORM} action="/admin/entreprises/export" method="get" className="hidden">
          {exportParams.map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
        </form>

        {data.total === 0 ? (
          <div className="mt-4"><EmptyState title="Aucune entreprise ne correspond"><Link href="/admin/entreprises" className="font-semibold text-brand hover:underline">Réinitialiser les filtres</Link></EmptyState></div>
        ) : (
          <div className="mt-4 overflow-x-auto rounded-xl border border-line">
            <table className="w-full min-w-[60rem] text-left text-sm">
              <thead className="bg-surface text-xs text-brand-dark">
                <tr>
                  <th scope="col" className="w-10 px-3 py-3"><UsersSelectAll formId={EXPORT_FORM} /></th>
                  <th scope="col" className={th}>Entreprise</th>
                  <th scope="col" className={th}>Contact principal</th>
                  <th scope="col" className={th}>Secteur d’activité</th>
                  <th scope="col" className={th}>Apprenants</th>
                  <th scope="col" className={th}>Formations</th>
                  <th scope="col" className={th} aria-sort={filters.sort === "status" ? "ascending" : "none"}>
                    <Link href={href({ tri: filters.sort === "status" ? undefined : "status", page: 1 })} className="inline-flex items-center gap-1 hover:text-brand">Statut {sortIcon(filters.sort === "status" ? "asc" : null)}</Link>
                  </th>
                  <th scope="col" className={th} aria-sort={filters.sort === "old" ? "ascending" : filters.sort === "recent" ? "descending" : "none"}>
                    <Link href={href({ tri: filters.sort === "recent" ? "old" : undefined, page: 1 })} className="inline-flex items-center gap-1 hover:text-brand">Date d’inscription {sortIcon(filters.sort === "old" ? "asc" : filters.sort === "recent" ? "desc" : null)}</Link>
                  </th>
                  <th scope="col" className={th}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {data.rows.map((c) => {
                  const st = COMPANY_STATUS[c.status] ?? COMPANY_STATUS.active;
                  return (
                    <tr key={c.id} className="border-t border-line">
                      <td className="px-3 py-3"><input type="checkbox" name="id" value={c.id} form={EXPORT_FORM} aria-label={`Sélectionner ${c.name}`} className="h-4 w-4 rounded border-line" /></td>
                      <td className="px-3 py-3">
                        <div className="flex items-center gap-3">
                          <Avatar name={c.name} size={44} className="rounded-lg" />
                          <div className="min-w-0"><p className="font-bold text-brand-dark">{c.name}</p>{c.city && <p className="text-xs text-muted">{c.city}</p>}</div>
                        </div>
                      </td>
                      <td className="px-3 py-3">
                        {c.contact_name || c.contact_email ? (
                          <div className="min-w-0"><p className="font-semibold text-brand-dark">{c.contact_name || "Sans nom"}</p>
                            {c.contact_email && <p className="truncate text-xs text-muted">{c.contact_email}</p>}
                            {c.contact_phone && <p className="text-xs text-muted">{c.contact_phone}</p>}</div>
                        ) : <span className="text-muted">—</span>}
                      </td>
                      <td className="px-3 py-3">{c.industry ? <span className={cn("rounded-md px-2.5 py-1 text-xs font-semibold", industryTone(c.industry, TONES))}>{c.industry}</span> : <span className="text-muted">—</span>}</td>
                      <td className="px-3 py-3 text-brand-dark">{nf.format(c.learners)}</td>
                      <td className="px-3 py-3 text-brand-dark">{nf.format(c.courses)}</td>
                      <td className="px-3 py-3"><span className={cn("rounded-md px-3 py-1 text-xs font-semibold", st.tone)}>{st.label}</span></td>
                      <td className="whitespace-nowrap px-3 py-3 text-xs text-brand-dark">{date(c.created_at)}</td>
                      <td className="px-3 py-3">
                        <details className="relative">
                          <summary aria-label={`Actions pour ${c.name}`} className="flex h-9 w-10 cursor-pointer list-none items-center justify-center rounded-lg border border-line text-brand-dark hover:bg-brand-soft [&::-webkit-details-marker]:hidden"><MoreHorizontal className="h-4 w-4" aria-hidden /></summary>
                          <div className="absolute right-0 z-10 mt-1 w-52 rounded-lg border border-line bg-white py-1 text-sm shadow-card">
                            {(ACTIONS[c.status] ?? ACTIONS.active).map(([next, text, tone]) => (
                              <form key={next} action={setCompanyStatus}>
                                <input type="hidden" name="orgId" value={c.id} />
                                <input type="hidden" name="status" value={next} />
                                <input type="hidden" name="back" value={here} />
                                <button className={cn("block w-full px-3 py-2 text-left hover:bg-brand-soft", tone)}>{text}</button>
                              </form>
                            ))}
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
            <p>Affichage de {nf.format(from)} à {nf.format(to)} sur {nf.format(data.total)} entreprise{data.total > 1 ? "s" : ""}</p>
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

export default function CompaniesPage({ searchParams }: { searchParams: SP }) {
  return (
    <Suspense fallback={<div className="h-96 animate-pulse rounded-2xl bg-white" aria-hidden />}>
      <Content searchParams={searchParams} />
    </Suspense>
  );
}
