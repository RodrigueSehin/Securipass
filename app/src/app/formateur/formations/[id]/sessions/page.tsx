import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { SessionForm } from "@/components/courses/session-form";
import { EnrollmentRequests } from "@/components/courses/enrollment-requests";
import { Alert, EmptyState, StatusBadge } from "@/components/ui/feedback";
import { getOwnCourse, listCourseSessions, listPendingRequests } from "@/lib/courses/instructor-queries";
import { MODES, SESSION_STATUS } from "@/lib/courses/labels";
import { formatDate, formatTimeRange } from "@/lib/format";

export const metadata = { title: "Sessions de la formation" };

type SP = Promise<{ erreur?: string; decision?: string }>;

async function Sessions({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: SP }) {
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const course = await getOwnCourse(id);
  if (!course) notFound();
  const [sessions, requests] = await Promise.all([listCourseSessions(id), listPendingRequests(id)]);

  return (
    <div className="grid max-w-5xl gap-8 lg:grid-cols-[1fr_24rem]">
      <div>
        {sp.decision && <div className="mb-4"><Alert tone="success">{sp.decision === "acceptee" ? "Demande acceptée : l’apprenant est notifié." : "Demande refusée : l’apprenant est notifié."}</Alert></div>}
        {sp.erreur && <div className="mb-4"><Alert>{sp.erreur}</Alert></div>}
        <EnrollmentRequests courseId={id} requests={requests} />
        <h2 className="mb-3 text-lg font-bold text-brand-dark">Sessions planifiées</h2>
        {sessions.length === 0 ? (
          <EmptyState title="Aucune session pour le moment">Planifiez une première session avec le formulaire.</EmptyState>
        ) : (
          <ul className="space-y-3">
            {sessions.map((s) => (
              <li key={s.id} className="rounded-xl border border-line bg-white p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <Link href={`/formateur/formations/${id}/sessions/${s.id}`} className="font-semibold text-brand-dark hover:text-brand hover:underline">{s.title}</Link>
                    <p className="text-sm text-muted">{formatDate(s.start_at, s.timezone)} · {formatTimeRange(s.start_at, s.end_at, s.timezone)}</p>
                    <p className="text-sm text-muted">{MODES[s.delivery_mode]}{s.location ? ` · ${s.location}` : ""}</p>
                  </div>
                  <StatusBadge tone={SESSION_STATUS[s.status].tone}>{SESSION_STATUS[s.status].label}</StatusBadge>
                </div>
                <p className="mt-2 text-xs text-muted">
                  {s.taken} / {s.capacity} places{s.waiting > 0 ? ` · ${s.waiting} en liste d’attente` : ""}
                </p>
                <Link href={`/formateur/formations/${id}/sessions/${s.id}`} className="mt-2 inline-block text-sm font-semibold text-brand hover:underline">Participants et gestion →</Link>
              </li>
            ))}
          </ul>
        )}
      </div>
      <section className="rounded-2xl border border-line bg-white p-5 shadow-card lg:self-start">
        <h2 className="mb-3 text-lg font-bold text-brand-dark">Nouvelle session</h2>
        {course.status === "archived" ? <p className="text-sm text-muted">Cette formation est archivée.</p> : <SessionForm courseId={id} defaults={{ capacity: course.default_capacity ?? undefined, delivery_mode: course.delivery_mode as keyof typeof MODES }} />}
        <p className="mt-3 text-xs text-muted">Une session n’est visible au catalogue que lorsque la formation est publiée.</p>
      </section>
    </div>
  );
}

export default function SessionsPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: SP }) {
  return (
    <Suspense fallback={<div className="h-96 max-w-5xl animate-pulse rounded-2xl bg-white" aria-hidden />}>
      <Sessions params={params} searchParams={searchParams} />
    </Suspense>
  );
}
