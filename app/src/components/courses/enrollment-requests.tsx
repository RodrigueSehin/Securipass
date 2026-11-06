import { Check, X } from "lucide-react";
import { reviewEnrollment } from "@/lib/enrollments/actions";
import type { EnrollmentRequest } from "@/lib/courses/instructor-queries";
import { formatDate, relativeTime } from "@/lib/format";

/** Demandes d'inscription en attente : le formateur accepte ou refuse chacune (règles de places appliquées en SQL). */
export function EnrollmentRequests({ courseId, requests }: { courseId: string; requests: EnrollmentRequest[] }) {
  if (requests.length === 0) return null;
  return (
    <section aria-labelledby="demandes" className="mb-6 rounded-2xl border border-cta/40 bg-cta/5 p-4">
      <h2 id="demandes" className="text-lg font-bold text-brand-dark">Demandes d’inscription ({requests.length})</h2>
      <p className="text-sm text-muted">Ces apprenants attendent votre décision. Aucune place n’est réservée avant l’acceptation.</p>
      <ul className="mt-3 space-y-3">
        {requests.map((r) => (
          <li key={r.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line bg-white p-3">
            <div className="min-w-0 text-sm">
              <p className="font-semibold text-brand-dark">{r.learner?.full_name || r.learner?.email || "Apprenant"}</p>
              <p className="text-xs text-muted">
                {r.learner?.email}{r.learner?.phone ? ` · ${r.learner.phone}` : ""}
              </p>
              <p className="text-xs text-muted">
                {r.session ? `${r.session.title} · ${formatDate(r.session.start_at, r.session.timezone)}` : "Formation sans session"} · demandé {relativeTime(r.enrolled_at).toLowerCase()}
              </p>
            </div>
            <div className="flex gap-2">
              {(["approve", "decline"] as const).map((decision) => (
                <form key={decision} action={reviewEnrollment}>
                  <input type="hidden" name="enrollmentId" value={r.id} />
                  <input type="hidden" name="courseId" value={courseId} />
                  <input type="hidden" name="decision" value={decision} />
                  <button className={decision === "approve"
                    ? "flex items-center gap-1.5 rounded-lg bg-success px-3 py-1.5 text-sm font-semibold text-white hover:opacity-90"
                    : "flex items-center gap-1.5 rounded-lg border border-danger px-3 py-1.5 text-sm font-semibold text-danger hover:bg-danger/5"}>
                    {decision === "approve" ? <Check className="h-4 w-4" aria-hidden /> : <X className="h-4 w-4" aria-hidden />}
                    {decision === "approve" ? "Accepter" : "Refuser"}
                  </button>
                </form>
              ))}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
