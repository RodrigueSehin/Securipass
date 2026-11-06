import Link from "next/link";
import { Briefcase, Flame, LayoutGrid, Plus, Shield, Siren } from "lucide-react";
import { categoryUi } from "@/content/categories";
import { cn } from "@/lib/utils";

const ICONS = { shield: Shield, cross: Plus, flame: Flame, briefcase: Briefcase, siren: Siren } as const;
const ICON_TONE = { brand: "text-brand", success: "text-success", danger: "text-danger", dark: "text-brand-dark" } as const;

/** Onglets de catégories : chaque lien sélectionne une seule catégorie et conserve les autres filtres. */
export function CategoryTabs({
  categories, selected, hrefFor,
}: {
  categories: { slug: string; name: string }[];
  selected: string[];
  hrefFor: (slug: string | null) => string;
}) {
  const all = selected.length === 0;
  const base = "inline-flex shrink-0 items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-semibold transition-colors";
  return (
    <nav aria-label="Catégories" className="flex gap-2 overflow-x-auto pb-1">
      <Link href={hrefFor(null)} aria-current={all ? "page" : undefined}
        className={cn(base, all ? "border-brand-dark bg-brand-dark text-white" : "border-line bg-white text-brand-dark hover:bg-brand-soft")}>
        <LayoutGrid className="h-4 w-4" aria-hidden />Toutes les formations
      </Link>
      {categories.map((c) => {
        const ui = categoryUi(c.slug, c.name);
        const Icon = ICONS[ui.icon];
        const active = selected.length === 1 && selected[0] === c.slug;
        return (
          <Link key={c.slug} href={hrefFor(c.slug)} aria-current={active ? "page" : undefined}
            className={cn(base, active ? "border-brand-dark bg-brand-dark text-white" : "border-line bg-white text-brand-dark hover:bg-brand-soft")}>
            <Icon className={cn("h-4 w-4", !active && ICON_TONE[ui.tone])} aria-hidden />{ui.label}
          </Link>
        );
      })}
    </nav>
  );
}
