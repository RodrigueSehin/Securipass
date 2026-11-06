import type { LucideIcon } from "lucide-react";
import { ArrowDown, ArrowUp } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { linePath, monthLabels, niceScale, roleShares, ROLE_META, sparkPoints, type Activity, type Alert, type RoleKey, type Trend } from "@/lib/admin/dashboard";
import { cn } from "@/lib/utils";

const TONES = {
  blue: { box: "bg-brand text-white", stroke: "#2563eb" },
  green: { box: "bg-success text-white", stroke: "#10a875" },
  orange: { box: "bg-cta text-white", stroke: "#f59e0b" },
  purple: { box: "bg-[#7c3aed] text-white", stroke: "#7c3aed" },
  red: { box: "bg-danger text-white", stroke: "#e53935" },
  amber: { box: "bg-warning text-white", stroke: "#f59e0b" },
  teal: { box: "bg-[#0d9488] text-white", stroke: "#0d9488" },
  slate: { box: "bg-[#8b97aa] text-white", stroke: "#8b97aa" },
} as const;
export type Tone = keyof typeof TONES;

function Spark({ values, color }: { values: number[]; color: string }) {
  const w = 84;
  const h = 34;
  const pts = sparkPoints(values, w, h);
  if (pts.length < 2) return null;
  const id = `sp-${color.slice(1)}`;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="h-9 w-[84px] shrink-0" aria-hidden>
      <defs><linearGradient id={id} x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor={color} stopOpacity="0.25" /><stop offset="1" stopColor={color} stopOpacity="0" /></linearGradient></defs>
      <path d={`${linePath(pts)} L${w},${h} L0,${h} Z`} fill={`url(#${id})`} />
      <path d={linePath(pts)} fill="none" stroke={color} strokeWidth="1.8" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

/** Indicateur : pastille d'icône, valeur, évolution, précision et mini-courbe des 12 derniers mois. */
export function StatCard({ icon: Icon, tone, label, value, trend, note, series }: {
  icon: LucideIcon; tone: Tone; label: string; value: string; trend?: Trend | null; note: string; series?: number[];
}) {
  return (
    <div className="flex items-center gap-4 rounded-2xl border border-line bg-white p-5 shadow-card">
      <span className={cn("flex h-14 w-14 shrink-0 items-center justify-center rounded-xl", TONES[tone].box)}><Icon className="h-7 w-7" aria-hidden /></span>
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <p className="truncate text-sm font-semibold text-brand-dark">{label}</p>
          {trend && (
            <span className={cn("inline-flex items-center gap-0.5 text-xs font-bold", trend.up ? "text-success" : "text-danger")}>
              {trend.up ? <ArrowUp className="h-3 w-3" aria-hidden /> : <ArrowDown className="h-3 w-3" aria-hidden />}{trend.text}
            </span>
          )}
        </div>
        <p className="text-2xl font-extrabold leading-tight text-brand-dark">{value}</p>
        <div className="flex items-end justify-between gap-2">
          <p className="text-xs text-muted">{note}</p>
          {series && <Spark values={series} color={TONES[tone].stroke} />}
        </div>
      </div>
    </div>
  );
}

export function Panel({ title, aside, children, className }: { title: React.ReactNode; aside?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <section className={cn("rounded-2xl border border-line bg-white p-5 shadow-card", className)}>
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="text-base font-extrabold text-brand-dark">{title}</h2>
        {aside}
      </div>
      {children}
    </section>
  );
}

export const RangePill = () => <span className="rounded-lg border border-line px-3 py-1 text-xs text-brand-dark">12 derniers mois</span>;

/** Courbe des inscriptions mensuelles (SVG sans bibliothèque). */
export function EnrollmentsChart({ values, now }: { values: number[]; now: number }) {
  const W = 420;
  const H = 190;
  const pad = { l: 34, r: 8, t: 10, b: 24 };
  const { step, top } = niceScale(Math.max(0, ...values));
  const labels = monthLabels(now, values.length);
  const x = (i: number) => pad.l + (i / Math.max(1, values.length - 1)) * (W - pad.l - pad.r);
  const y = (v: number) => pad.t + (1 - v / top) * (H - pad.t - pad.b);
  const pts = values.map((v, i) => [x(i), y(v)] as [number, number]);
  const ticks = Array.from({ length: top / step + 1 }, (_, i) => i * step);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={`Inscriptions par mois sur ${values.length} mois : ${values.join(", ")}`}>
      <defs><linearGradient id="enr-area" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor="#2563eb" stopOpacity="0.22" /><stop offset="1" stopColor="#2563eb" stopOpacity="0" /></linearGradient></defs>
      {ticks.map((t) => (
        <g key={t}>
          <line x1={pad.l} x2={W - pad.r} y1={y(t)} y2={y(t)} stroke="#eef2f7" />
          <text x={pad.l - 6} y={y(t) + 4} textAnchor="end" className="fill-muted" style={{ fontSize: 10 }}>{t}</text>
        </g>
      ))}
      {pts.length > 1 && <path d={`${linePath(pts)} L${x(values.length - 1)},${y(0)} L${x(0)},${y(0)} Z`} fill="url(#enr-area)" />}
      <path d={linePath(pts)} fill="none" stroke="#2563eb" strokeWidth="2" strokeLinejoin="round" />
      {pts.map(([px, py], i) => <circle key={i} cx={px} cy={py} r="3" fill="#2563eb" stroke="#fff" strokeWidth="1.5" />)}
      {labels.map((l, i) => <text key={i} x={x(i)} y={H - 6} textAnchor="middle" className="fill-muted" style={{ fontSize: 10 }}>{l}</text>)}
    </svg>
  );
}

/** Répartition des comptes actifs par profil. */
export function RolesDonut({ roles }: { roles: Record<RoleKey, number> }) {
  const shares = roleShares(roles);
  const total = shares.reduce((n, s) => n + s.count, 0);
  const r = 70;
  const c = 2 * Math.PI * r;
  let offset = 0;
  return (
    <div className="flex flex-wrap items-center justify-center gap-5">
      <svg viewBox="0 0 200 200" className="h-44 w-44 shrink-0" role="img" aria-label={`${total} utilisateurs : ${shares.map((s) => `${ROLE_META[s.key].label} ${s.count}`).join(", ")}`}>
        <circle cx="100" cy="100" r={r} fill="none" stroke="#eef2f7" strokeWidth="26" />
        {total > 0 && shares.map((s) => {
          const len = (s.count / total) * c;
          const el = <circle key={s.key} cx="100" cy="100" r={r} fill="none" stroke={ROLE_META[s.key].color} strokeWidth="26" strokeDasharray={`${len} ${c - len}`} strokeDashoffset={-offset} transform="rotate(-90 100 100)" />;
          offset += len;
          return el;
        })}
        <text x="100" y="100" textAnchor="middle" className="fill-brand-dark" style={{ fontSize: 28, fontWeight: 800 }}>{new Intl.NumberFormat("fr-FR").format(total)}</text>
        <text x="100" y="120" textAnchor="middle" className="fill-muted" style={{ fontSize: 12 }}>utilisateurs</text>
      </svg>
      <dl className="min-w-40 space-y-2 text-sm">
        {shares.map((s) => (
          <div key={s.key} className="flex items-center justify-between gap-4">
            <dt className="flex items-center gap-2 text-brand-dark"><span className="h-2.5 w-2.5 rounded-full" style={{ background: ROLE_META[s.key].color }} aria-hidden />{ROLE_META[s.key].label}</dt>
            <dd className="font-semibold text-brand-dark">{s.percent}%</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

const KIND_TONE: Record<Activity["kind"], string> = {
  Inscription: "bg-success/15 text-success", Formation: "bg-brand-soft text-brand", Certification: "bg-[#ede9fe] text-[#6d28d9]", Utilisateur: "bg-surface text-brand-dark",
};

export function ActivityTable({ rows, format }: { rows: Activity[]; format: (iso: string) => string }) {
  if (rows.length === 0) return <p className="rounded-lg bg-surface p-4 text-sm text-muted">Aucune activité pour le moment.</p>;
  return (
    <div className="overflow-x-auto rounded-xl border border-line">
      <table className="w-full min-w-[34rem] text-left text-sm">
        <thead className="bg-surface text-xs text-brand-dark"><tr>{["Utilisateur", "Action", "Détails", "Date"].map((h) => <th key={h} scope="col" className="px-3 py-2.5 font-semibold">{h}</th>)}</tr></thead>
        <tbody>
          {rows.map((a) => (
            <tr key={a.id} className="border-t border-line">
              <td className="px-3 py-2.5"><div className="flex items-center gap-3"><Avatar name={a.name} src={a.avatar} size={36} /><div><p className="font-bold text-brand-dark">{a.name}</p><p className="text-xs text-muted">{a.role}</p></div></div></td>
              <td className="px-3 py-2.5"><span className={cn("rounded-md px-2.5 py-1 text-xs font-semibold", KIND_TONE[a.kind])}>{a.kind}</span></td>
              <td className="px-3 py-2.5 text-brand-dark">{a.detail}</td>
              <td className="whitespace-nowrap px-3 py-2.5 text-xs text-brand-dark">{format(a.at)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function AlertList({ alerts, icons, when }: { alerts: Alert[]; icons: Record<string, LucideIcon>; when: (iso: string | null) => string }) {
  const tone = { warning: "bg-warning", info: "bg-brand", danger: "bg-danger", success: "bg-success", brand: "bg-[#7c3aed]" } as const;
  if (alerts.length === 0) return <p className="rounded-lg bg-surface p-4 text-sm text-muted">Rien à signaler pour le moment.</p>;
  return (
    <ul className="space-y-4">
      {alerts.map((a) => {
        const Icon = icons[a.key];
        return (
          <li key={a.key} className="flex items-start gap-3">
            <span className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-white", tone[a.tone])}>{Icon && <Icon className="h-5 w-5" aria-hidden />}</span>
            <div className="min-w-0 flex-1"><p className="text-sm font-bold text-brand-dark">{a.title}</p><p className="text-xs text-muted">{a.text}</p></div>
            <span className="shrink-0 text-xs text-muted">{when(a.at)}</span>
          </li>
        );
      })}
    </ul>
  );
}
