"use client";

import { useActionState } from "react";
import { changePassword, removePhoto, updatePersonal, updatePreferences, updateProfessional, uploadPhoto } from "@/lib/profile/actions";
import type { FormState } from "@/lib/auth/actions";
import { AVAILABILITY, EDUCATION, EXPERIENCE, GENDERS, LANGUAGES, TIMEZONES } from "@/lib/profile/schemas";
import { Button } from "@/components/ui/button";
import { Field, SelectField, TextareaField } from "@/components/ui/field";
import { Alert } from "@/components/ui/feedback";

type Profile = {
  full_name: string; email: string; phone: string | null; timezone: string;
  gender: string | null; nationality: string | null; locality: string | null; address: string | null;
  profession: string | null; employer: string | null; experience_band: string | null; education_level: string | null;
  languages: string[]; availability: string | null; training_goal: string | null;
  preferences: Record<string, unknown>;
};

const initial: FormState = {};

function Messages({ state }: { state: FormState }) {
  return (
    <>
      {state.message && <Alert tone="success">{state.message}</Alert>}
      {state.error && <Alert>{state.error}</Alert>}
    </>
  );
}

export function PersonalForm({ profile }: { profile: Profile }) {
  const [state, action, pending] = useActionState<FormState, FormData>(updatePersonal, initial);
  const fe = state.fieldErrors;
  return (
    <form action={action} className="grid gap-4 rounded-2xl border border-line bg-white p-6 shadow-card sm:grid-cols-2" noValidate>
      <div className="sm:col-span-2"><Messages state={state} /></div>
      <Field label="Nom complet" name="fullName" required autoComplete="name" defaultValue={profile.full_name} errors={fe?.fullName} />
      <Field label="Adresse e-mail" name="email" type="email" defaultValue={profile.email} disabled hint="Non modifiable ici." />
      <SelectField label="Genre" name="gender" defaultValue={profile.gender ?? ""} errors={fe?.gender}>
        <option value="">Non renseigné</option>
        {Object.entries(GENDERS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
      </SelectField>
      <Field label="Nationalité" name="nationality" defaultValue={profile.nationality ?? ""} errors={fe?.nationality} />
      <Field label="Téléphone" name="phone" type="tel" autoComplete="tel" defaultValue={profile.phone ?? ""} errors={fe?.phone} />
      <SelectField label="Fuseau horaire" name="timezone" defaultValue={profile.timezone} errors={fe?.timezone}>
        {TIMEZONES.map((tz) => <option key={tz} value={tz}>{tz}</option>)}
      </SelectField>
      <Field label="Localisation" name="locality" placeholder="Ex. : Abidjan, Côte d’Ivoire" defaultValue={profile.locality ?? ""} errors={fe?.locality} />
      <Field label="Adresse" name="address" placeholder="Ex. : Cocody, Riviera Palmeraie" defaultValue={profile.address ?? ""} errors={fe?.address} />
      <div className="sm:col-span-2"><Button type="submit" disabled={pending}>{pending ? "Enregistrement…" : "Enregistrer"}</Button></div>
    </form>
  );
}

export function ProfessionalForm({ profile }: { profile: Profile }) {
  const [state, action, pending] = useActionState<FormState, FormData>(updateProfessional, initial);
  const fe = state.fieldErrors;
  return (
    <form action={action} className="grid gap-4 rounded-2xl border border-line bg-white p-6 shadow-card sm:grid-cols-2" noValidate>
      <div className="sm:col-span-2"><Messages state={state} /></div>
      <Field label="Profession" name="profession" defaultValue={profile.profession ?? ""} errors={fe?.profession} />
      <Field label="Entreprise actuelle" name="employer" defaultValue={profile.employer ?? ""} errors={fe?.employer} />
      <SelectField label="Niveau d’expérience" name="experienceBand" defaultValue={profile.experience_band ?? ""} errors={fe?.experienceBand}>
        <option value="">Non renseigné</option>
        {Object.entries(EXPERIENCE).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
      </SelectField>
      <SelectField label="Niveau d’études" name="educationLevel" defaultValue={profile.education_level ?? ""} errors={fe?.educationLevel}>
        <option value="">Non renseigné</option>
        {Object.entries(EDUCATION).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
      </SelectField>
      <SelectField label="Disponibilité" name="availability" defaultValue={profile.availability ?? ""} errors={fe?.availability}>
        <option value="">Non renseignée</option>
        {Object.entries(AVAILABILITY).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
      </SelectField>
      <fieldset className="sm:col-span-2">
        <legend className="mb-2 text-sm font-medium text-brand-dark">Langues</legend>
        <div className="flex flex-wrap gap-3">
          {Object.entries(LANGUAGES).map(([k, v]) => (
            <label key={k} className="flex items-center gap-2 text-sm text-brand-dark">
              <input type="checkbox" name="languages" value={k} defaultChecked={profile.languages.includes(k)} className="h-4 w-4 accent-[var(--color-brand)]" />
              {v}
            </label>
          ))}
        </div>
        {fe?.languages && <p className="mt-1 text-xs text-danger">{fe.languages[0]}</p>}
      </fieldset>
      <div className="sm:col-span-2">
        <TextareaField label="Objectif de formation" name="trainingGoal" rows={3} defaultValue={profile.training_goal ?? ""} errors={fe?.trainingGoal} />
      </div>
      <div className="sm:col-span-2"><Button type="submit" disabled={pending}>{pending ? "Enregistrement…" : "Enregistrer"}</Button></div>
    </form>
  );
}

export function PreferencesForm({ profile }: { profile: Profile }) {
  const [state, action, pending] = useActionState<FormState, FormData>(updatePreferences, initial);
  const p = profile.preferences;
  return (
    <form action={action} className="space-y-4 rounded-2xl border border-line bg-white p-6 shadow-card" noValidate>
      <Messages state={state} />
      <label className="flex items-start gap-3 text-sm text-brand-dark">
        <input type="checkbox" name="notifyEmail" defaultChecked={p.notify_email !== false} className="mt-1 h-4 w-4 accent-[var(--color-brand)]" />
        <span>Recevoir les notifications par e-mail<span className="block text-xs text-muted">Inscriptions, sessions, évaluations, certificats.</span></span>
      </label>
      <label className="flex items-start gap-3 text-sm text-brand-dark">
        <input type="checkbox" name="notifySms" defaultChecked={p.notify_sms === true} className="mt-1 h-4 w-4 accent-[var(--color-brand)]" />
        <span>Recevoir les rappels par SMS<span className="block text-xs text-muted">Disponible lorsque le prestataire SMS sera intégré.</span></span>
      </label>
      <Button type="submit" disabled={pending}>{pending ? "Enregistrement…" : "Enregistrer"}</Button>
    </form>
  );
}

export function PasswordForm() {
  const [state, action, pending] = useActionState<FormState, FormData>(changePassword, initial);
  const fe = state.fieldErrors;
  return (
    <form action={action} className="space-y-4 rounded-2xl border border-line bg-white p-6 shadow-card" noValidate>
      <Messages state={state} />
      <Field label="Mot de passe actuel" name="currentPassword" type="password" autoComplete="current-password" required errors={fe?.currentPassword} />
      <Field label="Nouveau mot de passe" name="newPassword" type="password" autoComplete="new-password" required hint="10 caractères minimum, avec une lettre et un chiffre." errors={fe?.newPassword} />
      <Field label="Confirmer le nouveau mot de passe" name="confirmPassword" type="password" autoComplete="new-password" required errors={fe?.confirmPassword} />
      <Button type="submit" disabled={pending}>{pending ? "Modification…" : "Modifier le mot de passe"}</Button>
    </form>
  );
}

export function PhotoForm({ hasPhoto }: { hasPhoto: boolean }) {
  const [state, action, pending] = useActionState<FormState, FormData>(uploadPhoto, initial);
  const fe = state.fieldErrors;
  return (
    <div className="space-y-4 rounded-2xl border border-line bg-white p-6 shadow-card">
      <Messages state={state} />
      <form action={action} className="flex flex-wrap items-end gap-3" noValidate>
        <label className="min-w-0 flex-1 text-sm">
          <span className="mb-1 block font-medium text-brand-dark">Choisir une image</span>
          <input type="file" name="photo" accept="image/jpeg,image/png" required className="block w-full text-sm" />
          <span className="mt-1 block text-xs text-muted">Formats acceptés : JPG, PNG (2 Mo maximum).</span>
          {fe?.photo && <span className="mt-1 block text-xs text-danger">{fe.photo[0]}</span>}
        </label>
        <Button type="submit" disabled={pending}>{pending ? "Envoi…" : "Changer la photo"}</Button>
      </form>
      {hasPhoto && (
        <form action={removePhoto}>
          <button className="text-sm font-semibold text-danger hover:underline">Supprimer la photo</button>
        </form>
      )}
    </div>
  );
}
