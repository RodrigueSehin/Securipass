"use client";

import { useActionState } from "react";
import { submitRequest } from "@/lib/requests/actions";
import type { FormState } from "@/lib/auth/actions";
import type { RequestKind } from "@/lib/requests/schemas";
import { Button } from "@/components/ui/button";
import { Field, TextareaField } from "@/components/ui/field";
import { Alert } from "@/components/ui/feedback";

const LABELS: Record<Exclude<RequestKind, "newsletter">, { message: string; submit: string }> = {
  contact: { message: "Votre message", submit: "Envoyer le message" },
  quote: { message: "Votre besoin (formations, dates, lieu…)", submit: "Demander un devis" },
  trainer_application: { message: "Présentez votre parcours et vos qualifications", submit: "Envoyer ma candidature" },
};

export function RequestForm({ kind }: { kind: Exclude<RequestKind, "newsletter"> }) {
  const [state, action, pending] = useActionState<FormState, FormData>(submitRequest, {});
  const fe = state.fieldErrors;
  const v = state.values;

  if (state.message) return <Alert tone="success">{state.message}</Alert>;

  return (
    <form action={action} className="space-y-4 rounded-2xl border border-line bg-white p-6 shadow-card" noValidate>
      <input type="hidden" name="kind" value={kind} />
      {/* Champ piège anti-spam : masqué pour les humains et les lecteurs d'écran */}
      <div aria-hidden className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
        <label>Ne pas remplir<input type="text" name="website" tabIndex={-1} autoComplete="off" /></label>
      </div>
      {state.error && <Alert>{state.error}</Alert>}

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Nom complet" name="fullName" autoComplete="name" required defaultValue={v?.fullName} errors={fe?.fullName} />
        <Field label="Adresse e-mail" name="email" type="email" autoComplete="email" required defaultValue={v?.email} errors={fe?.email} />
        <Field
          label={kind === "trainer_application" ? "Téléphone" : "Téléphone (facultatif)"}
          name="phone" type="tel" autoComplete="tel" placeholder="+225 07 00 00 00 00"
          required={kind === "trainer_application"} defaultValue={v?.phone} errors={fe?.phone}
        />
        {kind === "contact" && <Field label="Objet" name="subject" required defaultValue={v?.subject} errors={fe?.subject} />}
        {kind === "quote" && (
          <>
            <Field label="Entreprise" name="organization" autoComplete="organization" required defaultValue={v?.organization} errors={fe?.organization} />
            <Field label="Nombre de collaborateurs à former" name="headcount" type="number" min={1} required defaultValue={v?.headcount} errors={fe?.headcount} />
          </>
        )}
        {kind === "trainer_application" && (
          <>
            <Field label="Spécialité" name="specialty" placeholder="Ex. : SST, sécurité incendie…" required defaultValue={v?.specialty} errors={fe?.specialty} />
            <Field label="Années d’expérience" name="experienceYears" type="number" min={0} required defaultValue={v?.experienceYears} errors={fe?.experienceYears} />
          </>
        )}
      </div>
      <TextareaField label={LABELS[kind].message} name="message" required defaultValue={v?.message} errors={fe?.message} />
      {kind === "trainer_application" && (
        <p className="text-xs text-muted">Les justificatifs vous seront demandés après étude de votre candidature.</p>
      )}
      <Button type="submit" disabled={pending}>{pending ? "Envoi…" : LABELS[kind].submit}</Button>
    </form>
  );
}
