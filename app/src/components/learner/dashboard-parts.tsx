import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight, Bell, BookOpen, CalendarDays, Clock, Download, Layers, MapPin, MessageSquare, Shield, ClipboardList, Trophy, BarChart3,
  type LucideIcon,
} from "lucide-react";
import { ShieldMark } from "@/components/ui/logo";
import { StatusBadge } from "@/components/ui/feedback";
import { ProgressRing } from "./progress-ring";
import { relativeTime } from "@/lib/format";
import { categoryOf } from "@/lib/notifications/categories";
import { cn } from "@/lib/utils";

/** Bandeau d'accueil : photo, salutation avec le nom en orange, devise. */
export function Hero({ name, image }: { name: string; image: string | null }) {
  return (
    <section className="relative overflow-hidden rounded-2xl bg-brand-dark text-white">
      {image && <Image src={image} alt="" fill priority sizes="(min-width: 1280px) 60vw, 100vw" className="object-cover object-right" />}
      <div className="absolute inset-0 bg-[linear-gradient(90deg,#071a45_0%,rgba(7,26,69,0.88)_45%,rgba(7,26,69,0.15)_100%)]" aria-hidden />
      <div className="relative flex min-h-44 flex-col justify-center gap-3 p-6 md:p-8">
        <h1 className="text-2xl font-extrabold md:text-4xl">
          Bonjour, <span className="text-cta">{name}</span> <span aria-hidden>👋</span>
        </h1>
        <p className="max-w-md text-sm text-white/90 md:text-base">Poursuivez vos formations et développez vos compétences en sécurité.</p>
        <p className="mt-2 max-w-xs self-end text-right text-xs italic text-white/80 md:absolute md:bottom-5 md:right-6 md:mt-0">
          « La sécurité aujourd’hui, un avenir plus sûr demain. »
        </p>
      </div>
    </section>
  );
}

export function StatTile({ icon: Icon, tone, value, label, href, linkLabel }: {
  icon: LucideIcon; tone: string; value: number; label: string; href: string; linkLabel: string;
}) {
  return (
    <div className="rounded-2xl border border-line bg-white p-5 shadow-card">
      <div className="flex items-center gap-4">
        <span className={cn("flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-white", tone)}>
          <Icon className="h-6 w-6" aria-hidden />
        </span>
        <span>
          <span className="block text-3xl font-extrabold leading-none text-brand-dark">{value}</span>
          <span className="mt-1 block text-sm text-muted">{label}</span>
        </span>
      </div>
      <Link href={href} className="mt-4 inline-flex items-center gap-1 text-xs font-semibold text-brand hover:underline">
        {linkLabel} <ArrowRight className="h-3 w-3" aria-hidden />
      </Link>
    </div>
  );
}

export function Panel({ title, action, className, children }: {
  title: string; action?: { href: string; label: string }; className?: string; children: React.ReactNode;
}) {
  return (
    <section className={cn("rounded-2xl border border-line bg-white p-5", className)}>
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-lg font-bold text-brand-dark">{title}</h2>
        {action && (
          <Link href={action.href} className="flex shrink-0 items-center gap-1 text-sm font-semibold text-brand hover:underline">
            {action.label} <ArrowRight className="h-3.5 w-3.5" aria-hidden />
          </Link>
        )}
      </div>
      {children}
    </section>
  );
}

export function CourseCard({ title, href, cover, percent, modules, doneHours, totalHours, showProgress = true }: {
  title: string; href: string; cover: string | null; percent: number; modules: number; doneHours: string; totalHours: string; showProgress?: boolean;
}) {
  return (
    <article className="flex flex-col overflow-hidden rounded-xl border border-line bg-white">
      <div className="relative h-32 bg-[linear-gradient(135deg,#092a66,#0639d9)]">
        {cover ? (
          <Image src={cover} alt="" fill sizes="(min-width: 1280px) 20vw, 50vw" className="object-cover" unoptimized={cover.startsWith("http")} />
        ) : (
          <BookOpen className="absolute inset-0 m-auto h-10 w-10 text-white/80" aria-hidden />
        )}
        {showProgress && <span className="absolute right-2 top-2 rounded-full bg-white px-2.5 py-0.5 text-xs font-bold text-brand-dark shadow">{percent}%</span>}
      </div>
      <div className="flex flex-1 flex-col p-4">
        <h3 className="font-bold text-brand-dark">{title}</h3>
        <p className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted">
          <span className="flex items-center gap-1"><Layers className="h-3.5 w-3.5 text-brand" aria-hidden />{modules} module{modules > 1 ? "s" : ""}</span>
          <span className="flex items-center gap-1"><Clock className="h-3.5 w-3.5 text-brand" aria-hidden />{doneHours}/{totalHours} heures</span>
        </p>
        {showProgress && (
          <>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-surface" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent} aria-label={`Progression : ${percent} %`}>
              <div className="h-full rounded-full bg-brand" style={{ width: `${percent}%` }} />
            </div>
            <p className="mt-1.5 text-xs text-muted">Progression : {percent}%</p>
          </>
        )}
        <Link href={href} className="mt-3 flex items-center justify-center gap-2 rounded-lg bg-cta px-4 py-2.5 text-sm font-semibold text-white hover:bg-cta-dark">
          Continuer la formation <ArrowRight className="h-4 w-4" aria-hidden />
        </Link>
      </div>
    </article>
  );
}

export type Deadline = { key: string; kind: "evaluation" | "session" | "certificate"; title: string; subtitle: string; href: string; chip: string };

const DEADLINE_ICON: Record<Deadline["kind"], { icon: LucideIcon; tone: string }> = {
  evaluation: { icon: ClipboardList, tone: "bg-danger/10 text-danger" },
  session: { icon: CalendarDays, tone: "bg-cta/10 text-cta" },
  certificate: { icon: Shield, tone: "bg-success/10 text-success" },
};

export function DeadlineList({ items }: { items: Deadline[] }) {
  if (items.length === 0) return <p className="text-sm text-muted">Aucune échéance à venir.</p>;
  return (
    <ul className="divide-y divide-line">
      {items.map((d) => {
        const { icon: Icon, tone } = DEADLINE_ICON[d.kind];
        return (
          <li key={d.key}>
            <Link href={d.href} className="flex items-center gap-3 py-3 hover:bg-surface/60">
              <span className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-full", tone)}><Icon className="h-5 w-5" aria-hidden /></span>
              <span className="min-w-0 flex-1">
                <span className="block truncate font-semibold text-brand-dark">{d.title}</span>
                <span className="block truncate text-xs text-muted">{d.subtitle}</span>
              </span>
              <span className="shrink-0 rounded-full bg-cta/10 px-2.5 py-1 text-xs font-semibold text-cta">{d.chip}</span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

/** Aperçu miniature d'un certificat (cadre doré, emblème, QR) : décoratif, sans mention « spécimen » car le certificat est réel. */
function CertificateThumb() {
  return (
    <span className="relative flex h-24 w-32 shrink-0 flex-col items-center justify-center rounded border-2 border-gold bg-[#fffdf7] p-1 shadow-sm" aria-hidden>
      <ShieldMark className="h-6 w-5" />
      <span className="mt-0.5 text-[8px] font-extrabold tracking-wide text-brand-dark">SECURI<span className="text-cta">PASS</span></span>
      <span className="mt-0.5 text-[6px] font-bold tracking-widest text-brand-dark">CERTIFICAT</span>
      <span className="mt-1 h-0.5 w-14 rounded bg-line" />
      <span className="mt-1 h-0.5 w-10 rounded bg-line" />
    </span>
  );
}

export type CertificateItem = { id: string; title: string; issued: string; statusLabel: string; tone: "success" | "warning" | "danger"; detailHref: string; pdfHref: string };

export function CertificateList({ items }: { items: CertificateItem[] }) {
  if (items.length === 0) return <p className="text-sm text-muted">Aucun certificat pour le moment.</p>;
  return (
    <ul className="space-y-4">
      {items.map((c) => (
        <li key={c.id} className="flex gap-4">
          <CertificateThumb />
          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-2">
              <h3 className="font-bold text-brand-dark">{c.title}</h3>
              <StatusBadge tone={c.tone}>{c.statusLabel}</StatusBadge>
            </div>
            <p className="text-xs text-muted">Obtenu le {c.issued}</p>
            <p className="text-xs text-muted">Certificat de fin de formation</p>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <a href={c.pdfHref} className="flex items-center justify-center gap-1.5 rounded-lg bg-brand px-3 py-2 text-xs font-semibold text-white hover:bg-brand-dark">
                <Download className="h-3.5 w-3.5" aria-hidden /> Télécharger
              </a>
              <Link href={c.detailHref} className="flex items-center justify-center rounded-lg border border-line px-3 py-2 text-xs font-semibold text-brand hover:bg-brand-soft">Voir détails</Link>
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}

export function Journey({ percent, running, completed, certificates }: { percent: number; running: number; completed: number; certificates: number }) {
  return (
    <Panel title="Mon parcours">
      <div className="flex items-center gap-4">
        <ProgressRing percent={percent} label="Progression globale" size="h-28 w-28 shrink-0" />
        <dl className="space-y-2 text-sm">
          {[[running, "formations en cours"], [completed, completed > 1 ? "formations terminées" : "formation terminée"], [certificates, certificates > 1 ? "certificats obtenus" : "certificat obtenu"]].map(([n, l]) => (
            <div key={String(l)} className="flex items-baseline gap-2">
              <dt className="sr-only">{l}</dt>
              <dd className="text-xl font-extrabold text-brand">{n}</dd>
              <span className="text-muted" aria-hidden>{l}</span>
            </div>
          ))}
        </dl>
      </div>
      <Link href="/app/profil" className="mt-4 flex items-center justify-center gap-2 rounded-lg bg-brand px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-dark">
        Voir mon profil complet <ArrowRight className="h-4 w-4" aria-hidden />
      </Link>
    </Panel>
  );
}

export type CalendarItem = { id: string; day: string; month: string; title: string; time: string; place: string | null };

export function CalendarList({ items }: { items: CalendarItem[] }) {
  if (items.length === 0) return <p className="text-sm text-muted">Aucune session planifiée.</p>;
  return (
    <ul className="divide-y divide-line">
      {items.map((e) => (
        <li key={e.id} className="flex gap-3 py-3 first:pt-0 last:pb-0">
          <span className="flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-xl bg-brand-soft leading-tight text-brand-dark">
            <span className="text-xl font-extrabold">{e.day}</span>
            <span className="text-xs font-semibold">{e.month}</span>
          </span>
          <span className="min-w-0">
            <span className="block truncate font-semibold text-brand-dark">{e.title}</span>
            <span className="flex items-center gap-1 text-xs text-muted"><Clock className="h-3.5 w-3.5" aria-hidden />{e.time}</span>
            {e.place && <span className="flex items-center gap-1 text-xs text-muted"><MapPin className="h-3.5 w-3.5" aria-hidden />{e.place}</span>}
          </span>
        </li>
      ))}
    </ul>
  );
}

const ACTIVITY_ICON: Record<string, { icon: LucideIcon; tone: string }> = {
  formations: { icon: BookOpen, tone: "bg-success text-white" },
  evaluations: { icon: BarChart3, tone: "bg-brand text-white" },
  certificats: { icon: Trophy, tone: "bg-[#7c3aed] text-white" },
  messages: { icon: MessageSquare, tone: "bg-brand text-white" },
  other: { icon: Bell, tone: "bg-cta text-white" },
};

export type ActivityItem = { id: string; kind: string; title: string; body: string | null; at: string };

export function ActivityList({ items, now }: { items: ActivityItem[]; now: number }) {
  if (items.length === 0) return <p className="text-sm text-muted">Aucune activité pour le moment.</p>;
  return (
    <ul className="space-y-4">
      {items.map((a) => {
        const { icon: Icon, tone } = ACTIVITY_ICON[categoryOf(a.kind) ?? "other"];
        return (
          <li key={a.id} className="flex gap-3">
            <span className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-full", tone)}><Icon className="h-5 w-5" aria-hidden /></span>
            <span className="min-w-0 flex-1">
              <span className="flex items-start justify-between gap-2">
                <span className="truncate text-sm font-semibold text-brand-dark">{a.title}</span>
                <span className="shrink-0 text-[11px] text-muted">{relativeTime(a.at, now)}</span>
              </span>
              {a.body && <span className="block truncate text-xs text-muted">{a.body}</span>}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
