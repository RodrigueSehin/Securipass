import { Suspense } from "react";
import { LearnerWizardForm, LEARNER_FORM_ID } from "@/components/learners/learner-wizard-form";
import { WizardFrame } from "@/components/ui/wizard-frame";
import { LEARNER_STEPS } from "@/lib/learners/wizard";

export const metadata = { title: "Ajouter un apprenant" };

export default function NewLearnerPage() {
  return (
    <Suspense fallback={<div className="h-96 animate-pulse rounded-2xl bg-white" aria-hidden />}>
      <WizardFrame title="Ajouter un apprenant" subtitle="Inscrivez un nouvel apprenant à une ou plusieurs sessions de formation."
        steps={LEARNER_STEPS} step={1} listHref="/formateur/apprenants" formId={LEARNER_FORM_ID}>
        <LearnerWizardForm step={1} initial={{}} photoUrl={null} sessions={[]} />
      </WizardFrame>
    </Suspense>
  );
}
