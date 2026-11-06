import { Suspense } from "react";
import Link from "next/link";
import { Award, ChevronLeft, ChevronRight, Clock, Download, Eye, GraduationCap, Mail, MoreHorizontal, Pencil, Phone, Plus, Users } from "lucide-react";
import { StatCard } from "@/components/admin/dashboard-widgets";
import { LearnersFilters } from "@/components/admin/learners-toolbar";
import { UsersPageSize, UsersSelectAll } from "@/components/admin/users-toolbar";
import { Avatar } from "@/components/ui/avatar";
import { ButtonLink } from "@/components/ui/button";
import { Alert, EmptyState } from "@/components/ui/feedback";
import { percentChange } from "@/lib/admin/dashboard";
import { LEARNER_DISPLAY, parseLearnerFilters, type LearnerTab } from "@/lib/admin/learners";
import { loadLearnerOptions, loadLearners, loadLearnerStats } from "@/lib/admin/learners-queries";
import { updateUserStatus } from "@/lib/admin/users-actions";
import { PAGE_SIZES, pageWindow } from "@/lib/admin/users";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { AdminPageHeader } from "@/components/admin/admin-page-header";

export const metadata = { title: "Apprenants" };

const EXPORT_FORM = "learners-export";
const nf = new Intl.NumberFormat("fr-FR");
const RESULTS: Record<string, string> = { suspendu: "Le compte a été suspendu.", reactive: "Le compte a été réactivé." };

type SP = Promise<{ q?: string; onglet?: string; formation?: string; entreprise?: string; statut?: string; tri?: string; page?: string; par?: string; resultat?: string; erreur?: string }>;

async function Content({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const filters = parseLearnerFilters(sp);
  const size = PAGE_SIZES.includes(Number(sp.par)) ? Number(sp.par) : PAGE_SIZES[0];
  const requested = Math.max(1, Math.floor(Number(sp.page)) || 1);
  const [stats, options, first] = await Promise.all([loadLearnerStats(), loadLearnerOptions(), loadLearners(filters, size, (requested - 1) * size)]);
  if (first.failed) return <Alert>Impossible de charger les apprenants. Vérifiez que la migration 40 est appliquée, puis réessayez.</Alert>;

  const pages = Math.max(1, Math.ceil(first.total / size));
  const page = Math.min(requested, pages);
  const data = page === requested ? first : await loadLearners(filters, size, (page - 1) * size);
  const from = data.total === 0 ? 0 : (page - 1) * size + 1;
  const to = Math.min(data.total, page * size);

  const href = (over: Record<string, string | number | undefined>) => {
    const u = new URLSearchParams();
    const cur: Record<string, string | number | undefined> = {
      q: filters.q, onglet: filters.tab === "all" ? undefined : filters.tab, formation: filters.course, entreprise: filters.org, statut: filters.status,
      tri: filters.sort === "recent" ? undefined : filters.sort, par: size === PAGE_SIZES[0] ? undefined : size, ...over,
    };
    for (const [k, v] of Object.entries(cur)) if (v !== undefined && v !== "" && v !== 1) u.set(k, String(v));
    return `/admin/apprenants${u.size ? `?${u}` : ""}`;
  };
  const here = href({ page: page === 1 ? undefined : page });
  const exportParams = Object.entries({ q: filters.q, onglet: filters.tab === "all" ? "" : filters.tab, formation: filters.course, entreprise: filters.org, statut: filters.status, tri: filters.sort === "recent" ? "" : filters.sort }).filter(([, v]) => v);

  const card = (key: "total" | "active" | "training" | "certified") => {
    const b = stats?.[key];
    return b ? { value: nf.format(b.count), trend: percentChange(b.month ?? 0, b.prev ?? 0), note: (b.month ?? 0) === 0 ? "Aucune variation" : `+ ${nf.format(b.month ?? 0)} ce mois-ci` } : { value: "—", trend: null, note: "" };
  };
  const tabs: [LearnerTab, string, number | undefined][] = [
    ["all", "Tous", stats?.total.count], ["active", "Actifs", stats?.active.count], ["training", "En formation", stats?.training.count],
    ["certified", "Certifiés", stats?.certified.count], ["inactive", "Inactifs", stats?.inactive.count],
  ];
  const th = "px-3 py-3 font-semibold";

  return (
    <div className="space-y-6">
      <AdminPageHeader crumbs={[{ label: "Apprenants" }]} icon="users" title="Gestion des apprenants" description="Consultez, inscrivez et suivez la progression de tous les apprenants."
        actions={<>
          <div className="flex flex-wrap gap-2">
          <button type="submit" form={EXPORT_FORM} title="Exporte les lignes cochées, sinon le filtre courant" className="inline-flex items-center gap-2 rounded-lg border border-brand bg-white px-5 py-2.5 text-sm font-semibold text-brand hover:bg-brand-soft"><Download className="h-4 w-4" aria-hidden /> Exporter</button>
          <ButtonLink href="/admin/apprenants/nouveau"><Plus className="h-4 w-4" aria-hidden /> Nouvel apprenant</ButtonLink>
          </div>
        </>}
      />
      {sp.resultat && RESULTS[sp.resultat] && <Alert tone="success">{RESULTS[sp.resultat]}</Alert>}
      {sp.erreur && <Alert>{sp.erreur}</Alert>}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard icon={Users} tone="blue" label="Apprenants totaux" {...card("total")} />
        <StatCard icon={GraduationCap} tone="green" label="Apprenants actifs" {...card("active")} />
        <StatCard icon={Clock} tone="orange" label="En formation" {...card("training")} />
        <StatCard icon={Award} tone="purple" label="Certifiés" {...card("certified")} />
      </div>

      <section className="rounded-2xl border border-line bg-white p-5 shadow-card">
        <nav aria-label="Catégories d’apprenants" className="mb-4 flex flex-wrap gap-1 border-b border-line">
          {tabs.map(([key, label, count]) => (
            <Link key={key} href={href({ onglet: key === "all" ? undefined : key, page: 1 })} aria-current={filters.tab === key ? "page" : undefined}
              className={cn("-mb-px border-b-2 px-4 py-2.5 text-sm font-semibold", filters.tab === key ? "border-brand text-brand" : "border-transparent text-brand-dark hover:text-brand")}>
              {label}{count !== undefined && ` (${nf.format(count)})`}
            </Link>
          ))}
        </nav>
        <LearnersFilters values={filters} options={options} hidden={{ ...(filters.tab !== "all" ? { onglet: filters.tab } : {}), ...(filters.sort !== "recent" ? { tri: filters.sort } : {}), ...(size !== PAGE_SIZES[0] ? { par: String(size) } : {}) }} />
        <form id={EXPORT_FORM} action="/admin/apprenants/export" method="get" className="hidden">
          {exportParams.map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
        </form>

        {data.total === 0 ? (
          <div className="mt-4"><EmptyState title="Aucun apprenant ne correspond"><Link href="/admin/apprenants" className="font-semibold text-brand hover:underline">Réinitialiser les filtres</Link></EmptyState></div>
        ) : (
          <div className="mt-4 overflow-x-auto rounded-xl border border-line">
            <table className="w-full min-w-[68rem] text-left text-sm">
              <thead className="bg-surface text-xs text-brand-dark">
                <tr>
                  <th scope="col" className="w-10 px-3 py-3"><UsersSelectAll formId={EXPORT_FORM} /></th>
                  <th scope="col" className={th}>Apprenant</th>
                  <th scope="col" className={th}>Contact</th>
                  <th scope="col" className={th}>Entreprise</th>
                  <th scope="col" className={th}>Formations (inscriptions)</th>
                  <th scope="col" className={th}>Progression</th>
                  <th scope="col" className={th}>Statut</th>
                  <th scope="col" className={th}>Inscription</th>
                  <th scope="col" className={th}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {data.rows.map((l) => {
                  const st = LEARNER_DISPLAY[l.display_status] ?? LEARNER_DISPLAY.none;
                  const suspended = l.account_status !== "active";
                  return (
                    <tr key={l.id} className="border-t border-line">
                      <td className="px-3 py-3"><input type="checkbox" name="id" value={l.id} form={EXPORT_FORM} aria-label={`Sélectionner ${l.full_name}`} className="h-4 w-4 rounded border-line" /></td>
                      <td className="px-3 py-3">
                        <div className="flex items-center gap-3">
                          <Avatar name={l.full_name} src={l.avatar_url} size={40} />
                          <div className="min-w-0"><p className="font-bold text-brand-dark">{l.full_name || l.email}</p><p className="text-xs text-muted">{l.learner_code ?? "—"}</p></div>
                        </div>
                      </td>
                      <td className="px-3 py-3 text-xs text-brand-dark">
                        <span className="flex items-center gap-1.5"><Mail className="h-3.5 w-3.5 text-muted" aria-hidden />{l.email}</span>
                        {l.phone && <span className="mt-1 flex items-center gap-1.5"><Phone className="h-3.5 w-3.5 text-brand" aria-hidden />{l.phone}</span>}
                      </td>
                      <td className="px-3 py-3 text-brand-dark">{l.organization ?? <span className="text-muted">Particulier</span>}</td>
                      <td className="max-w-56 px-3 py-3">
                        {l.course_title
                          ? <span className="inline-flex max-w-full items-center gap-1.5 rounded-lg bg-brand-soft px-2.5 py-1 text-xs font-semibold text-brand-dark"><GraduationCap className="h-3.5 w-3.5 shrink-0 text-brand" aria-hidden /><span className="truncate">{l.course_title}</span></span>
                          : <span className="text-xs text-muted">Aucune</span>}
                        {l.enrollments_count > 1 && <span className="ml-1 text-xs font-semibold text-brand">+{l.enrollments_count - 1}</span>}
                      </td>
                      <td className="min-w-32 px-3 py-3">
                        {l.progress === null ? <span className="text-muted">—</span> : (
                          <div className="flex items-center gap-2">
                            <div className="h-2 flex-1 overflow-hidden rounded-full bg-line" role="progressbar" aria-label="Progression" aria-valuemin={0} aria-valuemax={100} aria-valuenow={l.progress}><div className={cn("h-full rounded-full", st.bar)} style={{ width: `${l.progress}%` }} /></div>
                            <span className="text-xs font-semibold text-brand-dark">{l.progress} %</span>
                          </div>
                        )}
                      </td>
                      <td className="px-3 py-3">
                        <span className={cn("whitespace-nowrap rounded-md px-3 py-1 text-xs font-semibold", st.tone)}>{st.label}</span>
                        {suspended && <span className="mt-1 block text-xs font-semibold text-danger">Compte {l.account_status === "suspended" ? "suspendu" : "en suppression"}</span>}
                      </td>
                      <td className="whitespace-nowrap px-3 py-3 text-brand-dark">{formatDate(l.created_at)}</td>
                      <td className="px-3 py-3">
                        <div className="flex items-center gap-1">
                          <Link href={`/admin/utilisateurs/${l.id}`} aria-label={`Voir ${l.full_name}`} className="rounded-lg p-2 text-brand-dark hover:bg-brand-soft"><Eye className="h-4 w-4" aria-hidden /></Link>
                          <Link href={`/admin/utilisateurs/${l.id}`} aria-label={`Modifier ${l.full_name}`} className="rounded-lg p-2 text-brand hover:bg-brand-soft"><Pencil className="h-4 w-4" aria-hidden /></Link>
                          <details className="relative">
                            <summary aria-label={`Plus d’actions pour ${l.full_name}`} className="flex h-9 w-9 cursor-pointer list-none items-center justify-center rounded-lg text-brand-dark hover:bg-brand-soft [&::-webkit-details-marker]:hidden"><MoreHorizontal className="h-4 w-4" aria-hidden /></summary>
                            <div className="absolute right-0 z-10 mt-1 w-52 rounded-lg border border-line bg-white py-1 text-sm shadow-card">
                              <Link href="/admin/inscriptions/nouvelle" className="block px-3 py-2 text-brand-dark hover:bg-brand-soft">Inscrire à une session</Link>
                              {l.account_status !== "deletion_requested" && (
                                <form action={updateUserStatus}>
                                  <input type="hidden" name="userId" value={l.id} />
                                  <input type="hidden" name="status" value={suspended ? "active" : "suspended"} />
                                  <input type="hidden" name="back" value={here} />
                                  <button className={cn("block w-full px-3 py-2 text-left hover:bg-brand-soft", suspended ? "text-success" : "text-danger")}>{suspended ? "Réactiver le compte" : "Suspendre le compte"}</button>
                                </form>
                              )}
                            </div>
                          </details>
                        </div>
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
            <p>Affichage de {nf.format(from)} à {nf.format(to)} sur {nf.format(data.total)} apprenant{data.total > 1 ? "s" : ""}</p>
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

export default function LearnersPage({ searchParams }: { searchParams: SP }) {
  return (
    <Suspense fallback={<div className="h-96 animate-pulse rounded-2xl bg-white" aria-hidden />}>
      <Content searchParams={searchParams} />
    </Suspense>
  );
}
