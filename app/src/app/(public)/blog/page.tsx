import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { BlogHero } from "@/components/blog/hero";
import { Newsletter } from "@/components/blog/newsletter";
import { CATEGORY_ICONS, PostCard } from "@/components/blog/parts";
import { BlogSidebar } from "@/components/blog/sidebar";
import { EmptyState } from "@/components/ui/feedback";
import { BLOG_CATEGORIES, BLOG_POSTS } from "@/content/blog";
import { blogHref, isCategory, queryPosts } from "@/lib/blog";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Blog" };

type SP = Promise<{ categorie?: string; q?: string; page?: string }>;

// searchParams est une donnée dynamique : elle est lue sous Suspense (règle du projet, cacheComponents).
export default function BlogPage({ searchParams }: { searchParams: SP }) {
  return (
    <Suspense fallback={<div className="mx-auto max-w-[1384px] px-4 py-6" aria-hidden />}>
      <BlogContent searchParams={searchParams} />
    </Suspense>
  );
}

async function BlogContent({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const category = isCategory(sp.categorie) ? sp.categorie : undefined;
  const q = sp.q?.trim().slice(0, 80) || undefined;
  const { items, pages, page } = queryPosts(BLOG_POSTS, { category, q, page: Number(sp.page) });

  const chips = [{ slug: undefined, label: "Tous les articles", icon: "all" as const, tone: "" }, ...BLOG_CATEGORIES.map((c) => ({ slug: c.slug as string | undefined, label: c.label, icon: c.icon, tone: c.tone }))];

  return (
    <>
      <BlogHero />
      <div className="mx-auto max-w-[1384px] px-4 py-6">
        <nav aria-label="Catégories d’articles">
          <ul className="flex gap-3 overflow-x-auto pb-1 lg:grid lg:grid-cols-7 lg:overflow-visible">
            {chips.map((c) => {
              const Icon = CATEGORY_ICONS[c.icon];
              const active = c.slug === category;
              return (
                <li key={c.label} className="min-w-fit lg:min-w-0">
                  <Link href={blogHref({ categorie: c.slug })} aria-current={active ? "page" : undefined}
                    className={cn("flex h-[52px] items-center justify-center gap-2.5 whitespace-nowrap rounded-lg border px-4 text-sm font-medium transition-colors",
                      active ? "border-brand bg-brand text-white shadow-card" : "border-line bg-white text-brand-dark hover:border-brand")}>
                    <span className={cn("flex h-6 w-6 shrink-0 items-center justify-center rounded-full", active ? "text-white" : c.tone ? `${c.tone} text-white` : "text-brand")}>
                      <Icon className="h-3.5 w-3.5" aria-hidden />
                    </span>
                    {c.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="mt-8 grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_314px]">
          <section aria-labelledby="posts-title">
            <h2 id="posts-title" className="text-2xl font-extrabold text-brand-dark">Articles récents</h2>
            <p className="mb-4 mt-1 text-muted">Découvrez nos derniers articles et conseils d’experts.</p>
            {items.length === 0 ? (
              <EmptyState title="Aucun article ne correspond à votre recherche">
                <Link href="/blog" className="font-semibold text-brand hover:underline">Voir tous les articles</Link>
              </EmptyState>
            ) : (
              <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {items.map((p, i) => <PostCard key={p.slug} post={p} priority={i < 3} />)}
              </ul>
            )}

            {pages > 1 && (
              <nav aria-label="Pagination" className="mt-6 flex items-center justify-center gap-2">
                {page > 1 && <Link href={blogHref({ categorie: category, q, page: page - 1 })} aria-label="Page précédente" className="flex h-9 w-9 items-center justify-center rounded-md border border-line bg-white text-brand-dark hover:border-brand"><ChevronLeft className="h-4 w-4" /></Link>}
                {Array.from({ length: pages }, (_, i) => i + 1).map((n) => (
                  <Link key={n} href={blogHref({ categorie: category, q, page: n })} aria-current={n === page ? "page" : undefined}
                    className={cn("flex h-9 w-9 items-center justify-center rounded-md border text-sm font-semibold", n === page ? "border-brand bg-brand text-white" : "border-line bg-white text-brand-dark hover:border-brand")}>{n}</Link>
                ))}
                {page < pages && <Link href={blogHref({ categorie: category, q, page: page + 1 })} aria-label="Page suivante" className="flex h-9 w-9 items-center justify-center rounded-md border border-line bg-white text-brand-dark hover:border-brand"><ChevronRight className="h-4 w-4" /></Link>}
              </nav>
            )}
          </section>
          <BlogSidebar category={category} q={q} />
        </div>

        <div className="mt-8"><Newsletter /></div>
      </div>
    </>
  );
}
