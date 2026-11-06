import { Suspense } from "react";
import Link from "next/link";
import { Award, BadgeCheck, ChevronLeft, ChevronRight, CheckCircle2, GraduationCap, MoreHorizontal, Plus, Users, XCircle, Clock } from "lucide-react";
import { CategoryBadge } from "@/components/admin/category-badge";
import { CertificationsToolbar } from "@/components/admin/certifications-toolbar";
import { StatCard } from "@/components/admin/dashboard-widgets";
import { UsersPageSize } from "@/components/admin/users-toolbar";
import { ButtonLink } from "@/components/ui/button";
import { Alert, EmptyState } from "@/components/ui/feedback";
import { percentChange } from "@/lib/admin/dashboard";
import { CERTIFICATION_STATUS_UI, parseCertificationFilters, validityLabel, type CertificationTab } from "@/lib/admin/certifications";
import { setCertificationStatus } from "@/lib/admin/certifications-actions";
import { loadCertificationOptions, loadCertifications, loadCertificationStats } from "@/lib/admin/certifications-queries";
import { formatPercent } from "@/lib/admin/evaluations";
import { PAGE_SIZES, pageWindow } from "@/lib/admin/users";
import { cn } from "@/lib/utils";
import { AdminPageHeader } from "@/components/admin/admin-page-header";

export const metadata = { title: "Certifications" };

const nf = new Intl.NumberFormat("fr-FR");
const RESULTS: Record<string, string> = {
  creee: "La certification a été créée.", activee: "La certification est active.", revision: "La certification est en révision.", desactivee: "La certification a été désactivée.",
};

type SP = Promise<{ q?: string; categorie?: string; statut?: string; onglet?: string; page?: string; par?: string; resultat?: string; erreur?: string }>;

async function Content({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const filters = parseCertificationFilters(sp);
  const size = PAGE_SIZES.includes(Number(sp.par)) ? Number(sp.par) : PAGE_SIZES[0];
  const requested = Math.max(1, Math.floor(Number(sp.page)) || 1);
  const [stats, options, first] = await Promise.all([loadCertificationStats(), loadCertificationOptions(), loadCertifications(filters, size, (requested - 1) * size)]);
  if (first.failed) return <Alert>Impossible de charger les certifications. Vérifiez que la migration 45 est appliquée, puis réessayez.</Alert>;

  const pages = Math.max(1, Math.ceil(first.total / size));
  const page = Math.min(requested, pages);
  const data = page === requested ? first : await loadCertifications(filters, size, (page - 1) * size);
  const from = data.total === 0 ? 0 : (page - 1) * size + 1;
  const to = Math.min(data.total, page * size);

  const href = (over: Record<string, string | number | undefined>) => {
    const u = new URLSearchParams();
    const cur: Record<string, string | number | undefined> = {
      q: filters.q, categorie: filters.category, statut: filters.status, onglet: filters.tab === "all" ? undefined : filters.tab, par: size === PAGE_SIZES[0] ? undefined : size, ...over,
    };
    for (const [k, v] of Object.entries(cur)) if (v !== undefined && v !== "" && v !== 1) u.set(k, String(v));
    return `/admin/certifications${u.size ? `?${u}` : ""}`;
  };
  const here = href({ page: page === 1 ? undefined : page });
  const trend = (b?: { month?: number; prev?: number }) => (b ? percentChange(b.month ?? 0, b.prev ?? 0) : null);
  const note = (b?: { month?: number }) => ((b?.month ?? 0) === 0 ? "Aucune variation" : `+ ${nf.format(b?.month ?? 0)} ce mois-ci`);
  const tabs: [CertificationTab, string, number | undefined][] = [["all", "Toutes les certifications", stats?.created.count], ["active", "Actives", stats?.active], ["inactive", "Inactives", stats?.inactive]];
  const th = "px-3 py-3 font-semibold";

  return (
    <div className="space-y-6">
      <AdminPageHeader crumbs={[{ label: "Certifications" }]} icon="award" title="Gestion des certifications" description="Créez, gérez et suivez les certifications délivrées aux apprenants." />
      {sp.resultat && RESULTS[sp.resultat] && <Alert tone="success">{RESULTS[sp.resultat]}</Alert>}
      {sp.erreur && <Alert>{sp.erreur}</Alert>}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard icon={Award} tone="blue" label="Certifications créées" value={stats ? nf.format(stats.created.count) : "—"} trend={trend(stats?.created)} note={note(stats?.created)} />
        <StatCard icon={GraduationCap} tone="green" label="Certifications délivrées" value={stats ? nf.format(stats.delivered.count) : "—"} trend={trend(stats?.delivered)} note={note(stats?.delivered)} />
        <StatCard icon={Users} tone="orange" label="Apprenants certifiés" value={stats ? nf.format(stats.learners.count) : "—"} trend={trend(stats?.learners)} note={note(stats?.learners)} />
        <StatCard icon={BadgeCheck} tone="purple" label="Taux de réussite" value={stats ? formatPercent(stats.success.passed, stats.success.results) : "—"} note={stats ? `${nf.format(stats.success.results)} résultat${stats.success.results > 1 ? "s" : ""} d’évaluation` : ""} />
      </div>

      <section className="rounded-2xl border border-line bg-white p-5 shadow-card">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-line">
          <nav aria-label="Statut des certifications" className="flex flex-wrap gap-1">
            {tabs.map(([key, label, count]) => (
              <Link key={key} href={href({ onglet: key === "all" ? undefined : key, page: 1 })} aria-current={filters.tab === key ? "page" : undefined}
                className={cn("-mb-px border-b-2 px-4 py-2.5 text-sm font-semibold", filters.tab === key ? "border-brand text-brand" : "border-transparent text-brand-dark hover:text-brand")}>
                {label}{count !== undefined && ` (${nf.format(count)})`}
              </Link>
            ))}
          </nav>
          <div className="pb-2"><ButtonLink href="/admin/certifications/nouvelle"><Plus className="h-4 w-4" aria-hidden /> Nouvelle certification</ButtonLink></div>
        </div>
        <CertificationsToolbar values={filters} options={options} hidden={{ ...(filters.tab !== "all" ? { onglet: filters.tab } : {}), ...(size !== PAGE_SIZES[0] ? { par: String(size) } : {}) }} />

        {data.total === 0 ? (
          <div className="mt-4"><EmptyState title="Aucune certification ne correspond"><Link href="/admin/certifications" className="font-semibold text-brand hover:underline">Réinitialiser les filtres</Link></EmptyState></div>
        ) : (
          <div className="mt-4 overflow-x-auto rounded-xl border border-line">
            <table className="w-full min-w-[56rem] text-left text-sm">
              <thead className="bg-surface text-xs text-brand-dark"><tr>
                <th scope="col" className={th}>#</th><th scope="col" className={th}>Certification</th><th scope="col" className={th}>Code</th><th scope="col" className={th}>Formation associée</th>
                <th scope="col" className={th}>Validité</th><th scope="col" className={th}>Délivrés</th><th scope="col" className={th}>Statut</th><th scope="col" className={th}>Actions</th>
              </tr></thead>
              <tbody>
                {data.rows.map((c, i) => {
                  const st = CERTIFICATION_STATUS_UI[c.status];
                  return (
                    <tr key={c.id} className="border-t border-line">
                      <td className="px-3 py-3 text-muted">{(page - 1) * size + i + 1}</td>
                      <td className="px-3 py-3"><div className="flex items-center gap-3"><CategoryBadge icon={c.category_icon ?? "folder"} color={c.category_color ?? "blue"} size={40} /><span className="font-bold text-brand-dark">{c.name}</span></div></td>
                      <td className="px-3 py-3"><span className="rounded-md bg-surface px-2.5 py-1 font-mono text-xs text-brand-dark">{c.code}</span></td>
                      <td className="px-3 py-3"><span className="inline-flex items-center gap-1.5 rounded-lg bg-brand-soft px-2.5 py-1 text-xs font-semibold text-brand-dark"><GraduationCap className="h-3.5 w-3.5 text-brand" aria-hidden />{c.course_title}</span></td>
                      <td className="whitespace-nowrap px-3 py-3 text-brand-dark">{validityLabel(c.validity_months)}</td>
                      <td className="px-3 py-3 font-semibold text-brand-dark">{nf.format(c.delivered)}</td>
                      <td className="px-3 py-3"><span className={cn("inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-semibold", st.tone)}>
                        {c.status === "active" ? <CheckCircle2 className="h-4 w-4" aria-hidden /> : c.status === "review" ? <Clock className="h-4 w-4" aria-hidden /> : <XCircle className="h-4 w-4" aria-hidden />}{st.label}</span></td>
                      <td className="px-3 py-3">
                        <details className="relative">
                          <summary aria-label={`Actions pour ${c.name}`} className="flex h-9 w-9 cursor-pointer list-none items-center justify-center rounded-lg text-brand-dark hover:bg-brand-soft [&::-webkit-details-marker]:hidden"><MoreHorizontal className="h-4 w-4" aria-hidden /></summary>
                          <div className="absolute right-0 z-10 mt-1 w-56 rounded-lg border border-line bg-white py-1 text-sm shadow-card">
                            <Link href={`/admin/formations/${c.course_id}`} className="block px-3 py-2 text-brand-dark hover:bg-brand-soft">Voir la formation</Link>
                            {(["active", "review", "inactive"] as const).filter((s) => s !== c.status).map((s) => (
                              <form key={s} action={setCertificationStatus}>
                                <input type="hidden" name="certificationId" value={c.id} /><input type="hidden" name="status" value={s} /><input type="hidden" name="back" value={here} />
                                <button className={cn("block w-full px-3 py-2 text-left hover:bg-brand-soft", s === "active" ? "text-success" : s === "inactive" ? "text-danger" : "text-brand-dark")}>
                                  {s === "active" ? "Activer" : s === "review" ? "Mettre en révision" : "Désactiver"}</button>
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
            <p>Affichage de {nf.format(from)} à {nf.format(to)} sur {nf.format(data.total)} certification{data.total > 1 ? "s" : ""}</p>
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

export default function CertificationsPage({ searchParams }: { searchParams: SP }) {
  return (
    <Suspense fallback={<div className="h-96 animate-pulse rounded-2xl bg-white" aria-hidden />}>
      <Content searchParams={searchParams} />
    </Suspense>
  );
}
