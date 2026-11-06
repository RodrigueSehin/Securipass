import { cn } from "@/lib/utils";

export function EmptyState({
  title, children, className,
}: { title: string; children?: React.ReactNode; className?: string }) {
  return (
    <div className={cn("rounded-2xl border border-dashed border-line bg-white p-8 text-center", className)}>
      <p className="font-semibold text-brand-dark">{title}</p>
      {children && <div className="mt-1 text-sm text-muted">{children}</div>}
    </div>
  );
}

export function Alert({
  tone = "error", children,
}: { tone?: "error" | "success" | "info"; children: React.ReactNode }) {
  const tones = { error: "bg-danger/10 text-danger", success: "bg-success/10 text-brand-dark", info: "bg-brand-soft text-brand-dark" };
  return (
    <p role={tone === "error" ? "alert" : "status"} className={cn("rounded-lg p-3 text-sm", tones[tone])}>{children}</p>
  );
}

const BADGE = {
  success: "bg-success/10 text-success",
  warning: "bg-warning/15 text-[#a16207]",
  danger: "bg-danger/10 text-danger",
  info: "bg-brand-soft text-brand",
  neutral: "bg-surface text-muted",
} as const;

export function StatusBadge({ tone = "neutral", children }: { tone?: keyof typeof BADGE; children: React.ReactNode }) {
  return <span className={cn("inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold", BADGE[tone])}>{children}</span>;
}

export function KpiCard({
  label, value, hint,
}: { label: string; value: React.ReactNode; hint?: string }) {
  return (
    <div className="rounded-2xl border border-line bg-white p-5 shadow-card">
      <p className="text-sm text-muted">{label}</p>
      <p className="mt-1 text-3xl font-extrabold text-brand-dark">{value}</p>
      {hint && <p className="mt-1 text-xs text-muted">{hint}</p>}
    </div>
  );
}

export function PageHeader({
  title, description, actions,
}: { title: string; description?: string; actions?: React.ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1 className="text-2xl font-extrabold text-brand-dark">{title}</h1>
        {description && <p className="mt-1 text-sm text-muted">{description}</p>}
      </div>
      {actions}
    </div>
  );
}
