import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ChevronRight } from "lucide-react";
import { CategoryBadge, PostImage, PostMeta } from "@/components/blog/parts";
import { Alert } from "@/components/ui/feedback";
import { BLOG_POSTS } from "@/content/blog";

type Props = { params: Promise<{ slug: string }> };

export function generateStaticParams() {
  return BLOG_POSTS.map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const post = BLOG_POSTS.find((p) => p.slug === slug);
  return post ? { title: post.title, description: post.excerpt } : {};
}

export default async function BlogPostPage({ params }: Props) {
  const { slug } = await params;
  const post = BLOG_POSTS.find((p) => p.slug === slug);
  if (!post) notFound();

  return (
    <article className="mx-auto max-w-3xl px-4 py-10">
      <nav aria-label="Fil d’Ariane" className="flex items-center gap-1.5 text-sm text-muted">
        <Link href="/blog" className="hover:text-brand">Blog</Link><ChevronRight className="h-3.5 w-3.5" aria-hidden />
        <span aria-current="page" className="truncate">{post.title}</span>
      </nav>
      <div className="mt-5"><CategoryBadge slug={post.category} /></div>
      <h1 className="mt-3 text-3xl font-extrabold leading-tight text-brand-dark md:text-4xl">{post.title}</h1>
      <PostMeta post={post} className="mt-3 text-sm" />
      <PostImage post={post} sizes="768px" priority className="mt-6 h-64 rounded-xl md:h-80" />
      <p className="mt-6 text-lg leading-relaxed text-ink">{post.excerpt}</p>
      <div className="mt-6"><Alert tone="info">Le texte complet de cet article sera publié prochainement.</Alert></div>
      <Link href="/blog" className="mt-8 inline-flex items-center gap-2 text-sm font-semibold text-brand hover:underline"><ArrowLeft className="h-4 w-4" aria-hidden />Retour au blog</Link>
    </article>
  );
}
