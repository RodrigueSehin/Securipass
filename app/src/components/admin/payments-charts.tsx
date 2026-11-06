import { niceScale } from "@/lib/admin/dashboard";
import { compactAmount, formatShare, KIND_COLOR, PAYMENT_KINDS, type PaymentKind } from "@/lib/admin/payments";
import { formatFcfa } from "@/lib/utils";

/** Courbe des paiements confirmés par mois : axe en millions de FCFA, point et valeur du dernier mois. */
export function PaymentsChart({ months }: { months: { label: string; amount: number }[] }) {
  const W = 620, H = 210, L = 44, R = 18, T = 28, B = 30;
  const max = Math.max(0, ...months.map((m) => m.amount));
  const { step, top } = niceScale(max / 1_000_000 < 4 ? 4_000_000 : max);
  const x = (i: number) => L + (months.length <= 1 ? 0 : (i * (W - L - R)) / (months.length - 1));
  const y = (v: number) => T + (H - T - B) * (1 - v / top);
  const pts = months.map((m, i) => [x(i), y(m.amount)] as const);
  const line = pts.map(([px, py], i) => `${i ? "L" : "M"}${px.toFixed(1)},${py.toFixed(1)}`).join(" ");
  const ticks = Array.from({ length: Math.round(top / step) + 1 }, (_, i) => i * step);
  const last = months[months.length - 1];
  const lastPt = pts[pts.length - 1];
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label={`Paiements confirmés par mois : ${months.map((m) => `${m.label} ${formatFcfa(m.amount)}`).join(", ")}`}>
      <defs><linearGradient id="pay-area" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor="#2563eb" stopOpacity="0.22" /><stop offset="1" stopColor="#2563eb" stopOpacity="0" /></linearGradient></defs>
      {ticks.map((t) => (
        <g key={t}><line x1={L} x2={W - R} y1={y(t)} y2={y(t)} stroke="#e3e9f3" strokeDasharray={t === 0 ? undefined : "3 4"} />
          <text x={L - 8} y={y(t) + 4} textAnchor="end" fontSize="11" fill="#5b6b86">{t === 0 ? "0" : compactAmount(t).replace(" M", " M")}</text></g>
      ))}
      {pts.length > 1 && <path d={`${line} L${lastPt[0]},${y(0)} L${pts[0][0]},${y(0)} Z`} fill="url(#pay-area)" />}
      <path d={line} fill="none" stroke="#2563eb" strokeWidth="2.2" strokeLinejoin="round" strokeLinecap="round" />
      {pts.map(([px, py], i) => <circle key={months[i].label} cx={px} cy={py} r="4" fill="#2563eb" stroke="#fff" strokeWidth="1.5" />)}
      {months.map((m, i) => <text key={`l-${m.label}`} x={x(i)} y={H - 8} textAnchor="middle" fontSize="11" fill="#2b3a55">{m.label}</text>)}
      {last && last.amount > 0 && (
        <g transform={`translate(${Math.min(lastPt[0], W - 70)}, ${Math.max(lastPt[1] - 34, 2)})`}>
          <rect x="-62" width="124" height="22" rx="5" fill="#2563eb" /><text x="0" y="15" textAnchor="middle" fontSize="11" fontWeight="700" fill="#fff">{formatFcfa(last.amount)}</text>
        </g>
      )}
    </svg>
  );
}

/** Répartition des paiements confirmés par type : anneau et légende (part et montant). */
export function KindDonut({ byKind }: { byKind: Record<PaymentKind, number> }) {
  const kinds = Object.keys(PAYMENT_KINDS) as PaymentKind[];
  const total = kinds.reduce((n, k) => n + byKind[k], 0);
  const R = 56, C = 2 * Math.PI * R;
  let acc = 0;
  return (
    <div className="flex flex-wrap items-center gap-6">
      <div className="relative h-44 w-44 shrink-0">
        <svg viewBox="0 0 140 140" className="h-full w-full -rotate-90" role="img" aria-label={`Répartition des paiements confirmés, total ${formatFcfa(total)}`}>
          <circle cx="70" cy="70" r={R} fill="none" strokeWidth="20" className="stroke-line" />
          {total > 0 && kinds.map((k) => {
            const len = (byKind[k] / total) * C;
            const el = <circle key={k} cx="70" cy="70" r={R} fill="none" strokeWidth="20" stroke={KIND_COLOR[k]} strokeDasharray={`${len} ${C - len}`} strokeDashoffset={-acc} />;
            acc += len;
            return el;
          })}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center px-6 text-center"><span className="text-sm font-extrabold leading-tight text-brand-dark">{formatFcfa(total)}</span></div>
      </div>
      <ul className="min-w-0 flex-1 space-y-2.5 text-sm">
        {kinds.map((k) => (
          <li key={k} className="grid grid-cols-[1fr_auto_auto] items-center gap-3 text-brand-dark">
            <span className="flex items-center gap-2"><span className="h-3 w-3 rounded-sm" style={{ backgroundColor: KIND_COLOR[k] }} aria-hidden />{PAYMENT_KINDS[k]}</span>
            <span className="text-right text-muted">{formatShare(byKind[k], total)}</span>
            <span className="min-w-28 text-right font-semibold">{formatFcfa(byKind[k])}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
