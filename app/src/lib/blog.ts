import { BLOG_CATEGORIES, BLOG_PAGE_SIZE, type BlogCategorySlug, type BlogPost } from "@/content/blog";

const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

export function isCategory(slug: string | undefined): slug is BlogCategorySlug {
  return BLOG_CATEGORIES.some((c) => c.slug === slug);
}

export function categoryOf(slug: BlogCategorySlug) {
  return BLOG_CATEGORIES.find((c) => c.slug === slug)!;
}

/** Filtre (catégorie, recherche plein texte titre + résumé), tri du plus récent au plus ancien, puis pagination. */
export function queryPosts(
  posts: readonly BlogPost[],
  { category, q, page = 1 }: { category?: string; q?: string; page?: number },
) {
  const needle = q ? norm(q.trim()) : "";
  const filtered = posts
    .filter((p) => !isCategory(category) || p.category === category)
    .filter((p) => !needle || norm(`${p.title} ${p.excerpt}`).includes(needle))
    .toSorted((a, b) => b.date.localeCompare(a.date));
  const pages = Math.max(1, Math.ceil(filtered.length / BLOG_PAGE_SIZE));
  const current = Math.min(Math.max(1, Math.trunc(page) || 1), pages);
  return { items: filtered.slice((current - 1) * BLOG_PAGE_SIZE, current * BLOG_PAGE_SIZE), total: filtered.length, pages, page: current };
}

export function categoryCounts(posts: readonly BlogPost[]) {
  const counts = new Map<string, number>();
  for (const p of posts) counts.set(p.category, (counts.get(p.category) ?? 0) + 1);
  return counts;
}

export function popularPosts(posts: readonly BlogPost[], limit = 5) {
  return posts.filter((p) => p.popular).toSorted((a, b) => a.popular! - b.popular!).slice(0, limit);
}

/** Construit un lien de la liste en conservant les filtres actifs. */
export function blogHref(params: { categorie?: string; q?: string; page?: number }) {
  const sp = new URLSearchParams();
  if (params.categorie) sp.set("categorie", params.categorie);
  if (params.q) sp.set("q", params.q);
  if (params.page && params.page > 1) sp.set("page", String(params.page));
  const s = sp.toString();
  return s ? `/blog?${s}` : "/blog";
}
