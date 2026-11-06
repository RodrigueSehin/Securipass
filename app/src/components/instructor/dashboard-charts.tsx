import type { Buckets } from "@/lib/instructor/dashboard";

const W = 600;
const H = 220;
const PAD = { top: 12, right: 8, bottom: 28, left: 36 };

/** Histogramme groupé (inscriptions et certificats par mois), SVG sans bibliothèque. */
export function EvolutionChart({ monthly }: { monthly: { label: string; enrolled: number; certified: number }[] }) {
  const max = Math.max(1, ...monthly.flatMap((m) => [m.enrolled, m.certified]));
  const step = niceStep(max);
  const top = Math.ceil(max / step) * step;
  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;
  const groupW = innerW / Math.max(1, monthly.length);
  const barW = Math.min(18, groupW / 3);
  const y = (v: number) => PAD.top + innerH - (v / top) * innerH;
  const ticks = Array.from({ length: top / step + 1 }, (_, i) => i * step);
  const totals = monthly.reduce((a, m) => ({ enrolled: a.enrolled + m.enrolled, certified: a.certified + m.certified }), { enrolled: 0, certified: 0 });

  return (
    <div>
      <ul className="mb-3 flex flex-wrap gap-4 text-xs text-muted" aria-label="Légende">
        <li className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-brand" aria-hidden />Apprenants inscrits</li>
        <li className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-cta" aria-hidden />Certifications délivrées</li>
      </ul>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img"
        aria-label={`Inscriptions et certifications sur ${monthly.length} mois : ${totals.enrolled} inscriptions, ${totals.certified} certifications`}>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={PAD.left} x2={W - PAD.right} y1={y(t)} y2={y(t)} stroke="#eef2f7" />
            <text x={PAD.left - 6} y={y(t) + 4} textAnchor="end" className="fill-muted" style={{ fontSize: 11 }}>{t}</text>
          </g>
        ))}
        {monthly.map((m, i) => {
          const cx = PAD.left + groupW * i + groupW / 2;
          return (
            <g key={m.label}>
              <rect x={cx - barW - 1} y={y(m.enrolled)} width={barW} height={Math.max(0, PAD.top + innerH - y(m.enrolled))} rx={3} className="fill-brand" />
              <rect x={cx + 1} y={y(m.certified)} width={barW} height={Math.max(0, PAD.top + innerH - y(m.certified))} rx={3} className="fill-cta" />
              <text x={cx} y={H - 8} textAnchor="middle" className="fill-muted" style={{ fontSize: 11 }}>{m.label}</text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

/** Pas « rond » (1, 2, 5 × 10ⁿ) pour une échelle de 4 à 6 graduations environ. */
function niceStep(max: number): number {
  const raw = max / 4;
  const pow = 10 ** Math.floor(Math.log10(raw));
  const n = raw / pow;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * pow;
}

const SEGMENTS = [
  { key: "formation", label: "En formation", color: "text-success" },
  { key: "attente", label: "En attente", color: "text-brand" },
  { key: "certifies", label: "Certifiés", color: "text-warning" },
  { key: "difficulte", label: "En difficulté", color: "text-danger" },
] as const;

/** Répartition des apprenants actifs et en attente, en anneau. */
export function BucketDonut({ buckets }: { buckets: Buckets }) {
  const total = SEGMENTS.reduce((n, s) => n + buckets[s.key], 0);
  const r = 70;
  const c = 2 * Math.PI * r;
  let offset = 0;
  return (
    <div className="flex flex-col items-center gap-6 sm:flex-row sm:justify-center xl:flex-col 2xl:flex-row">
      <svg viewBox="0 0 200 200" className="h-44 w-44 shrink-0" role="img"
        aria-label={`Répartition de ${total} apprenants : ${SEGMENTS.map((s) => `${s.label} ${buckets[s.key]}`).join(", ")}`}>
        <circle cx="100" cy="100" r={r} fill="none" stroke="#eef2f7" strokeWidth="28" />
        {total > 0 && SEGMENTS.map((s) => {
          const len = (buckets[s.key] / total) * c;
          const el = (
            <circle key={s.key} cx="100" cy="100" r={r} fill="none" stroke="currentColor" strokeWidth="28"
              className={s.color} strokeDasharray={`${len} ${c - len}`} strokeDashoffset={-offset} transform="rotate(-90 100 100)" />
          );
          offset += len;
          return el;
        })}
        <text x="100" y="98" textAnchor="middle" className="fill-brand-dark" style={{ fontSize: 26, fontWeight: 800 }}>{total}</text>
        <text x="100" y="118" textAnchor="middle" className="fill-muted" style={{ fontSize: 12 }}>apprenants</text>
      </svg>
      <dl className="w-full max-w-xs space-y-3 text-sm">
        {SEGMENTS.map((s) => (
          <div key={s.key} className="flex items-center justify-between gap-3">
            <dt className="flex items-center gap-2 text-brand-dark">
              <span className={`h-2.5 w-2.5 rounded-full bg-current ${s.color}`} aria-hidden />{s.label}
            </dt>
            <dd className="font-semibold text-brand-dark">
              {buckets[s.key]} <span className="font-normal text-muted">({total === 0 ? 0 : Math.round((buckets[s.key] / total) * 100)} %)</span>
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
