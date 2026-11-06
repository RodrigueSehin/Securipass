import { StatusBadge } from "@/components/ui/feedback";
import { MODES } from "@/lib/courses/labels";
import { sessionState, type PublicSession, type SessionState } from "@/lib/courses/types";
import { formatDate, formatDateTime, formatTimeRange } from "@/lib/format";

const STATE: Record<SessionState, { label: string; tone: "success" | "info" | "danger" | "neutral" }> = {
  open: { label: "Places disponibles", tone: "success" },
  waitlist: { label: "Complète — liste d’attente", tone: "info" },
  full: { label: "Complète", tone: "danger" },
  closed: { label: "Inscriptions closes", tone: "neutral" },
};

export function SessionList({ sessions }: { sessions: PublicSession[] }) {
  if (sessions.length === 0) {
    return <p className="rounded-xl border border-dashed border-line p-4 text-sm text-muted">Aucune session planifiée pour le moment.</p>;
  }
  return (
    <ul className="space-y-3">
      {sessions.map((s) => {
        const st = sessionState(s);
        const left = Math.max(0, s.capacity - s.seats_taken);
        return (
          <li key={s.id} className="rounded-xl border border-line bg-white p-4">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="font-semibold text-brand-dark">{s.title}</p>
                <p className="text-sm text-muted">{formatDate(s.start_at, s.timezone)} · {formatTimeRange(s.start_at, s.end_at, s.timezone)}</p>
                <p className="text-sm text-muted">
                  {MODES[s.delivery_mode]}{s.location ? ` · ${s.location}` : ""}
                </p>
              </div>
              <StatusBadge tone={STATE[st].tone}>{STATE[st].label}</StatusBadge>
            </div>
            <p className="mt-2 text-xs text-muted">
              {st === "open" ? `${left} place${left > 1 ? "s" : ""} restante${left > 1 ? "s" : ""} sur ${s.capacity}` : `Capacité : ${s.capacity} places`}
              {s.registration_deadline && ` · Inscription jusqu’au ${formatDateTime(s.registration_deadline, s.timezone)}`}
            </p>
          </li>
        );
      })}
    </ul>
  );
}
