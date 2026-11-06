import Link from "next/link";
import { Check } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { Alert } from "@/components/ui/feedback";
import { formatShortDate, formatTimeRange } from "@/lib/format";
import { confirmLearnerRegistration } from "@/lib/learners/wizard-actions";
import { fullName, GENDERS } from "@/lib/learners/wizard";
import type { Registration } from "@/lib/learners/wizard-queries";
import type { PickSession } from "@/components/learners/learner-wizard-form";

function Recap({ title, step, id, children }: { title: string; step: number; id: string; children: React.ReactNode }) {
  return (
    <section className="py-4 first:pt-0">
      <div className="mb-2 flex items-center justify-between gap-3">
        <h4 className="font-bold text-brand-dark">{title}</h4>
        <Link href={`/formateur/apprenants/nouveau/${id}?etape=${step}`} className="inline-flex items-center gap-1 text-sm font-semibold text-brand hover:underline"><Check className="h-4 w-4" aria-hidden /> Modifier</Link>
      </div>
      <dl>{children}</dl>
    </section>
  );
}

const Row = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div className="grid grid-cols-[10rem_minmax(0,1fr)] gap-3 border-t border-line/60 py-2 text-sm">
    <dt className="text-muted">{label}</dt><dd className="min-w-0 break-words text-brand-dark">{children}</dd>
  </div>
);

/** Étape 4 : récapitulatif de la fiche, des sessions et des options avant l'inscription. */
export function LearnerWizardReview({ reg, sessions, error }: { reg: Registration; sessions: PickSession[]; error?: string }) {
  const chosen = reg.sessionIds.map((id) => sessions.find((s) => s.id === id)).filter((s): s is PickSession => !!s);
  return (
    <section className="max-w-3xl rounded-2xl border border-line bg-white p-6 shadow-card">
      <h3 className="text-lg font-bold text-brand-dark">Confirmation</h3>
      <p className="mb-4 text-sm text-muted">Vérifiez les informations avant d’inscrire l’apprenant.</p>
      {error && <div className="mb-4"><Alert>{error}</Alert></div>}
      <div className="divide-y divide-line">
        <Recap title="Informations de l’apprenant" step={1} id={reg.id}>
          <div className="mb-2 flex items-center gap-3"><Avatar name={fullName(reg)} src={reg.photoUrl} size={56} /><p className="text-lg font-extrabold text-brand-dark">{fullName(reg)}</p></div>
          <Row label="E-mail">{reg.email}</Row>
          <Row label="Téléphone">{reg.phone}</Row>
          <Row label="Date de naissance">{reg.birthDate ? formatShortDate(`${reg.birthDate}T00:00:00Z`, "UTC") : "Non renseignée"}</Row>
          <Row label="Genre">{reg.gender ? GENDERS[reg.gender as keyof typeof GENDERS] : "Non renseigné"}</Row>
          <Row label="Entreprise">{reg.company ?? "Non renseignée"}</Row>
          <Row label="Poste">{reg.jobTitle ?? "Non renseigné"}</Row>
          <Row label="Adresse">{reg.address ?? "Non renseignée"}</Row>
          <Row label="Notes">{reg.notes ?? "Aucune"}</Row>
        </Recap>
        <Recap title="Sessions" step={2} id={reg.id}>
          {chosen.length === 0 ? <p className="text-sm text-danger">Aucune session sélectionnée.</p> : chosen.map((s) => (
            <Row key={s.id} label={formatShortDate(s.start_at, s.timezone)}>{s.course} — {s.title}<span className="block text-xs text-muted">{formatTimeRange(s.start_at, s.end_at, s.timezone)}</span></Row>
          ))}
        </Recap>
        <Recap title="Options d’inscription" step={3} id={reg.id}>
          <Row label="Notification e-mail">{reg.notify ? "Oui" : "Non"}</Row>
        </Recap>
      </div>
      <p className="mt-4 rounded-lg bg-brand-soft p-3 text-sm text-brand-dark">
        Si un compte existe avec cette adresse e-mail, l’apprenant est inscrit immédiatement. Sinon, ses inscriptions sont enregistrées et s’appliqueront dès qu’il créera son compte avec cette adresse.
      </p>
    </section>
  );
}

export function ConfirmLearnerButton({ id }: { id: string }) {
  return (
    <form action={confirmLearnerRegistration}>
      <input type="hidden" name="registrationId" value={id} />
      <button className="inline-flex items-center gap-2 rounded-lg bg-brand px-6 py-2.5 text-sm font-semibold text-white hover:bg-brand-dark"><Check className="h-4 w-4" aria-hidden /> Inscrire l’apprenant</button>
    </form>
  );
}
