import Link from "next/link";
import { ClipboardList, LayoutGrid, MapPin, Megaphone, Palette, Settings } from "lucide-react";
import { cn } from "@/lib/utils";

const TABS = [
  { key: "general", icon: Settings, label: "Général", href: "/admin/parametres/general" },
  { key: "visuel", icon: Palette, label: "Identité visuelle", href: null },
  { key: "localisation", icon: MapPin, label: "Localisation", href: null },
  { key: "fonctionnalites", icon: LayoutGrid, label: "Fonctionnalités", href: null },
  { key: "bande-info", icon: Megaphone, label: "Bande d’info", href: "/admin/parametres/bande-info" },
  { key: "legal", icon: ClipboardList, label: "Informations légales", href: null },
] as const;
export type SettingsTabKey = (typeof TABS)[number]["key"];

/** Onglets des paramètres : seuls ceux dont l'écran existe sont des liens. */
export function SettingsTabs({ current }: { current: SettingsTabKey }) {
  return (
    <nav aria-label="Sections des paramètres" className="flex flex-wrap gap-1 rounded-2xl border border-line bg-white p-2 shadow-card">
      {TABS.map(({ key, icon: Icon, label, href }) => {
        const body = <><Icon className="h-4 w-4" aria-hidden />{label}</>;
        const base = "inline-flex items-center gap-2 rounded-lg px-5 py-2.5 text-sm font-semibold";
        if (!href) return <span key={key} title="Bientôt disponible" className={cn(base, "cursor-not-allowed text-brand-dark opacity-50")}>{body}</span>;
        return <Link key={key} href={href} aria-current={key === current ? "page" : undefined} className={cn(base, key === current ? "bg-brand text-white" : "text-brand-dark hover:bg-brand-soft")}>{body}</Link>;
      })}
    </nav>
  );
}
