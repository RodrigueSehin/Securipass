import { Suspense } from "react";
import Link from "next/link";
import { Archive, ChevronLeft, ChevronRight, FolderOpen, GraduationCap, MoreHorizontal, Plus, Users } from "lucide-react";
import { CategoryBadge } from "@/components/admin/category-badge";
import { StatCard } from "@/components/admin/dashboard-widgets";
import { CategoriesFilters } from "@/components/admin/categories-toolbar";
import { UsersPageSize } from "@/components/admin/users-toolbar";
import { ButtonLink } from "@/components/ui/button";
import { Alert, EmptyState } from "@/components/ui/feedback";
import { percentChange } from "@/lib/admin/dashboard";
import { CATEGORY_PAGE_SIZES, CATEGORY_STATUS, parseCategoryFilters, type CategoryStatus } from "@/lib/admin/categories";
import { loadCategories, loadCategoryStats } from "@/lib/admin/categories-queries";
import { setCategoryStatus } from "@/lib/admin/categories-actions";
import { pageWindow } from "@/lib/admin/users";
import { cn } from "@/lib/utils";
import { AdminPageHeader } from "@/components/admin/admin-page-header";

export const metadata = { title: "Catégories" };

const nf = new Intl.NumberFormat("fr-FR");
const date = (iso: string) => new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "short", year: "numeric", timeZone: "Africa/Abidjan" }).format(new Date(iso));
const RESULTS: Record<string, string> = { cree: "La catégorie a été créée.", active: "La catégorie a été activée.", attente: "La catégorie a été mise en attente.", inactive: "La catégorie a été désactivée." };
const ACTIONS: Record<CategoryStatus, [CategoryStatus, string, string][]> = {
  active: [["pending", "Mettre en attente", "text-brand-dark"], ["inactive", "Désactiver", "text-danger"]],
  pending: [["active", "Activer", "text-success"], ["inactive", "Désactiver", "text-danger"]],
  inactive: [["active", "Réactiver", "text-success"]],
};

type SP = Promise<{ q?: string; statut?: string; tri?: string; page?: string; par?: string; resultat?: string; erreur?: string }>;

async function Content({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const filters = parseCategoryFilters(sp);
  const size = CATEGORY_PAGE_SIZES.includes(Number(sp.par)) ? Number(sp.par) : CATEGORY_PAGE_SIZES[0];
  const requested = Math.max(1, Math.floor(Number(sp.page)) || 1);
  const [stats, first] = await Promise.all([loadCategoryStats(), loadCategories(filters, size, (requested - 1) * size)]);
  if (first.failed) return <Alert>Impossible de charger les catégories. Vérifiez que la migration 33 est appliquée, puis réessayez.</Alert>;

  const pages = Math.max(1, Math.ceil(first.total / size));
  const page = Math.min(requested, pages);
  const data = page === requested ? first : await loadCategories(filters, size, (page - 1) * size);
  const from = data.total === 0 ? 0 : (page - 1) * size + 1;
  const to = Math.min(data.total, page * size);

  const href = (over: Record<string, string | number | undefined>) => {
    const u = new URLSearchParams();
    const cur: Record<string, string | number | undefined> = {
      q: filters.q, statut: filters.status, tri: filters.sort === "recent" ? undefined : filters.sort, par: size === CATEGORY_PAGE_SIZES[0] ? undefined : size, ...over,
    };
    for (const [k, v] of Object.entries(cur)) if (v !== undefined && v !== "" && v !== 1) u.set(k, String(v));
    return `/admin/categories${u.size ? `?${u}` : ""}`;
  };
  const here = href({ page: page === 1 ? undefined : page });
  const block = (b?: { count: number; month: number; prev: number }) =>
    b ? { value: nf.format(b.count), trend: percentChange(b.month, b.prev), note: b.month === 0 ? "Aucune variation" : `+ ${nf.format(b.month)} ce mois-ci` } : { value: "—", trend: null, note: "" };
  const th = "px-3 py-3 font-semibold";

  return (
    <div className="space-y-6">
      <AdminPageHeader crumbs={[{ label: "Catégories" }]} icon="folder" title="Catégories" description="Gérez les catégories de formations de la plateforme SECURIPASS."
        actions={<>
          <ButtonLink href="/admin/categories/nouveau"><Plus className="h-4 w-4" aria-hidden /> Ajouter une catégorie</ButtonLink>
        </>}
      />
      {sp.resultat && RESULTS[sp.resultat] && <Alert tone="success">{RESULTS[sp.resultat]}</Alert>}
      {sp.erreur && <Alert>{sp.erreur}</Alert>}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard icon={FolderOpen} tone="blue" label="Catégories" {...block(stats?.categories)} />
        <StatCard icon={GraduationCap} tone="green" label="Formations" {...{ ...block(stats?.courses), note: stats ? `Réparties sur ${nf.format(stats.courses.categories)} catégorie${stats.courses.categories > 1 ? "s" : ""}` : "" }} />
        <StatCard icon={Users} tone="amber" label="Apprenants" {...{ ...block(stats?.learners), note: "Inscrits dans ces catégories" }} />
        <StatCard icon={Archive} tone="slate" label="Catégories inactives" value={stats ? nf.format(stats.inactive) : "—"} note="Non visibles sur la plateforme" />
      </div>

      <section className="rounded-2xl border border-line bg-white p-5 shadow-card">
        <CategoriesFilters values={filters} hidden={size !== CATEGORY_PAGE_SIZES[0] ? { par: String(size) } : {}} />

        {data.total === 0 ? (
          <div className="mt-4"><EmptyState title="Aucune catégorie ne correspond"><Link href="/admin/categories" className="font-semibold text-brand hover:underline">Réinitialiser les filtres</Link></EmptyState></div>
        ) : (
          <div className="mt-4 overflow-x-auto rounded-xl border border-line">
            <table className="w-full min-w-[56rem] text-left text-sm">
              <thead className="bg-surface text-xs text-brand-dark">
                <tr>
                  <th scope="col" className="w-12 px-3 py-3 font-semibold">#</th>
                  <th scope="col" className={th}>Nom de la catégorie</th>
                  <th scope="col" className={th}>Description</th>
                  <th scope="col" className={th}>Formations</th>
                  <th scope="col" className={th}>Apprenants</th>
                  <th scope="col" className={th}>Statut</th>
                  <th scope="col" className={th}>Date de création</th>
                  <th scope="col" className={th}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {data.rows.map((c, i) => {
                  const st = CATEGORY_STATUS[c.status] ?? CATEGORY_STATUS.active;
                  return (
                    <tr key={c.id} className="border-t border-line">
                      <td className="px-3 py-3 text-brand-dark">{from + i}</td>
                      <td className="px-3 py-3">
                        <div className="flex items-center gap-3">
                          <CategoryBadge icon={c.icon} color={c.color} />
                          <span className="font-bold text-brand-dark">{c.name}</span>
                        </div>
                      </td>
                      <td className="max-w-xs px-3 py-3 text-brand-dark/80">{c.description || <span className="text-muted">—</span>}</td>
                      <td className="px-3 py-3 text-brand-dark">{nf.format(c.courses)}</td>
                      <td className="px-3 py-3 text-brand-dark">{nf.format(c.learners)}</td>
                      <td className="px-3 py-3"><span className={cn("rounded-md px-3 py-1 text-xs font-semibold", st.tone)}>{st.label}</span></td>
                      <td className="whitespace-nowrap px-3 py-3 text-xs text-brand-dark">{date(c.created_at)}</td>
                      <td className="px-3 py-3">
                        <details className="relative">
                          <summary aria-label={`Actions pour ${c.name}`} className="flex h-9 w-10 cursor-pointer list-none items-center justify-center rounded-lg border border-line text-brand-dark hover:bg-brand-soft [&::-webkit-details-marker]:hidden"><MoreHorizontal className="h-4 w-4" aria-hidden /></summary>
                          <div className="absolute right-0 z-10 mt-1 w-52 rounded-lg border border-line bg-white py-1 text-sm shadow-card">
                            {(ACTIONS[c.status] ?? ACTIONS.active).map(([next, text, tone]) => (
                              <form key={next} action={setCategoryStatus}>
                                <input type="hidden" name="categoryId" value={c.id} />
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
            <p>Affichage de {nf.format(from)} à {nf.format(to)} sur {nf.format(data.total)} catégorie{data.total > 1 ? "s" : ""}</p>
            <nav aria-label="Pagination" className="flex items-center gap-1">
              {page > 1 ? <Link href={href({ page: page - 1 })} aria-label="Page précédente" className="rounded-lg border border-line p-2 hover:bg-brand-soft"><ChevronLeft className="h-4 w-4" aria-hidden /></Link>
                : <span aria-hidden className="rounded-lg border border-line p-2 opacity-40"><ChevronLeft className="h-4 w-4" /></span>}
              {pageWindow(page, pages).map((n, i) => n === "…"
                ? <span key={`e${i}`} className="px-1 text-muted">…</span>
                : <Link key={n} href={href({ page: n })} aria-current={n === page ? "page" : undefined} className={cn("min-w-9 rounded-lg border px-2.5 py-2 text-center font-semibold", n === page ? "border-brand bg-brand text-white" : "border-line hover:bg-brand-soft")}>{n}</Link>)}
              {page < pages ? <Link href={href({ page: page + 1 })} aria-label="Page suivante" className="rounded-lg border border-line p-2 hover:bg-brand-soft"><ChevronRight className="h-4 w-4" aria-hidden /></Link>
                : <span aria-hidden className="rounded-lg border border-line p-2 opacity-40"><ChevronRight className="h-4 w-4" /></span>}
            </nav>
            <UsersPageSize value={size} options={CATEGORY_PAGE_SIZES} hrefs={Object.fromEntries(CATEGORY_PAGE_SIZES.map((n) => [n, href({ par: n === CATEGORY_PAGE_SIZES[0] ? undefined : n, page: 1 })]))} />
          </div>
        )}
      </section>
    </div>
  );
}

export default function CategoriesPage({ searchParams }: { searchParams: SP }) {
  return (
    <Suspense fallback={<div className="h-96 animate-pulse rounded-2xl bg-white" aria-hidden />}>
      <Content searchParams={searchParams} />
    </Suspense>
  );
}
