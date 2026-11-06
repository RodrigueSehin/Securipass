import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CancelSessionForm, EnrollByEmailForm, SessionForm } from "@/components/courses/session-form";
import { Alert, EmptyState, StatusBadge } from "@/components/ui/feedback";
import { getOwnCourse, getSession, listParticipants } from "@/lib/courses/instructor-queries";
import { ENROLLMENT_STATUS, SESSION_STATUS } from "@/lib/courses/labels";
import { cancelEnrollment } from "@/lib/enrollments/actions";
import { formatDate, formatTimeRange, toDatetimeLocal } from "@/lib/format";

export const metadata = { title: "Session" };

type Props = { params: Promise<{ id: string; sessionId: string }>; searchParams: Promise<{ resultat?: string }> };

async function SessionDetail({ params, searchParams }: Props) {
  const [{ id, sessionId }, { resultat }] = await Promise.all([params, searchParams]);
  const [course, session] = await Promise.all([getOwnCourse(id), getSession(sessionId)]);
  if (!course || !session || session.course_id !== id) notFound();
  const { rows: participants, failed } = await listParticipants(sessionId);
  const taken = participants.filter((p) => ["confirmed", "completed", "pending_payment", "suspended"].includes(p.status)).length;
  const active = session.status === "scheduled" || session.status === "draft";
  const here = `/formateur/formations/${id}/sessions/${sessionId}`;

  return (
    <div className="max-w-5xl space-y-8">
      <Link href={`/formateur/formations/${id}/sessions`} className="text-sm text-brand hover:underline">← Toutes les sessions</Link>
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="text-xl font-bold text-brand-dark">{session.title}</h2>
        <StatusBadge tone={SESSION_STATUS[session.status].tone}>{SESSION_STATUS[session.status].label}</StatusBadge>
        <span className="text-sm text-muted">{formatDate(session.start_at, session.timezone)} · {formatTimeRange(session.start_at, session.end_at, session.timezone)} · {taken}/{session.capacity} places</span>
      </div>
      {resultat === "annule" && <Alert tone="success">Inscription annulée.</Alert>}
      {resultat === "erreur" && <Alert>L’opération a échoué.</Alert>}

      <section>
        <h3 className="mb-3 text-lg font-bold text-brand-dark">Participants</h3>
        {failed ? (
          <Alert>Impossible de charger les participants. Réessayez ou contactez le support.</Alert>
        ) : participants.length === 0 ? (
          <EmptyState title="Aucun inscrit pour le moment" />
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-line bg-white">
            <table className="w-full text-left text-sm">
              <thead className="bg-surface text-xs uppercase text-muted">
                <tr><th className="px-4 py-3">Apprenant</th><th className="px-4 py-3">Contact</th><th className="px-4 py-3">Inscrit le</th><th className="px-4 py-3">Statut</th><th className="px-4 py-3"><span className="sr-only">Actions</span></th></tr>
              </thead>
              <tbody>
                {participants.map((p) => (
                  <tr key={p.id} className="border-t border-line">
                    <td className="px-4 py-3 font-medium text-brand-dark">{p.learner?.full_name || "—"}</td>
                    <td className="px-4 py-3 text-muted">{p.learner?.email}{p.learner?.phone ? <span className="block text-xs">{p.learner.phone}</span> : null}</td>
                    <td className="px-4 py-3 text-muted">{formatDate(p.enrolled_at)}</td>
                    <td className="px-4 py-3"><StatusBadge tone={ENROLLMENT_STATUS[p.status].tone}>{ENROLLMENT_STATUS[p.status].label}</StatusBadge></td>
                    <td className="px-4 py-3 text-right">
                      {["confirmed", "waitlisted", "pending_payment", "pending_approval", "suspended"].includes(p.status) && (
                        <form action={cancelEnrollment}>
                          <input type="hidden" name="enrollmentId" value={p.id} />
                          <input type="hidden" name="returnTo" value={here} />
                          <button className="text-sm font-semibold text-danger hover:underline">Annuler l’inscription</button>
                        </form>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {active && (
        <div className="grid gap-6 lg:grid-cols-2">
          <section className="rounded-2xl border border-line bg-white p-5 shadow-card">
            <h3 className="mb-3 text-lg font-bold text-brand-dark">Inscrire un apprenant</h3>
            <EnrollByEmailForm sessionId={sessionId} />
          </section>
          <section className="rounded-2xl border border-line bg-white p-5 shadow-card">
            <h3 className="mb-3 text-lg font-bold text-brand-dark">Modifier la session</h3>
            <SessionForm
              courseId={id}
              defaults={{
                id: sessionId, title: session.title, start: toDatetimeLocal(session.start_at, session.timezone), end: toDatetimeLocal(session.end_at, session.timezone),
                deadline: session.registration_deadline ? toDatetimeLocal(session.registration_deadline, session.timezone) : "",
                delivery_mode: session.delivery_mode, location: session.location, meeting_url: session.meeting_url,
                capacity: session.capacity, waitlist_enabled: session.waitlist_enabled, status: session.status, timezone: session.timezone,
              }}
            />
          </section>
          <section className="rounded-2xl border border-line bg-white p-5 shadow-card lg:col-span-2">
            <h3 className="mb-3 text-lg font-bold text-brand-dark">Annuler la session</h3>
            <CancelSessionForm sessionId={sessionId} courseId={id} />
          </section>
        </div>
      )}
    </div>
  );
}

export default function SessionPage(props: Props) {
  return (
    <Suspense fallback={<div className="h-96 max-w-5xl animate-pulse rounded-2xl bg-white" aria-hidden />}>
      <SessionDetail {...props} />
    </Suspense>
  );
}
