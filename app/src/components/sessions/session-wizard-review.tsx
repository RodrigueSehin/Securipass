import Link from "next/link";
import { Check } from "lucide-react";
import { Alert } from "@/components/ui/feedback";
import { RichText } from "@/components/ui/rich-text";
import { REQUIRED_LEVELS } from "@/lib/courses/labels";
import { formatDateTime } from "@/lib/format";
import { MEETING_PLATFORMS, TIMEZONES, localToUtc } from "@/lib/sessions/timezones";
import { confirmSession } from "@/lib/sessions/wizard-actions";
import { minutesBetween, occurrences, spanLabel, type SessionDraft } from "@/lib/sessions/wizard";
import type { WizardCourse } from "@/lib/sessions/wizard-queries";

function Recap({ title, step, draftId, children }: { title: string; step: number; draftId: string; children: React.ReactNode }) {
  return (
    <section className="py-4 first:pt-0">
      <div className="mb-2 flex items-center justify-between gap-3">
        <h4 className="font-bold text-brand-dark">{title}</h4>
        <Link href={`/formateur/sessions/nouvelle/${draftId}?etape=${step}`} className="inline-flex items-center gap-1 text-sm font-semibold text-brand hover:underline">
          <Check className="h-4 w-4" aria-hidden /> Modifier
        </Link>
      </div>
      <dl>{children}</dl>
    </section>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[10rem_minmax(0,1fr)] gap-3 border-t border-line/60 py-2 text-sm">
      <dt className="text-muted">{label}</dt>
      <dd className="min-w-0 break-words text-brand-dark">{children}</dd>
    </div>
  );
}

const when = (v: string | undefined, tz?: string) => { const iso = v ? localToUtc(v, tz) : null; return iso ? formatDateTime(iso, tz ?? "Africa/Abidjan") : "À renseigner"; };

/** Étape 4 : récapitulatif des étapes précédentes, avant la création de la session. */
export function SessionWizardReview({ draftId, data, course, error }: { draftId: string; data: SessionDraft; course?: WizardCourse; error?: string }) {
  return (
    <section className="max-w-3xl rounded-2xl border border-line bg-white p-6 shadow-card">
      <h3 className="text-lg font-bold text-brand-dark">Confirmation</h3>
      <p className="mb-4 text-sm text-muted">Vérifiez les informations de la session avant de la créer.</p>
      {error && <div className="mb-4"><Alert>{error}</Alert></div>}
      <div className="divide-y divide-line">
        <Recap title="Informations générales" step={1} draftId={draftId}>
          <Row label="Formation">{course?.title ?? "À renseigner"}</Row>
          <Row label="Titre">{data.title || "À renseigner"}</Row>
          <Row label="Description">{data.description ? <RichText text={data.description} className="text-sm" /> : "Aucune"}</Row>
          <Row label="Objectifs">{data.objectives?.length ? <ul className="list-disc pl-4">{data.objectives.map((o) => <li key={o}>{o}</li>)}</ul> : "Aucun"}</Row>
          <Row label="Niveau requis">{REQUIRED_LEVELS[(data.requiredLevel ?? "beginner") as keyof typeof REQUIRED_LEVELS]}</Row>
          <Row label="Langue">{data.language === "en" ? "Anglais" : "Français"}</Row>
          <Row label="Capacité">{data.capacity ?? "À renseigner"} participants</Row>
        </Recap>
        <Recap title="Planification" step={2} draftId={draftId}>
          {occurrences(data).map((o, i) => (
            <Row key={i} label={data.planning === "multiple" ? `Séance ${i + 1}` : "Date et heure"}>
              {when(o.start, data.timezone)} → {when(o.end, data.timezone)}
              <span className="block text-xs text-muted">Durée : {spanLabel(minutesBetween(o.start, o.end))}</span>
            </Row>
          ))}
          <Row label="Fuseau horaire">{TIMEZONES.find((z) => z.id === data.timezone)?.label ?? TIMEZONES[0].label}</Row>
          <Row label="Mode de livraison">{data.deliveryMode === "onsite" ? "Présentiel" : data.deliveryMode === "hybrid" ? "Hybride" : "En ligne"}</Row>
          {data.deliveryMode !== "online" && <Row label="Lieu">{data.location || "À renseigner"}</Row>}
          {data.deliveryMode !== "onsite" && (
            <>
              <Row label="Plateforme">{MEETING_PLATFORMS[(data.platform ?? "") as keyof typeof MEETING_PLATFORMS] ?? "À renseigner"}</Row>
              <Row label="Lien de la session">{data.meetingUrl || "À renseigner"}</Row>
            </>
          )}
          <Row label="Message aux apprenants">{data.welcomeMessage || "Aucun"}</Row>
          <Row label="Invitation automatique">{data.sendInvitation === "0" ? "Non" : "Oui"}</Row>
          <Row label="Ajout à l’agenda">{data.addToCalendar === "1" ? "Oui" : "Non"}</Row>
        </Recap>
        <Recap title="Participants et options" step={3} draftId={draftId}>
          <Row label="Fin des inscriptions">{data.registrationDeadline ? when(data.registrationDeadline) : "Au début de la session"}</Row>
          <Row label="Liste d’attente">{data.waitlistEnabled === "on" ? "Activée" : "Désactivée"}</Row>
        </Recap>
      </div>
    </section>
  );
}

export function ConfirmButtons({ draftId }: { draftId: string }) {
  return (
    <form action={confirmSession} className="flex flex-wrap items-center gap-3">
      <input type="hidden" name="draftId" value={draftId} />
      <button name="draft" value="1" className="inline-flex items-center gap-2 rounded-lg border border-brand bg-white px-5 py-2.5 text-sm font-semibold text-brand hover:bg-brand-soft">
        Enregistrer comme brouillon
      </button>
      <button className="inline-flex items-center gap-2 rounded-lg bg-brand px-6 py-2.5 text-sm font-semibold text-white hover:bg-brand-dark">
        <Check className="h-4 w-4" aria-hidden /> Créer la session
      </button>
    </form>
  );
}
