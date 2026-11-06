import { Suspense } from "react";
import { StepForm } from "@/components/courses/wizard/step-form";
import { WizardFrame } from "@/components/courses/wizard/wizard-frame";
import { getFormLookups } from "@/lib/courses/instructor-queries";

export const metadata = { title: "Nouvelle formation" };

/** Valeurs de départ d'une nouvelle formation. */
const NEW_COURSE_VALUES: Record<string, string> = {
  level: "beginner", deliveryMode: "onsite", language: "fr", priceAmount: "0", enrollmentMode: "free",
};

async function FirstStep() {
  const lookups = await getFormLookups();
  return (
    <WizardFrame step={1} hasForm>
      <StepForm step={1} initialValues={NEW_COURSE_VALUES} lookups={lookups} />
    </WizardFrame>
  );
}

export default function NewCoursePage() {
  return (
    <Suspense fallback={<div className="h-96 animate-pulse rounded-2xl bg-white" aria-hidden />}>
      <FirstStep />
    </Suspense>
  );
}
