"use client";

import { useActionState, useState } from "react";
import { saveCourse } from "@/lib/courses/actions";
import type { FormState } from "@/lib/auth/actions";
import { Alert } from "@/components/ui/feedback";
import {
  StepGeneral, type EnrollmentControl, type EnrollmentMode, type WizardLookups,
} from "../course-wizard-steps";
import { WIZARD_FORM_ID } from "./wizard-frame";

/**
 * Formulaire des étapes 1, 3 et 4 : chaque étape enregistre la formation (brouillon) puis passe à la suivante.
 * Les boutons « Suivant » et « Enregistrer comme brouillon » sont dans le pied de page et rattachés à ce formulaire.
 */
export function StepForm({ step, courseId, initialValues, lookups }: {
  step: 1; courseId?: string; initialValues: Record<string, string>; lookups: WizardLookups;
}) {
  const [state, action] = useActionState<FormState, FormData>(saveCourse, {});
  const [mode, setMode] = useState<EnrollmentMode>((initialValues.enrollmentMode as EnrollmentMode) || "free");
  const [code, setCode] = useState(initialValues.accessCode ?? "");
  const enrollment: EnrollmentControl = { mode, setMode, code, setCode };
  const shown: FormState = { ...state, values: state.values ?? initialValues };
  const props = { ...lookups, state: shown };

  return (
    <form id={WIZARD_FORM_ID} action={action} noValidate className="space-y-6"
      onKeyDown={(e) => { if (e.key === "Enter" && e.target instanceof HTMLInputElement) e.preventDefault(); }}>
      {step === 1 ? (
        <>
          {courseId && <input type="hidden" name="id" value={courseId} />}
          <input type="hidden" name="wizard" value="1" />
          {/* Si la formation est en mode « code d'accès » (réglé à l'étape 4), l'étape 1 ne touche pas au mode d'inscription. */}
          {mode !== "code" && <input type="hidden" name="enrollmentMode" value={mode} />}
        </>
      ) : (
        <>
          <input type="hidden" name="courseId" value={courseId} />
          <input type="hidden" name="step" value={step} />
          {step === 4 && <input type="hidden" name="enrollmentMode" value={mode} />}
          {step === 4 && <input type="hidden" name="accessCode" value={mode === "code" ? code : ""} />}
        </>
      )}

      {state.error && <Alert>{state.error}</Alert>}
      {state.fieldErrors && <Alert>Certaines informations sont incomplètes ou invalides. Corrigez les champs signalés.</Alert>}
      {state.message && <Alert tone="success">{state.message}</Alert>}

      {step === 1 && <StepGeneral {...props} enrollment={enrollment} />}
    </form>
  );
}
