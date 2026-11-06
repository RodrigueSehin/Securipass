/** Anneau de progression (SVG). `percent` null affiche « — » sans anneau. */
export function ProgressRing({ percent, label, size = "h-32 w-32" }: { percent: number | null; label: string; size?: string }) {
  const r = 52;
  const c = 2 * Math.PI * r;
  const value = percent ?? 0;
  return (
    <svg viewBox="0 0 128 128" className={`mx-auto ${size}`} role="img" aria-label={percent === null ? `${label} : aucun résultat` : `${label} : ${percent} %`}>
      <circle cx="64" cy="64" r={r} fill="none" stroke="#eef2f7" strokeWidth="12" />
      {percent !== null && (
        <circle cx="64" cy="64" r={r} fill="none" stroke="currentColor" strokeWidth="12" strokeLinecap="round"
          className="text-brand" strokeDasharray={c} strokeDashoffset={c * (1 - value / 100)} transform="rotate(-90 64 64)" />
      )}
      <text x="64" y="71" textAnchor="middle" className="fill-brand-dark" style={{ fontSize: 24, fontWeight: 800 }}>
        {percent === null ? "—" : `${percent} %`}
      </text>
    </svg>
  );
}
