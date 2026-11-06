import { Suspense } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { MY_ENROLLMENTS_SELECT } from "@/lib/selects";
import { cancelEnrollment } from "@/lib/enrollments/actions";
import { ENROLLMENT_STATUS, type EnrollmentStatus } from "@/lib/courses/labels";
import { ButtonLink } from "@/components/ui/button";
import { Alert, EmptyState, PageHeader, StatusBadge } from "@/components/ui/feedback";
import { formatDate, formatTimeRange } from "@/lib/format";

export const metadata = { title: "Mes inscriptions" };

type Row = {
  id: string;
  status: EnrollmentStatus;
  enrolled_at: string;
  course: { title: string; slug: string } | null;
  session: { title: string; start_at: string; end_at: string; timezone: string; location: string | null } | null;
};

const isFuture = (iso: string) => new Date(iso).getTime() > Date.now();

const BANNERS: Record<string, { tone: "success" | "info" | "error"; text: string }> = {
  ok: { tone: "success", text: "Votre inscription est confirmée." },
  attente: { tone: "info", text: "La session est complète : vous êtes en liste d’attente et serez confirmé si une place se libère." },
  demande: { tone: "info", text: "Votre demande d’inscription est envoyée : le formateur l’examinera et vous serez notifié de sa décision." },
  annule: { tone: "success", text: "Votre inscription a été annulée." },
  erreur: { tone: "error", text: "L’opération a échoué. Réessayez ou contactez le support." },
};

async function List({ searchParams }: { searchParams: Promise<{ resultat?: string }> }) {
  const { resultat } = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/connexion?redirect=/app/inscriptions");

  const { data, error } = await supabase
    .from("enrollments")
    .select(MY_ENROLLMENTS_SELECT)
    .eq("learner_id", user.id)
    .order("enrolled_at", { ascending: false })
    .returns<Row[]>();

  const banner = resultat && Object.hasOwn(BANNERS, resultat) ? BANNERS[resultat] : null;

  return (
    <>
      {banner && <div className="mb-4"><Alert tone={banner.tone}>{banner.text}</Alert></div>}
      {error ? (
        <Alert>Impossible de charger vos inscriptions pour le moment.</Alert>
      ) : !data?.length ? (
        <EmptyState title="Aucune inscription pour le moment">
          Parcourez le catalogue pour vous inscrire à une formation.
          <div className="mt-4"><ButtonLink href="/formations" variant="cta">Découvrir les formations</ButtonLink></div>
        </EmptyState>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-line bg-white">
          <table className="w-full text-left text-sm">
            <thead className="bg-surface text-xs uppercase text-muted">
              <tr><th className="px-4 py-3">Formation</th><th className="px-4 py-3">Session</th><th className="px-4 py-3">Inscrit le</th><th className="px-4 py-3">Statut</th><th className="px-4 py-3"><span className="sr-only">Actions</span></th></tr>
            </thead>
            <tbody>
              {data.map((e) => {
                const st = ENROLLMENT_STATUS[e.status];
                const active = ["confirmed", "waitlisted", "pending_payment", "pending_approval", "suspended"].includes(e.status);
                const canCancel = active && (!e.session || isFuture(e.session.start_at));
                return (
                  <tr key={e.id} className="border-t border-line align-top">
                    <td className="px-4 py-3 font-medium text-brand-dark">{e.course?.title ?? "Formation indisponible"}</td>
                    <td className="px-4 py-3 text-muted">
                      {e.session ? <>{e.session.title}<span className="block text-xs">{formatDate(e.session.start_at, e.session.timezone)} · {formatTimeRange(e.session.start_at, e.session.end_at, e.session.timezone)}{e.session.location ? ` · ${e.session.location}` : ""}</span></> : "—"}
                    </td>
                    <td className="px-4 py-3 text-muted">{formatDate(e.enrolled_at)}</td>
                    <td className="px-4 py-3"><StatusBadge tone={st.tone}>{st.label}</StatusBadge></td>
                    <td className="px-4 py-3 text-right">
                      {canCancel && (
                        <form action={cancelEnrollment}>
                          <input type="hidden" name="enrollmentId" value={e.id} />
                          <input type="hidden" name="returnTo" value="/app/inscriptions" />
                          <button className="text-sm font-semibold text-danger hover:underline">Annuler</button>
                        </form>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

export default function EnrollmentsPage({ searchParams }: { searchParams: Promise<{ resultat?: string }> }) {
  return (
    <>
      <PageHeader title="Mes inscriptions" description="Suivez l’état de vos inscriptions aux formations et sessions." />
      <Suspense fallback={<div className="h-48 animate-pulse rounded-2xl bg-white" aria-hidden />}>
        <List searchParams={searchParams} />
      </Suspense>
    </>
  );
}
