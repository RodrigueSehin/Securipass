import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Building2, CalendarDays, CirclePlus, Clock, Flame, LayoutGrid, MessageSquareQuote, Scale, ShieldCheck } from "lucide-react";
import type { BlogPost } from "@/content/blog";
import { categoryOf } from "@/lib/blog";
import { formatShortDate } from "@/lib/format";
import { publicImage } from "@/lib/images";
import { cn } from "@/lib/utils";

export const CATEGORY_ICONS = {
  shield: ShieldCheck, plus: CirclePlus, flame: Flame, scale: Scale, building: Building2, quote: MessageSquareQuote, all: LayoutGrid,
} as const;

export function PostMeta({ post, className }: { post: BlogPost; className?: string }) {
  return (
    <p className={cn("flex items-center gap-3 text-xs text-muted", className)}>
      <span className="flex items-center gap-1.5"><CalendarDays className="h-3.5 w-3.5" aria-hidden /><time dateTime={post.date}>{formatShortDate(post.date)}</time></span>
      <span className="flex items-center gap-1.5"><Clock className="h-3.5 w-3.5" aria-hidden />{post.readMinutes} min</span>
    </p>
  );
}

export function CategoryBadge({ slug, className }: { slug: BlogPost["category"]; className?: string }) {
  const c = categoryOf(slug);
  const Icon = CATEGORY_ICONS[c.icon];
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-semibold text-white shadow", c.tone, className)}>
      <Icon className="h-3.5 w-3.5" aria-hidden />{c.label}
    </span>
  );
}

/** Photo de l'article ; sans photo déposée, tuile illustrée aux couleurs de la catégorie (jamais d'image inventée). */
export function PostImage({ post, sizes, priority, className }: { post: BlogPost; sizes: string; priority?: boolean; className?: string }) {
  const src = post.image ? publicImage(post.image) : null;
  const c = categoryOf(post.category);
  const Icon = CATEGORY_ICONS[c.icon];
  return (
    <div className={cn("relative overflow-hidden bg-brand-dark", className)}>
      {src ? (
        <Image src={src} alt="" fill sizes={sizes} priority={priority} className="object-cover" aria-hidden />
      ) : (
        <div className={cn("flex h-full w-full items-center justify-center", c.tone)} aria-hidden>
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,#ffffff40,transparent_60%),linear-gradient(135deg,#092a6666,#092a66cc)]" />
          <Icon className="relative h-16 w-16 text-white/90" strokeWidth={1.25} />
        </div>
      )}
    </div>
  );
}

export function PostCard({ post, priority }: { post: BlogPost; priority?: boolean }) {
  const href = `/blog/${post.slug}`;
  return (
    <li className="flex flex-col overflow-hidden rounded-xl border border-line bg-white shadow-card">
      <Link href={href} className="relative block" tabIndex={-1} aria-hidden>
        <PostImage post={post} sizes="(min-width: 1024px) 330px, (min-width: 640px) 50vw, 100vw" priority={priority} className="h-[183px]" />
        <CategoryBadge slug={post.category} className="absolute left-4 top-4" />
      </Link>
      <div className="flex flex-1 flex-col p-4">
        <h3 className="text-[17px] font-bold leading-snug text-brand-dark"><Link href={href} className="hover:text-brand">{post.title}</Link></h3>
        <p className="mt-2 line-clamp-3 text-sm leading-snug text-muted">{post.excerpt}</p>
        <div className="mt-auto flex items-center justify-between gap-2 pt-4">
          <PostMeta post={post} />
          <Link href={href} className="inline-flex shrink-0 items-center gap-1 text-xs font-semibold text-brand hover:underline">Lire la suite <ArrowRight className="h-3.5 w-3.5" aria-hidden /></Link>
        </div>
      </div>
    </li>
  );
}
