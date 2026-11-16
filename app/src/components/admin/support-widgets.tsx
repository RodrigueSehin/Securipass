import { Award, CalendarDays, ClipboardCheck, CreditCard, FileText, GraduationCap, HelpCircle, Settings, User, Users, type LucideIcon } from "lucide-react";
import { SUPPORT_CATEGORIES, type SupportCategory } from "@/lib/admin/support";
import { cn } from "@/lib/utils";

const nf = new Intl.NumberFormat("fr-FR");

const ICONS: Record<SupportCategory, LucideIcon> = {
  formations: GraduationCap, paiements: CreditCard, certifications: Award, sessions: CalendarDays, compte: User,
  documents: FileText, technique: Settings, utilisateurs: Users, evaluations: ClipboardCheck, autres: HelpCircle,
};

/** Catégorie d'un ticket : pastille d'icône et libellé. */
export function CategoryTag({ category }: { category: SupportCategory }) {
  const Icon = ICONS[category] ?? HelpCircle;
  return (
    <span className="inline-flex items-center gap-2 rounded-lg bg-surface px-2.5 py-1.5 text-xs font-semibold text-brand-dark">
      <Icon className="h-4 w-4 text-brand" aria-hidden />{SUPPORT_CATEGORIES[category] ?? category}
    </span>
  );
}

export const CATEGORY_COLORS = ["#2563eb", "#10a875", "#f59e0b", "#7c3aed", "#5fa8f5", "#c3cbd8"] as const;

/** Anneau de répartition des tickets par catégorie, avec le total au centre et la légende (part en %). */
export function CategoryDonut({ items, total, className }: { items: { key: string; label: string; count: number; percent: number }[]; total: number; className?: string }) {
  const R = 56, C = 2 * Math.PI * R;
  let acc = 0;
  return (
    <div className={cn("flex flex-wrap items-center justify-center gap-5", className)}>
      <div className="relative h-40 w-40 shrink-0">
        <svg viewBox="0 0 140 140" className="h-full w-full -rotate-90" role="img" aria-label={`Répartition des ${total} tickets : ${items.map((i) => `${i.label} ${i.percent} %`).join(", ")}`}>
          <circle cx="70" cy="70" r={R} fill="none" strokeWidth="22" className="stroke-line" />
          {total > 0 && items.map((it, i) => {
            const len = (it.count / total) * C;
            const el = <circle key={it.key} cx="70" cy="70" r={R} fill="none" strokeWidth="22" stroke={CATEGORY_COLORS[i % CATEGORY_COLORS.length]} strokeDasharray={`${len} ${C - len}`} strokeDashoffset={-acc} />;
            acc += len;
            return el;
          })}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center"><span className="text-2xl font-extrabold text-brand-dark">{nf.format(total)}</span><span className="text-xs text-brand-dark">Tickets</span></div>
      </div>
      <ul className="min-w-0 flex-1 space-y-2 text-sm">
        {items.map((it, i) => (
          <li key={it.key} className="grid grid-cols-[1fr_auto] items-center gap-3 text-brand-dark">
            <span className="flex min-w-0 items-center gap-2"><span className="h-3 w-3 shrink-0 rounded-sm" style={{ backgroundColor: CATEGORY_COLORS[i % CATEGORY_COLORS.length] }} aria-hidden /><span className="truncate">{it.label}</span></span>
            <span className="font-semibold">{it.percent} %</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
