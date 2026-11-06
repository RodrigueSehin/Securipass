"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Home, LayoutGrid, BookOpen, ListChecks, ClipboardCheck, Trophy, IdCard, CreditCard, Bell,
  MessageSquare, FileText, User, Calendar, Users, BarChart3, Settings, Menu, X, Headphones,
  Building2, GraduationCap, UserCheck, Receipt, Coins, Newspaper, ScrollText,
} from "lucide-react";
import { Logo } from "@/components/ui/logo";
import { cn } from "@/lib/utils";
import type { AreaNav } from "@/config/navigation";

const ICONS = {
  home: Home, grid: LayoutGrid, book: BookOpen, list: ListChecks, check: ClipboardCheck, trophy: Trophy,
  id: IdCard, card: CreditCard, bell: Bell, message: MessageSquare, file: FileText, user: User,
  calendar: Calendar, users: Users, chart: BarChart3, settings: Settings, support: Headphones,
  building: Building2, grad: GraduationCap, presence: UserCheck, receipt: Receipt, coins: Coins, news: Newspaper, log: ScrollText,
} as const;

/** Pastilles affichées à droite d'un lien de la barre latérale, par adresse (éléments serveur passés par la mise en page). */
type Badges = Record<string, React.ReactNode>;

/** Aide et mentions, en bas de la barre latérale. */
function SidebarFooter() {
  return (
    <div className="space-y-3 border-t border-line p-4">
      <div className="rounded-xl bg-brand-soft p-3">
        <p className="flex items-center gap-2 text-sm font-bold text-brand-dark"><Headphones className="h-4 w-4 text-brand" aria-hidden />Besoin d’aide ?</p>
        <p className="mt-1 text-xs text-muted">Notre équipe est à votre écoute.</p>
        <Link href="/contact" className="mt-2 block rounded-lg border border-brand bg-white px-3 py-1.5 text-center text-sm font-semibold text-brand hover:bg-brand-soft">Contacter le support</Link>
      </div>
      <p className="text-[11px] leading-snug text-muted">© 2026 SECURIPASS<br />Tous droits réservés.</p>
    </div>
  );
}

function isActive(nav: AreaNav, pathname: string | null, href: string) {
  if (!pathname) return false;
  return href === nav.home ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);
}

/** Liste des liens. `pathname` est null pendant le rendu statique (aucun lien actif). */
function NavList({ nav, pathname, onNavigate, badges }: { nav: AreaNav; pathname: string | null; onNavigate?: () => void; badges?: Badges }) {
  return (
    <nav aria-label={nav.title} className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
      {nav.items.map((item) => {
        const Icon = ICONS[item.icon as keyof typeof ICONS] ?? Home;
        const base = "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium";
        if (item.soon) {
          return (
            <span key={item.href} aria-disabled="true" title="Bientôt disponible" className={cn(base, "cursor-not-allowed text-muted/60")}>
              <Icon className="h-[18px] w-[18px]" aria-hidden />
              <span className="flex-1">{item.label}</span>
              <span className="rounded bg-surface px-1.5 py-0.5 text-[10px] font-semibold text-muted">Bientôt</span>
            </span>
          );
        }
        const active = isActive(nav, pathname, item.href);
        return (
          <Link
            key={item.href} href={item.href} onClick={onNavigate} aria-current={active ? "page" : undefined}
            className={cn(base, active ? "bg-brand text-white" : "text-brand-dark hover:bg-brand-soft")}
          >
            <Icon className="h-[18px] w-[18px]" aria-hidden />
            <span className="flex-1">{item.label}</span>
            {badges?.[item.href]}
          </Link>
        );
      })}
    </nav>
  );
}

function ActiveNavList({ nav, onNavigate, badges }: { nav: AreaNav; onNavigate?: () => void; badges?: Badges }) {
  const pathname = usePathname();
  return <NavList nav={nav} pathname={pathname} onNavigate={onNavigate} badges={badges} />;
}

function Menu_({ nav, onNavigate, badges }: { nav: AreaNav; onNavigate?: () => void; badges?: Badges }) {
  return (
    <Suspense fallback={<NavList nav={nav} pathname={null} badges={badges} />}>
      <ActiveNavList nav={nav} onNavigate={onNavigate} badges={badges} />
    </Suspense>
  );
}

export function AppShell({ nav, userSlot, searchSlot, badges, children }: { nav: AreaNav; userSlot: React.ReactNode; searchSlot?: React.ReactNode; badges?: Badges; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="flex min-h-screen bg-surface">
      {/* Barre latérale (ordinateur) */}
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r border-line bg-white lg:flex">
        <div className="border-b border-line px-5 py-4"><Logo /></div>
        <Menu_ nav={nav} badges={badges} />
        <SidebarFooter />
      </aside>

      {/* Tiroir (mobile / tablette) */}
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Menu">
          <button className="absolute inset-0 bg-black/40" aria-label="Fermer le menu" onClick={() => setOpen(false)} />
          <aside className="relative flex h-full w-72 max-w-[85%] flex-col bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-line px-5 py-4">
              <Logo />
              <button onClick={() => setOpen(false)} aria-label="Fermer le menu" className="rounded p-1 hover:bg-brand-soft"><X className="h-5 w-5" /></button>
            </div>
            <Menu_ nav={nav} onNavigate={() => setOpen(false)} badges={badges} />
            <SidebarFooter />
          </aside>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-3 border-b border-line bg-white px-4">
          <button onClick={() => setOpen(true)} aria-label="Ouvrir le menu" className="rounded p-2 hover:bg-brand-soft lg:hidden">
            <Menu className="h-5 w-5" />
          </button>
          {searchSlot ?? <p className="hidden text-sm font-semibold text-brand-dark lg:block">{nav.title}</p>}
          <div className="ml-auto">{userSlot}</div>
        </header>
        <main className="flex-1 p-4 md:p-6">{children}</main>
      </div>
    </div>
  );
}
