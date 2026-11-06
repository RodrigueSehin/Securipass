import Image from "next/image";
import Link from "next/link";
import { CalendarDays, ChevronLeft, ChevronRight, Clock, Users } from "lucide-react";
import { categoryUi } from "@/content/categories";
import { publicImage } from "@/lib/images";
import type { MySession } from "@/lib/courses/instructor-queries";
import { formatShortDate, formatTimeRange } from "@/lib/format";
import { DISPLAY_STATUS, MONTH_LABEL, displayStatus, type CalendarDay, type DisplayStatus } from "@/lib/sessions/dashboard";
import { cn } from "@/lib/utils";

const WEEKDAYS = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];

export function sessionCover(s: MySession): string | null {
  const ui = categoryUi(s.course?.category?.slug, s.course?.category?.name);
  return s.course?.cover_url ?? (ui.image ? publicImage(`home/${ui.image}`) : null);
}

/** Vignette carrée de la formation (image de couverture, sinon pictogramme). */
export function SessionThumb({ session, size = 48 }: { session: MySession; size?: number }) {
  const cover = sessionCover(session);
  return (
    <span className="relative flex shrink-0 items-center justify-center overflow-hidden rounded-lg bg-brand-dark" style={{ width: size, height: size }}>
      {cover ? (
        <Image src={cover} alt="" fill sizes={`${size}px`} className="object-cover" unoptimized={cover.startsWith("http")} />
      ) : (
        <CalendarDays className="h-5 w-5 text-white/80" aria-hidden />
      )}
    </span>
  );
}

export function SessionCalendar({ month, days, prevHref, nextHref }: { month: string; days: CalendarDay[]; prevHref: string; nextHref: string }) {
  return (
    <section className="rounded-2xl border border-line bg-white p-5 shadow-card">
      <h2 className="mb-3 text-lg font-extrabold text-brand-dark">Calendrier des sessions</h2>
      <div className="mb-2 flex items-center justify-between">
        <Link href={prevHref} aria-label="Mois précédent" scroll={false} className="rounded-lg border border-line p-1.5 text-brand-dark hover:bg-brand-soft"><ChevronLeft className="h-4 w-4" aria-hidden /></Link>
        <p className="text-sm font-semibold text-brand-dark" aria-live="polite">{MONTH_LABEL(month)}</p>
        <Link href={nextHref} aria-label="Mois suivant" scroll={false} className="rounded-lg border border-line p-1.5 text-brand-dark hover:bg-brand-soft"><ChevronRight className="h-4 w-4" aria-hidden /></Link>
      </div>
      <div className="grid grid-cols-7 gap-y-1 text-center text-sm">
        {WEEKDAYS.map((d) => <span key={d} className="py-1 text-xs text-muted">{d}</span>)}
        {days.map((d) => (
          <span key={d.date} className="flex flex-col items-center py-0.5">
            <span className={cn("flex h-8 w-8 items-center justify-center rounded-full",
              d.today ? "bg-brand font-bold text-white" : d.inMonth ? "text-brand-dark" : "text-muted/60")}
              aria-label={d.statuses.length ? `${d.date} : ${d.statuses.length} session${d.statuses.length > 1 ? "s" : ""}` : undefined}>
              {d.day}
            </span>
            <span className="mt-0.5 flex h-1.5 gap-0.5" aria-hidden>
              {[...new Set(d.statuses)].slice(0, 3).map((st) => <span key={st} className="h-1.5 w-1.5 rounded-full" style={{ background: DISPLAY_STATUS[st].color }} />)}
            </span>
          </span>
        ))}
      </div>
    </section>
  );
}

export function UpcomingSessions({ sessions, allHref }: { sessions: MySession[]; allHref: string }) {
  return (
    <section className="rounded-2xl border border-line bg-white p-5 shadow-card">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-lg font-extrabold text-brand-dark">Prochaines sessions</h2>
        <Link href={allHref} className="text-sm font-semibold text-brand hover:underline">Voir tout</Link>
      </div>
      {sessions.length === 0 ? (
        <p className="text-sm text-muted">Aucune session à venir.</p>
      ) : (
        <ul className="space-y-3">
          {sessions.map((s) => (
            <li key={s.id}>
              <Link href={`/formateur/formations/${s.course_id}/sessions/${s.id}`}
                className="flex items-center gap-3 rounded-lg border-l-4 py-1 pl-3 hover:bg-brand-soft/50" style={{ borderLeftColor: DISPLAY_STATUS[displayStatus(s)].color }}>
                <SessionThumb session={s} />
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-bold leading-snug text-brand-dark">{s.course?.title ?? s.title}</span>
                  <span className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-muted">
                    <span className="inline-flex items-center gap-1"><CalendarDays className="h-3 w-3" aria-hidden />{formatShortDate(s.start_at, s.timezone)}</span>
                    <span className="inline-flex items-center gap-1"><Clock className="h-3 w-3" aria-hidden />{formatTimeRange(s.start_at, s.end_at, s.timezone)}</span>
                    <span className="inline-flex items-center gap-1"><Users className="h-3 w-3" aria-hidden />{s.taken} / {s.capacity}</span>
                  </span>
                </span>
                <ChevronRight className="h-4 w-4 shrink-0 text-brand" aria-hidden />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export function SessionDistribution({ items, total }: { items: { key: DisplayStatus; count: number; percent: number }[]; total: number }) {
  const r = 70;
  const c = 2 * Math.PI * r;
  let offset = 0;
  return (
    <section className="rounded-2xl border border-line bg-white p-5 shadow-card">
      <h2 className="mb-3 text-lg font-extrabold text-brand-dark">Répartition des sessions</h2>
      <div className="flex flex-wrap items-center justify-center gap-4">
        <svg viewBox="0 0 200 200" className="h-40 w-40 shrink-0" role="img"
          aria-label={`${total} sessions : ${items.map((i) => `${DISPLAY_STATUS[i.key].label} ${i.count}`).join(", ")}`}>
          <circle cx="100" cy="100" r={r} fill="none" stroke="#eef2f7" strokeWidth="28" />
          {total > 0 && items.map((i) => {
            const len = (i.count / total) * c;
            const el = <circle key={i.key} cx="100" cy="100" r={r} fill="none" stroke={DISPLAY_STATUS[i.key].color} strokeWidth="28"
              strokeDasharray={`${len} ${c - len}`} strokeDashoffset={-offset} transform="rotate(-90 100 100)" />;
            offset += len;
            return el;
          })}
          <text x="100" y="102" textAnchor="middle" className="fill-brand-dark" style={{ fontSize: 34, fontWeight: 800 }}>{total}</text>
          <text x="100" y="124" textAnchor="middle" className="fill-muted" style={{ fontSize: 13 }}>sessions</text>
        </svg>
        <dl className="min-w-40 flex-1 space-y-2 text-sm">
          {items.map((i) => (
            <div key={i.key} className="flex items-center justify-between gap-3">
              <dt className="flex items-center gap-2 text-brand-dark"><span className="h-2.5 w-2.5 rounded-full" style={{ background: DISPLAY_STATUS[i.key].color }} aria-hidden />{i.key === "planned" ? "Planifiées" : i.key === "completed" ? "Terminées" : i.key === "cancelled" ? "Annulées" : i.key === "draft" ? "Brouillons" : "En cours"}</dt>
              <dd className="text-muted">{i.count} ({i.percent}%)</dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}
