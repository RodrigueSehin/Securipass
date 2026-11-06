import Link from "next/link";
import { Search } from "lucide-react";
import { BLOG_CATEGORIES, BLOG_POSTS, BLOG_TAGS } from "@/content/blog";
import { blogHref, categoryCounts, popularPosts } from "@/lib/blog";
import { cn } from "@/lib/utils";
import { CATEGORY_ICONS, PostMeta } from "./parts";

const Box = ({ title, children }: { title?: string; children: React.ReactNode }) => (
  <section className="rounded-xl border border-line bg-white p-4 shadow-card">
    {title && <h2 className="mb-3 text-xl font-extrabold text-brand-dark">{title}</h2>}
    {children}
  </section>
);

const POP_TONES = ["bg-cta", "bg-[#1479ff]", "bg-cta", "bg-[#4a5d85]", "bg-success"];

export function BlogSidebar({ category, q }: { category?: string; q?: string }) {
  const counts = categoryCounts(BLOG_POSTS);
  const rows = [{ slug: undefined, label: "Tous les articles", icon: "all" as const, tone: "bg-[#1479ff]", count: BLOG_POSTS.length }, ...BLOG_CATEGORIES.map((c) => ({ slug: c.slug as string | undefined, label: c.label, icon: c.icon, tone: c.tone, count: counts.get(c.slug) ?? 0 }))];
  return (
    <aside className="space-y-4" aria-label="Barre latérale du blog">
      <Box>
        <form action="/blog" role="search" className="relative">
          {category && <input type="hidden" name="categorie" value={category} />}
          <label htmlFor="blog-search" className="sr-only">Rechercher un article</label>
          <input id="blog-search" name="q" type="search" defaultValue={q} placeholder="Rechercher un article…"
            className="w-full rounded-lg border border-line bg-white py-2.5 pl-3 pr-10 text-sm outline-none placeholder:text-muted focus:border-brand focus:ring-2 focus:ring-brand/20" />
          <button type="submit" aria-label="Rechercher" className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-brand-dark"><Search className="h-4 w-4" /></button>
        </form>
      </Box>

      <Box title="Catégories">
        <ul className="space-y-0.5">
          {rows.map((r) => {
            const Icon = CATEGORY_ICONS[r.icon];
            const active = (r.slug ?? undefined) === (category || undefined);
            return (
              <li key={r.label}>
                <Link href={blogHref({ categorie: r.slug })} aria-current={active ? "page" : undefined}
                  className={cn("flex items-center gap-3 rounded-md px-2.5 py-2 text-sm text-brand-dark hover:bg-brand-soft", active && "bg-brand-soft")}>
                  <span className={cn("flex h-5 w-5 items-center justify-center rounded-full text-white", r.tone)}><Icon className="h-3 w-3" aria-hidden /></span>
                  <span className="flex-1">{r.label}</span>
                  <span className="text-xs text-muted">{r.count}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </Box>

      <Box title="Articles populaires">
        <ol className="divide-y divide-line">
          {popularPosts(BLOG_POSTS).map((p, i) => (
            <li key={p.slug} className="flex items-start gap-3 py-3 first:pt-0 last:pb-0">
              <span className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white", POP_TONES[i])}>{i + 1}</span>
              <div className="min-w-0">
                <Link href={`/blog/${p.slug}`} className="text-sm font-bold leading-snug text-brand-dark hover:text-brand">{p.title}</Link>
                <PostMeta post={p} className="mt-1.5" />
              </div>
            </li>
          ))}
        </ol>
      </Box>

      <Box title="Tags populaires">
        <ul className="flex flex-wrap gap-2">
          {BLOG_TAGS.map((t) => (
            <li key={t}><Link href={blogHref({ q: t })} className="inline-block rounded-md bg-brand-soft px-3 py-1.5 text-xs font-medium text-brand hover:bg-brand/10">{t}</Link></li>
          ))}
        </ul>
      </Box>
    </aside>
  );
}
