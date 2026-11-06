import { Building2, GraduationCap, UsersRound } from "lucide-react";
import { buildStatItems } from "@/lib/stats-items";
import type { PublicStats } from "@/lib/stats-types";

const ICONS = { learners: UsersRound, courses: GraduationCap, companies: Building2 } as const;
const fmt = (n: number) => new Intl.NumberFormat("fr-FR").format(n);

/** Bandeau de chiffres clés : totaux réels uniquement (règles dans buildStatItems). */
export function StatsBand({ stats }: { stats: PublicStats }) {
  const items = buildStatItems(stats);
  if (items.length === 0) return null;
  return (
    <section aria-label="Chiffres clés" className="mx-auto max-w-7xl px-4">
      <ul className="grid divide-y divide-line rounded-2xl bg-brand-soft/70 px-4 py-2 sm:grid-cols-[repeat(auto-fit,minmax(0,1fr))] sm:divide-x sm:divide-y-0">
        {items.map(({ key, value, label }) => {
          const Icon = ICONS[key];
          return (
            <li key={key} className="flex items-center justify-center gap-4 px-4 py-4">
              <Icon className="h-10 w-10 text-brand" strokeWidth={1.6} aria-hidden />
              <span>
                <span className="block text-3xl font-extrabold leading-none text-brand-dark">{fmt(value)}</span>
                <span className="mt-1 block text-sm text-muted">{label}</span>
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
