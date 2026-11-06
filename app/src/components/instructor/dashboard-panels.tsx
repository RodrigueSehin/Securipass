import Image from "next/image";
import Link from "next/link";
import { Award, BookOpen, ClipboardList, UserX, type LucideIcon } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/feedback";
import { ProgressRing } from "@/components/learner/progress-ring";
import { COURSE_STATUS, SESSION_STATUS, type CourseStatus } from "@/lib/courses/labels";
import type { DashboardData } from "@/lib/instructor/dashboard-data";
import { relativeTime } from "@/lib/instructor/dashboard";
import { formatShortDate, formatTimeRange } from "@/lib/format";
import { cn } from "@/lib/utils";

type Course = DashboardData["courses"][number];
type Session = DashboardData["sessions"][number];

/** Indicateur à icône. Sans `href`, la tuile n'est pas un lien (aucune destination à ce stade). */
export function KpiTile({ href, icon: Icon, value, label, tone }: {
  href?: string; icon: LucideIcon; value: number; label: string; tone: string;
}) {
  const className = cn("flex items-center gap-4 rounded-2xl border border-line bg-white p-5 shadow-card", href && "hover:border-brand/40");
  const content = (
    <>
      <span className={cn("flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-white", tone)}>
        <Icon className="h-6 w-6" aria-hidden />
      </span>
      <span>
        <span className="block text-3xl font-extrabold text-brand-dark">{value}</span>
        <span className="block text-sm text-muted">{label}</span>
      </span>
    </>
  );
  return href ? <Link href={href} className={className}>{content}</Link> : <div className={className}>{content}</div>;
}

function ProgressBar({ percent }: { percent: number }) {
  return (
    <div className="h-2 w-24 overflow-hidden rounded-full bg-surface" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent} aria-label={`Progression ${percent} %`}>
      <div className="h-full rounded-full bg-brand" style={{ width: `${percent}%` }} />
    </div>
  );
}

export function Panel({ title, action, className, children }: {
  title: string; action?: { href: string; label: string }; className?: string; children: React.ReactNode;
}) {
  return (
    <section className={cn("rounded-2xl border border-line bg-white p-5", className)}>
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="font-bold text-brand-dark">{title}</h2>
        {action && <Link href={action.href} className="shrink-0 text-sm font-semibold text-brand hover:underline">{action.label} →</Link>}
      </div>
      {children}
    </section>
  );
}

export function PerformancePanel({ performance }: { performance: DashboardData["performance"] }) {
  return (
    <Panel title="Performance globale">
      <div className="grid grid-cols-3 gap-2 text-center">
        <Gauge value={performance.success} label="Taux de réussite" />
        <Gauge value={performance.completion} label="Taux de complétion" />
        <div>
          <p className="text-3xl font-extrabold text-brand-dark">{performance.activeLearners}</p>
          <p className="mt-2 text-xs text-muted">Apprenants actifs<br />(30 derniers jours)</p>
        </div>
      </div>
    </Panel>
  );
}

function Gauge({ value, label }: { value: number | null; label: string }) {
  return (
    <div>
      <ProgressRing percent={value} label={label} size="h-20 w-20" />
      <p className="mt-1 text-xs text-muted">{label}</p>
    </div>
  );
}

export function CoursesPanel({ courses }: { courses: Course[] }) {
  return (
    <Panel title="Mes formations" action={{ href: "/formateur/formations", label: "Voir toutes" }} className="overflow-hidden">
      {courses.length === 0 ? (
        <p className="text-sm text-muted">Vous n’avez pas encore de formation. <Link href="/formateur/formations/nouveau" className="font-semibold text-brand hover:underline">En créer une</Link></p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[32rem] text-left text-sm">
            <thead className="text-xs text-muted">
              <tr>
                <th scope="col" className="pb-2 font-semibold">Formation</th>
                <th scope="col" className="pb-2 font-semibold">Apprenants</th>
                <th scope="col" className="pb-2 font-semibold">Progression</th>
                <th scope="col" className="pb-2 font-semibold">Statut</th>
                <th scope="col" className="pb-2"><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {courses.slice(0, 4).map((c) => (
                <tr key={c.id}>
                  <td className="py-3 pr-3">
                    <div className="flex items-center gap-3">
                      <CourseThumb src={c.cover} />
                      <span className="font-medium text-brand-dark">{c.title}</span>
                    </div>
                  </td>
                  <td className="py-3 pr-3 text-brand-dark">{c.learners}</td>
                  <td className="py-3 pr-3"><div className="flex items-center gap-2"><ProgressBar percent={c.percent} /><span className="text-xs text-muted">{c.percent} %</span></div></td>
                  <td className="py-3 pr-3">
                    <StatusBadge tone={COURSE_STATUS[c.status as CourseStatus]?.tone ?? "neutral"}>{COURSE_STATUS[c.status as CourseStatus]?.label ?? c.status}</StatusBadge>
                  </td>
                  <td className="py-3 text-right">
                    <ButtonLink href={`/formateur/formations/${c.id}`} variant="outline" className="px-4 py-1.5">Gérer</ButtonLink>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Panel>
  );
}

/** Vignette de formation : couverture déposée, sinon un fond de marque avec une icône. */
function CourseThumb({ src }: { src: string | null }) {
  return (
    <span className="relative h-10 w-14 shrink-0 overflow-hidden rounded-lg bg-[linear-gradient(135deg,#092a66,#0639d9)]">
      {src ? (
        <Image src={src} alt="" fill sizes="56px" className="object-cover" unoptimized={src.startsWith("http")} />
      ) : (
        <BookOpen className="absolute inset-0 m-auto h-5 w-5 text-white/80" aria-hidden />
      )}
    </span>
  );
}

export function SessionsPanel({ sessions }: { sessions: Session[] }) {
  return (
    <Panel title="Prochaines sessions" action={{ href: "/formateur/sessions", label: "Voir tout" }} className="overflow-hidden">
      {sessions.length === 0 ? (
        <p className="text-sm text-muted">Aucune session à venir.</p>
      ) : (
        <ul className="divide-y divide-line">
          {sessions.map((s) => {
            const status = SESSION_STATUS[s.status as keyof typeof SESSION_STATUS];
            return (
              <li key={s.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <p className="font-medium text-brand-dark">{s.course || s.title}</p>
                  <p className="text-xs text-muted">
                    {formatShortDate(s.start, s.tz)} · {formatTimeRange(s.start, s.end, s.tz)}
                  </p>
                  <p className="text-xs text-muted">{s.location ?? "Lieu non précisé"} · {s.participants} / {s.capacity} inscrits</p>
                </div>
                <div className="flex items-center gap-3">
                  {status && <StatusBadge tone={status.tone}>{status.label}</StatusBadge>}
                  <Link href={`/formateur/formations/${s.courseId}/sessions/${s.id}`} className="rounded-lg border border-brand px-3 py-1.5 text-sm font-semibold text-brand hover:bg-brand-soft">Voir</Link>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </Panel>
  );
}

export function ActionsPanel({ actions }: { actions: DashboardData["actions"] }) {
  // Les liens « Bientôt » pointent vers des écrans de ce lot pas encore livrés : affichés sans lien.
  const items: { label: string; count: number; icon: LucideIcon; tone: string; href?: string }[] = [
    { label: "Présences à valider", count: actions.toValidateAttendance, icon: ClipboardList, tone: "bg-warning/10 text-[#a16207]" },
    { label: "Certifications à délivrer", count: actions.toDeliverCertificates, icon: Award, tone: "bg-brand-soft text-brand", href: "/formateur/certifications" },
    { label: "Apprenants en difficulté", count: actions.difficult, icon: UserX, tone: "bg-danger/10 text-danger" },
  ];
  return (
    <Panel title="Actions à effectuer">
      <ul className="grid gap-3 sm:grid-cols-3 xl:grid-cols-1">
        {items.map((it) => (
          <li key={it.label} className={cn("flex items-center gap-4 rounded-xl p-4", it.tone)}>
            <it.icon className="h-6 w-6 shrink-0" aria-hidden />
            <div className="min-w-0 flex-1">
              <p className="text-2xl font-extrabold text-brand-dark">{it.count}</p>
              <p className="text-sm text-brand-dark">{it.label}</p>
            </div>
            {it.href && it.count > 0 && (
              <Link href={it.href} className="text-sm font-semibold text-brand hover:underline">Voir →</Link>
            )}
          </li>
        ))}
      </ul>
    </Panel>
  );
}

export function ActivityPanel({ activity, now }: { activity: DashboardData["activity"]; now: number }) {
  return (
    <Panel title="Activités récentes">
      {activity.length === 0 ? (
        <p className="text-sm text-muted">Aucune activité pour l’instant.</p>
      ) : (
        <ul className="divide-y divide-line">
          {activity.map((a) => (
            <li key={a.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
              <span className="min-w-0 truncate text-brand-dark">{a.text}</span>
              <span className="shrink-0 text-xs text-muted">{relativeTime(a.at, now)}</span>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}
