import { niceScale } from "@/lib/admin/dashboard";
import { monthShort } from "@/lib/admin/commissions";
import { formatFcfa } from "@/lib/utils";

/** Commissions par mois sur 6 mois : histogramme, axe gradué automatiquement. */
export function CommissionsChart({ months }: { months: { month: string; amount: number }[] }) {
  const W = 320, H = 190, L = 46, R = 8, T = 10, B = 26;
  const max = Math.max(0, ...months.map((m) => m.amount));
  const { step, top } = niceScale(max <= 0 ? 4 : max);
  const ticks = Array.from({ length: Math.round(top / step) + 1 }, (_, i) => i * step);
  const slot = (W - L - R) / Math.max(months.length, 1);
  const bar = Math.min(26, slot * 0.6);
  const y = (v: number) => T + (H - T - B) * (1 - v / top);
  const compact = (v: number) => v === 0 ? "0" : new Intl.NumberFormat("fr-FR").format(v);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img"
      aria-label={`Commissions par mois : ${months.map((m) => `${monthShort(m.month)} ${formatFcfa(m.amount)}`).join(", ")}`}>
      {ticks.map((t) => (
        <g key={t}>
          <line x1={L} x2={W - R} y1={y(t)} y2={y(t)} stroke="#e3e9f3" strokeDasharray={t === 0 ? undefined : "3 4"} />
          <text x={L - 6} y={y(t) + 4} textAnchor="end" fontSize="10" fill="#5b6b86">{compact(t)}</text>
        </g>
      ))}
      {months.map((m, i) => {
        const x = L + slot * i + (slot - bar) / 2;
        const h = Math.max(0, y(0) - y(m.amount));
        return (
          <g key={m.month}>
            <rect x={x} y={y(m.amount)} width={bar} height={h} rx="3" fill="#2563eb" fillOpacity={0.45 + 0.55 * ((i + 1) / months.length)}><title>{`${monthShort(m.month)} : ${formatFcfa(m.amount)}`}</title></rect>
            <text x={x + bar / 2} y={H - 8} textAnchor="middle" fontSize="10" fill="#2b3a55">{monthShort(m.month)}</text>
          </g>
        );
      })}
    </svg>
  );
}
