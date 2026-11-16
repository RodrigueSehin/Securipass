import { niceScale } from "@/lib/admin/dashboard";
import { monthShort } from "@/lib/admin/commissions";
import { DONUT_COLORS } from "@/lib/admin/reports";

const nf = new Intl.NumberFormat("fr-FR");

/** Courbe des inscriptions par mois : axe gradué automatiquement, point et valeur du dernier mois. */
export function EnrollmentsChart({ months }: { months: { month: string; count: number }[] }) {
  const W = 520, H = 220, L = 44, R = 20, T = 30, B = 28;
  const max = Math.max(0, ...months.map((m) => m.count));
  const { step, top } = niceScale(max);
  const x = (i: number) => L + (months.length <= 1 ? 0 : (i * (W - L - R)) / (months.length - 1));
  const y = (v: number) => T + (H - T - B) * (1 - v / top);
  const pts = months.map((m, i) => [x(i), y(m.count)] as const);
  const line = pts.map(([px, py], i) => `${i ? "L" : "M"}${px.toFixed(1)},${py.toFixed(1)}`).join(" ");
  const ticks = Array.from({ length: Math.round(top / step) + 1 }, (_, i) => i * step);
  const last = months[months.length - 1];
  const lastPt = pts[pts.length - 1];
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label={`Inscriptions par mois : ${months.map((m) => `${monthShort(m.month)} ${m.count}`).join(", ")}`}>
      <defs><linearGradient id="enr-area" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor="#2563eb" stopOpacity="0.22" /><stop offset="1" stopColor="#2563eb" stopOpacity="0" /></linearGradient></defs>
      {ticks.map((t) => (
        <g key={t}><line x1={L} x2={W - R} y1={y(t)} y2={y(t)} stroke="#e3e9f3" strokeDasharray={t === 0 ? undefined : "3 4"} />
          <text x={L - 8} y={y(t) + 4} textAnchor="end" fontSize="11" fill="#5b6b86">{nf.format(t)}</text></g>
      ))}
      {pts.length > 1 && <path d={`${line} L${lastPt[0]},${y(0)} L${pts[0][0]},${y(0)} Z`} fill="url(#enr-area)" />}
      <path d={line} fill="none" stroke="#2563eb" strokeWidth="2.2" strokeLinejoin="round" strokeLinecap="round" />
      {pts.map(([px, py], i) => <circle key={months[i].month} cx={px} cy={py} r="4" fill="#fff" stroke="#2563eb" strokeWidth="2"><title>{`${monthShort(months[i].month)} : ${months[i].count}`}</title></circle>)}
      {months.map((m, i) => <text key={`l-${m.month}`} x={x(i)} y={H - 8} textAnchor="middle" fontSize="11" fill="#2b3a55">{monthShort(m.month)}</text>)}
      {last && (
        <g transform={`translate(${Math.min(lastPt[0], W - 40)}, ${Math.max(lastPt[1] - 34, 2)})`}>
          <rect x="-24" width="48" height="22" rx="5" fill="#2563eb" /><text x="0" y="15" textAnchor="middle" fontSize="11" fontWeight="700" fill="#fff">{nf.format(last.count)}</text>
        </g>
      )}
    </svg>
  );
}

/** Anneau de répartition des inscriptions par formation, avec le total au centre et la légende (part en %). */
export function CoursesDonut({ items, total }: { items: { label: string; count: number; percent: number }[]; total: number }) {
  const R = 56, C = 2 * Math.PI * R;
  let acc = 0;
  return (
    <div className="flex flex-wrap items-center justify-center gap-6">
      <div className="relative h-48 w-48 shrink-0">
        <svg viewBox="0 0 140 140" className="h-full w-full -rotate-90" role="img" aria-label={`Répartition des ${total} inscriptions : ${items.map((i) => `${i.label} ${i.percent} %`).join(", ")}`}>
          <circle cx="70" cy="70" r={R} fill="none" strokeWidth="22" className="stroke-line" />
          {total > 0 && items.map((it, i) => {
            const len = (it.count / total) * C;
            const el = <circle key={it.label} cx="70" cy="70" r={R} fill="none" strokeWidth="22" stroke={DONUT_COLORS[i % DONUT_COLORS.length]} strokeDasharray={`${len} ${C - len}`} strokeDashoffset={-acc} />;
            acc += len;
            return el;
          })}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center"><span className="text-2xl font-extrabold text-brand-dark">{nf.format(total)}</span><span className="text-xs text-brand-dark">Inscriptions</span></div>
      </div>
      <ul className="min-w-0 flex-1 space-y-2.5 text-sm">
        {items.map((it, i) => (
          <li key={it.label} className="grid grid-cols-[1fr_auto] items-center gap-3 text-brand-dark">
            <span className="flex min-w-0 items-center gap-2"><span className="h-3 w-3 shrink-0 rounded-sm" style={{ backgroundColor: DONUT_COLORS[i % DONUT_COLORS.length] }} aria-hidden /><span className="truncate">{it.label}</span></span>
            <span className="font-semibold">{it.percent} %</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
