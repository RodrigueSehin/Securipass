import Image from "next/image";
import Link from "next/link";
import { Award, BookOpen, Building2, CalendarCheck, CalendarDays, ClipboardCheck, CreditCard, FileText, FolderOpen, GraduationCap, Home, Newspaper, UserPlus, Users, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/** Pictogrammes disponibles pour l'en-tête (clé courte → icône). */
const ICONS: Record<string, LucideIcon> = {
  users: Users, "user-plus": UserPlus, building: Building2, folder: FolderOpen, calendar: CalendarDays, "calendar-check": CalendarCheck, formation: GraduationCap,
  evaluation: ClipboardCheck, award: Award, blog: Newspaper, document: FileText, book: BookOpen, payment: CreditCard,
};
export type AdminHeaderIcon = keyof typeof ICONS;

export type Crumb = { label: string; href?: string };

/**
 * En-tête des pages d'administration : fil d'Ariane, pictogramme, titre et sous-titre sur un bandeau clair avec le siège de SECURIPASS à droite.
 * Le dernier élément du fil d'Ariane est la page courante ; `actions` s'affichent à droite, au-dessus de l'image.
 */
export function AdminPageHeader({ crumbs, icon, title, description, actions, className }: {
  crumbs: Crumb[]; icon: AdminHeaderIcon; title: string; description?: string; actions?: React.ReactNode; className?: string;
}) {
  const Icon = ICONS[icon] ?? FileText;
  return (
    <header className={cn("relative overflow-hidden rounded-2xl border border-line bg-gradient-to-r from-white via-[#f3f7ff] to-[#d9e8ff]", className)}>
      <div aria-hidden className="pointer-events-none absolute inset-y-0 right-0 hidden w-[46%] md:block" style={{ maskImage: "linear-gradient(to right, transparent, black 38%)", WebkitMaskImage: "linear-gradient(to right, transparent, black 38%)" }}>
        <Image src="/images/banners/admin-header.webp" alt="" fill sizes="(min-width: 1280px) 560px, 40vw" className="object-cover object-left" />
      </div>
      <div className="relative px-5 py-4">
        <nav aria-label="Fil d’Ariane" className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-brand-dark">
          <Link href="/admin" aria-label="Administration" className="text-brand-dark hover:text-brand"><Home className="h-4 w-4" aria-hidden /></Link>
          {crumbs.map((c, i) => (
            <span key={`${c.label}-${i}`} className="flex items-center gap-2">
              <span aria-hidden className="text-muted">/</span>
              {c.href && i < crumbs.length - 1 ? <Link href={c.href} className="hover:underline">{c.label}</Link> : <span aria-current="page" className="font-bold text-brand">{c.label}</span>}
            </span>
          ))}
        </nav>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-4">
          <div className="flex min-w-0 items-center gap-4">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-brand text-white shadow-card"><Icon className="h-6 w-6" aria-hidden /></span>
            <div className="min-w-0">
              <h1 className="text-3xl font-extrabold leading-tight text-brand-dark">{title}</h1>
              {description && <p className="mt-0.5 text-brand-dark/85">{description}</p>}
            </div>
          </div>
          {actions && <div className="relative flex flex-wrap gap-2">{actions}</div>}
        </div>
      </div>
    </header>
  );
}
