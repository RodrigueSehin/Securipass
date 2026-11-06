"use client";

import { useActionState, useState } from "react";
import { cancelSession, enrollLearnerByEmail, saveSession } from "@/lib/sessions/actions";
import type { FormState } from "@/lib/auth/actions";
import { MODES, type Mode } from "@/lib/courses/labels";
import { Button } from "@/components/ui/button";
import { Field, SelectField } from "@/components/ui/field";
import { Alert } from "@/components/ui/feedback";

export type SessionDefaults = {
  id?: string;
  title?: string;
  start?: string;
  end?: string;
  deadline?: string;
  delivery_mode?: Mode;
  location?: string | null;
  meeting_url?: string | null;
  capacity?: number;
  waitlist_enabled?: boolean;
  status?: string;
  timezone?: string;
};

export function SessionForm({ courseId, defaults = {} }: { courseId: string; defaults?: SessionDefaults }) {
  const [state, action, pending] = useActionState<FormState, FormData>(saveSession, {});
  const [mode, setMode] = useState<Mode>(defaults.delivery_mode ?? "onsite");
  const fe = state.fieldErrors;
  const v = state.values;
  const k = defaults.id ?? "new";

  return (
    <form action={action} className="space-y-4" noValidate>
      <input type="hidden" name="courseId" value={courseId} />
      {defaults.id && <input type="hidden" name="sessionId" value={defaults.id} />}
      {defaults.timezone && <input type="hidden" name="timezone" value={defaults.timezone} />}
      {state.error && <Alert>{state.error}</Alert>}
      {state.message && <Alert tone="success">{state.message}</Alert>}
      <Field label="Nom de la session" name="title" id={`s-title-${k}`} required defaultValue={v?.title ?? defaults.title} errors={fe?.title} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Début (heure de la session)" name="start" id={`s-start-${k}`} type="datetime-local" required defaultValue={v?.start ?? defaults.start} errors={fe?.start} />
        <Field label="Fin (heure de la session)" name="end" id={`s-end-${k}`} type="datetime-local" required defaultValue={v?.end ?? defaults.end} errors={fe?.end} />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <SelectField label="Modalité" name="deliveryMode" id={`s-mode-${k}`} value={mode} onChange={(e) => setMode(e.target.value as Mode)} errors={fe?.deliveryMode}>
          {Object.entries(MODES).map(([m, l]) => <option key={m} value={m}>{l}</option>)}
        </SelectField>
        <Field label="Capacité (places)" name="capacity" id={`s-cap-${k}`} type="number" min="1" required defaultValue={v?.capacity ?? String(defaults.capacity ?? 20)} errors={fe?.capacity} />
      </div>
      {mode !== "online" && <Field label="Lieu" name="location" id={`s-loc-${k}`} required defaultValue={v?.location ?? defaults.location ?? ""} errors={fe?.location} />}
      {mode !== "onsite" && (
        <Field label="Lien de connexion (https://…)" name="meetingUrl" id={`s-url-${k}`} type="url" required defaultValue={v?.meetingUrl ?? defaults.meeting_url ?? ""} errors={fe?.meetingUrl}
          hint="Visible uniquement des inscrits confirmés, de vous et de l’équipe SECURIPASS." />
      )}
      <Field label="Date limite d’inscription (facultatif)" name="registrationDeadline" id={`s-dl-${k}`} type="datetime-local" defaultValue={v?.registrationDeadline ?? defaults.deadline ?? ""} errors={fe?.registrationDeadline}
        hint="Par défaut, les inscriptions ferment au début de la session." />
      <label className="flex items-center gap-2 text-sm text-brand-dark">
        <input type="checkbox" name="waitlistEnabled" defaultChecked={defaults.waitlist_enabled ?? false} /> Activer la liste d’attente lorsque la session est complète
      </label>
      <div className="flex flex-wrap gap-3">
        <Button type="submit" disabled={pending}>{pending ? "Enregistrement…" : defaults.id ? (defaults.status === "draft" ? "Publier la session" : "Enregistrer la session") : "Créer la session"}</Button>
        {(!defaults.id || defaults.status === "draft") && (
          <Button type="submit" name="draft" value="1" variant="outline" disabled={pending}>Enregistrer comme brouillon</Button>
        )}
      </div>
    </form>
  );
}

export function EnrollByEmailForm({ sessionId }: { sessionId: string }) {
  const [state, action, pending] = useActionState<FormState, FormData>(enrollLearnerByEmail, {});
  return (
    <form action={action} className="space-y-3" noValidate>
      <input type="hidden" name="sessionId" value={sessionId} />
      {state.error && <Alert>{state.error}</Alert>}
      {state.message && <Alert tone="success">{state.message}</Alert>}
      <Field label="E-mail de l’apprenant" name="email" id="enroll-email" type="email" required defaultValue={state.values?.email} errors={state.fieldErrors?.email}
        hint="L’apprenant doit déjà avoir un compte. Inscription manuelle : le paiement éventuel se règle hors plateforme." />
      <Button type="submit" disabled={pending}>{pending ? "Ajout…" : "Inscrire l’apprenant"}</Button>
    </form>
  );
}

export function CancelSessionForm({ sessionId, courseId }: { sessionId: string; courseId: string }) {
  const [state, action, pending] = useActionState<FormState, FormData>(cancelSession, {});
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="sessionId" value={sessionId} />
      <input type="hidden" name="courseId" value={courseId} />
      {state.error && <Alert>{state.error}</Alert>}
      {state.message && <Alert tone="success">{state.message}</Alert>}
      <p className="text-sm text-muted">Annuler la session annule toutes les inscriptions associées. Cette action est irréversible.</p>
      <label className="flex items-center gap-2 text-sm text-brand-dark">
        <input type="checkbox" required /> Je confirme l’annulation de cette session
      </label>
      <Button type="submit" variant="outline" disabled={pending} className="border-danger text-danger hover:bg-danger/10">{pending ? "Annulation…" : "Annuler la session"}</Button>
    </form>
  );
}
