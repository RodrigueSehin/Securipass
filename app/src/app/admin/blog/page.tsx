import { Suspense } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight, ChevronLeft, ChevronRight, Eye, FileText, FolderOpen, MoreHorizontal, Newspaper, PenLine, Plus } from "lucide-react";
import { BlogToolbar } from "@/components/admin/blog-toolbar";
import { StatCard } from "@/components/admin/dashboard-widgets";
import { UsersPageSize } from "@/components/admin/users-toolbar";
import { ButtonLink } from "@/components/ui/button";
import { Alert, EmptyState } from "@/components/ui/feedback";
import { percentChange } from "@/lib/admin/dashboard";
import { BLOG_KINDS, BLOG_KIND_TABS, BLOG_STATUS_UI, CATEGORY_LABEL, CATEGORY_TONE, categoryLabel, isRemoteImage, parseBlogFilters, type BlogKind } from "@/lib/admin/blog";
import { setBlogStatus } from "@/lib/admin/blog-actions";
import { loadBlog, loadBlogDrafts, loadBlogStats } from "@/lib/admin/blog-queries";
import { PAGE_SIZES, pageWindow } from "@/lib/admin/users";
import { formatDate } from "@/lib/format";
import { publicImage } from "@/lib/images";
import { cn } from "@/lib/utils";
import { AdminPageHeader } from "@/components/admin/admin-page-header";

export const metadata = { title: "Blog et contenus publics" };

const nf = new Intl.NumberFormat("fr-FR");
const RESULTS: Record<string, string> = { publie: "Le contenu a été publié.", brouillon: "Le contenu est en brouillon.", programme: "La publication du contenu est programmée.", archive: "Le contenu a été archivé." };
const time = (iso: string) => new Intl.DateTimeFormat("fr-FR", { hour: "2-digit", minute: "2-digit", timeZone: "Africa/Abidjan" }).format(new Date(iso));

type SP = Promise<{ q?: string; type?: string; categorie?: string; statut?: string; du?: string; au?: string; page?: string; par?: string; resultat?: string; erreur?: string }>;

async function Content({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const filters = parseBlogFilters(sp);
  const size = PAGE_SIZES.includes(Number(sp.par)) ? Number(sp.par) : PAGE_SIZES[0];
  const requested = Math.max(1, Math.floor(Number(sp.page)) || 1);
  const [stats, drafts, first] = await Promise.all([loadBlogStats(), loadBlogDrafts(), loadBlog(filters, size, (requested - 1) * size)]);
  if (first.failed) return <Alert>Impossible de charger les contenus. Vérifiez que la migration 47 est appliquée, puis réessayez.</Alert>;

  const pages = Math.max(1, Math.ceil(first.total / size));
  const page = Math.min(requested, pages);
  const data = page === requested ? first : await loadBlog(filters, size, (page - 1) * size);
  const from = data.total === 0 ? 0 : (page - 1) * size + 1;
  const to = Math.min(data.total, page * size);

  const href = (over: Record<string, string | number | undefined>) => {
    const u = new URLSearchParams();
    const cur: Record<string, string | number | undefined> = {
      q: filters.q, type: filters.kind, categorie: filters.category, statut: filters.status, du: filters.from, au: filters.to, par: size === PAGE_SIZES[0] ? undefined : size, ...over,
    };
    for (const [k, v] of Object.entries(cur)) if (v !== undefined && v !== "" && v !== 1) u.set(k, String(v));
    return `/admin/blog${u.size ? `?${u}` : ""}`;
  };
  const here = href({ page: page === 1 ? undefined : page });
  const tabs: [string, string, number | undefined][] = [["", "Tous les contenus", stats?.total], ...(Object.keys(BLOG_KIND_TABS) as BlogKind[]).map((k): [string, string, number | undefined] => [k, BLOG_KIND_TABS[k], stats?.kinds[k] ?? 0])];
  const th = "px-3 py-3 font-semibold";
  const cover = (image: string | null) => (image ? (isRemoteImage(image) ? image : publicImage(image)) : null);

  return (
    <div className="space-y-6">
      <AdminPageHeader crumbs={[{ label: "Blog et contenus publics" }]} icon="blog" title="Blog et contenus publics" description="Créez, gérez et publiez des articles, actualités, ressources et contenus pour le grand public." />
      {sp.resultat && RESULTS[sp.resultat] && <Alert tone="success">{RESULTS[sp.resultat]}</Alert>}
      {sp.erreur && <Alert>{sp.erreur}</Alert>}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <StatCard icon={FileText} tone="blue" label="Contenus publiés" value={stats ? nf.format(stats.published.count) : "—"} trend={stats ? percentChange(stats.published.month, stats.published.prev) : null} note={stats ? `+ ${nf.format(stats.published.month)} ce mois-ci` : ""} />
        <StatCard icon={PenLine} tone="orange" label="Brouillons" value={stats ? nf.format(stats.drafts) : "—"} note="" />
        <StatCard icon={Eye} tone="purple" label="Lectures" value={stats ? nf.format(stats.views) : "—"} note="Comptées lorsque le site public lira cette table" />
      </div>

      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_20rem]">
        <section className="rounded-2xl border border-line bg-white p-5 shadow-card">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-line">
            <nav aria-label="Type de contenu" className="flex flex-wrap gap-1">
              {tabs.map(([key, label, count]) => (
                <Link key={key || "all"} href={href({ type: key || undefined, page: 1 })} aria-current={filters.kind === key ? "page" : undefined}
                  className={cn("-mb-px border-b-2 px-3 py-2.5 text-sm font-semibold", filters.kind === key ? "border-brand text-brand" : "border-transparent text-brand-dark hover:text-brand")}>
                  {label}{count !== undefined && ` (${nf.format(count)})`}
                </Link>
              ))}
            </nav>
            <div className="pb-2"><ButtonLink href="/admin/blog/nouveau"><Plus className="h-4 w-4" aria-hidden /> Nouveau contenu</ButtonLink></div>
          </div>
          <BlogToolbar values={filters} hidden={{ ...(filters.kind ? { type: filters.kind } : {}), ...(size !== PAGE_SIZES[0] ? { par: String(size) } : {}) }} />

          {data.total === 0 ? (
            <div className="mt-4"><EmptyState title="Aucun contenu ne correspond"><Link href="/admin/blog" className="font-semibold text-brand hover:underline">Réinitialiser les filtres</Link></EmptyState></div>
          ) : (
            <div className="mt-4 overflow-x-auto rounded-xl border border-line">
              <table className="w-full min-w-[56rem] text-left text-sm">
                <thead className="bg-surface text-xs text-brand-dark"><tr>
                  <th scope="col" className={th}>#</th><th scope="col" className={th}>Titre du contenu</th><th scope="col" className={th}>Catégorie</th><th scope="col" className={th}>Type</th>
                  <th scope="col" className={th}>Statut</th><th scope="col" className={th}>Auteur</th><th scope="col" className={th}>Date de publication</th><th scope="col" className={th}>Lectures</th><th scope="col" className={th}>Actions</th>
                </tr></thead>
                <tbody>
                  {data.rows.map((p, i) => {
                    const st = BLOG_STATUS_UI[p.status];
                    const img = cover(p.image);
                    return (
                      <tr key={p.id} className="border-t border-line">
                        <td className="px-3 py-3 text-muted">{(page - 1) * size + i + 1}</td>
                        <td className="max-w-72 px-3 py-3">
                          <div className="flex items-center gap-3">
                            <span className="relative flex h-14 w-16 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-brand-soft">
                              {img ? <Image src={img} alt="" fill sizes="64px" className="object-cover" unoptimized={isRemoteImage(img)} /> : <Newspaper className="h-5 w-5 text-brand" aria-hidden />}
                            </span>
                            <span className="font-bold text-brand-dark">{p.title}</span>
                          </div>
                        </td>
                        <td className="px-3 py-3"><span className={cn("whitespace-nowrap rounded-md px-2.5 py-1 text-xs font-semibold text-white", CATEGORY_TONE[p.category] ?? "bg-muted")}>{categoryLabel(p.category)}</span></td>
                        <td className="whitespace-nowrap px-3 py-3 text-brand-dark">{BLOG_KINDS[p.kind]}</td>
                        <td className="px-3 py-3"><span className={cn("whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-semibold", st.tone)}>{st.label}</span></td>
                        <td className="whitespace-nowrap px-3 py-3 text-brand-dark">{p.author_name ?? "SECURIPASS"}</td>
                        <td className="whitespace-nowrap px-3 py-3 text-brand-dark">{p.published_at ? <>{formatDate(p.published_at)}<span className="block text-xs text-muted">à {time(p.published_at)}</span></> : "–"}</td>
                        <td className="whitespace-nowrap px-3 py-3 font-semibold text-brand-dark">{nf.format(p.views)}</td>
                        <td className="px-3 py-3">
                          <div className="flex items-center gap-1">
                            {p.status === "published" && <Link href={`/blog/${p.slug}`} target="_blank" aria-label={`Voir « ${p.title} » sur le site`} className="rounded-lg p-2 text-brand hover:bg-brand-soft"><Eye className="h-4 w-4" aria-hidden /></Link>}
                            <details className="relative">
                              <summary aria-label={`Actions pour ${p.title}`} className="flex h-9 w-9 cursor-pointer list-none items-center justify-center rounded-lg text-brand-dark hover:bg-brand-soft [&::-webkit-details-marker]:hidden"><MoreHorizontal className="h-4 w-4" aria-hidden /></summary>
                              <div className="absolute right-0 z-10 mt-1 w-52 rounded-lg border border-line bg-white py-1 text-sm shadow-card">
                                {([p.status !== "published" ? ["published", "Publier", "text-success"] : null, p.status === "published" ? ["draft", "Repasser en brouillon", "text-brand-dark"] : null,
                                  p.status !== "archived" ? ["archived", "Archiver", "text-danger"] : null] as const).map((a) => a && (
                                  <form key={a[0]} action={setBlogStatus}>
                                    <input type="hidden" name="postId" value={p.id} /><input type="hidden" name="status" value={a[0]} /><input type="hidden" name="back" value={here} />
                                    <button className={cn("block w-full px-3 py-2 text-left hover:bg-brand-soft", a[2])}>{a[1]}</button>
                                  </form>
                                ))}
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
              <p>Affichage de {nf.format(from)} à {nf.format(to)} sur {nf.format(data.total)} contenu{data.total > 1 ? "s" : ""}</p>
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

        <aside className="space-y-6">
          <section className="rounded-2xl border border-line bg-white p-5 shadow-card">
            <h2 className="mb-3 flex items-center gap-2 text-lg font-extrabold text-brand-dark"><FolderOpen className="h-5 w-5 text-brand" aria-hidden />Catégories</h2>
            <ul className="space-y-2.5">
              {Object.keys(CATEGORY_LABEL).map((slug) => (
                <li key={slug}><Link href={href({ categorie: slug, page: 1 })} className="flex items-center gap-2.5 text-sm text-brand-dark hover:text-brand">
                  <span className={cn("h-3 w-3 rounded-full", CATEGORY_TONE[slug])} aria-hidden />{CATEGORY_LABEL[slug]} ({nf.format(stats?.categories[slug] ?? 0)})</Link></li>
              ))}
            </ul>
          </section>
          <section className="rounded-2xl border border-line bg-white p-5 shadow-card">
            <h2 className="mb-3 flex items-center gap-2 text-lg font-extrabold text-brand-dark"><FileText className="h-5 w-5 text-brand" aria-hidden />Brouillons récents</h2>
            {drafts.length === 0 ? <p className="text-sm text-muted">Aucun brouillon.</p> : (
              <ul className="space-y-3">
                {drafts.map((d) => (
                  <li key={d.id} className="flex items-start gap-3"><span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-soft text-brand"><FileText className="h-4 w-4" aria-hidden /></span>
                    <div className="min-w-0"><p className="truncate text-sm font-semibold text-brand-dark" title={d.title}>{d.title}</p><p className="text-xs text-muted">Modifié le {formatDate(d.updated_at)}</p></div></li>
                ))}
              </ul>
            )}
            <Link href={href({ statut: "draft", page: 1 })} className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-brand hover:underline">Voir tous les brouillons <ArrowRight className="h-4 w-4" aria-hidden /></Link>
          </section>
        </aside>
      </div>
    </div>
  );
}

export default function BlogAdminPage({ searchParams }: { searchParams: SP }) {
  return (
    <Suspense fallback={<div className="h-96 animate-pulse rounded-2xl bg-white" aria-hidden />}>
      <Content searchParams={searchParams} />
    </Suspense>
  );
}
