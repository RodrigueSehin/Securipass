import { Suspense } from "react";
import { notFound } from "next/navigation";
import { ConfirmLearnerButton, LearnerWizardReview } from "@/components/learners/learner-wizard-review";
import { LearnerWizardForm, LEARNER_FORM_ID, type PickSession } from "@/components/learners/learner-wizard-form";
import { sessionCover } from "@/components/sessions/session-panels";
import { WizardFrame } from "@/components/ui/wizard-frame";
import { discardLearnerDraft } from "@/lib/learners/wizard-actions";
import { getRegistrationDraft, listSelectableSessions } from "@/lib/learners/wizard-queries";
import { LEARNER_STEPS, parseLearnerStep, sessionAvailability } from "@/lib/learners/wizard";

export const metadata = { title: "Ajouter un apprenant" };

const currentTime = () => Date.now();

type Props = { params: Promise<{ id: string }>; searchParams: Promise<{ etape?: string; erreur?: string }> };

async function Wizard({ params, searchParams }: Props) {
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const reg = await getRegistrationDraft(id);
  if (!reg) notFound();
  const step = parseLearnerStep(sp.etape);
  const list = step >= 2 ? await listSelectableSessions(currentTime()) : [];
  const sessions: PickSession[] = list.map((s) => ({
    id: s.id, title: s.title, course: s.course?.title ?? "Formation", cover: sessionCover(s), start_at: s.start_at, end_at: s.end_at, timezone: s.timezone,
    mode: s.delivery_mode, platform: s.meeting_platform, location: s.location, taken: s.taken, capacity: s.capacity, availability: sessionAvailability(s),
  }));
  const stepHref = (n: number) => `/formateur/apprenants/nouveau/${id}?etape=${n}`;
  const discard = (
    <form action={discardLearnerDraft}>
      <input type="hidden" name="registrationId" value={id} />
      <button className="inline-flex items-center justify-center gap-2 rounded-lg border border-brand bg-white px-5 py-2.5 text-sm font-semibold text-brand hover:bg-brand-soft">Annuler</button>
    </form>
  );

  return (
    <WizardFrame title="Ajouter un apprenant" subtitle="Inscrivez un nouvel apprenant à une ou plusieurs sessions de formation." steps={LEARNER_STEPS}
      step={step} stepHref={stepHref} listHref="/formateur/apprenants" formId={LEARNER_FORM_ID} hasForm={step < 4} discard={discard}
      lastAction={step === 4 ? <ConfirmLearnerButton id={id} /> : undefined}>
      {step === 4
        ? <LearnerWizardReview reg={reg} sessions={sessions} error={sp.erreur} />
        : <LearnerWizardForm key={step} step={step as 1 | 2 | 3} registrationId={id} initial={reg} photoUrl={reg.photoUrl} sessions={sessions} />}
    </WizardFrame>
  );
}

export default function LearnerWizardPage(props: Props) {
  return (
    <Suspense fallback={<div className="h-96 animate-pulse rounded-2xl bg-white" aria-hidden />}>
      <Wizard {...props} />
    </Suspense>
  );
}
