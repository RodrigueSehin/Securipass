"use client";

import { useActionState } from "react";
import { ChevronDown, Send } from "lucide-react";
import { submitRequest } from "@/lib/requests/actions";
import type { FormState } from "@/lib/auth/actions";
import { CONTACT_TOPICS } from "@/lib/requests/schemas";
import { Alert } from "@/components/ui/feedback";
import { Field, TextareaField } from "@/components/ui/field";
import { cn } from "@/lib/utils";


export function ContactForm({ defaultTopic }: { defaultTopic?: string }) {
  const [state, action, pending] = useActionState<FormState, FormData>(submitRequest, {});
  const fe = state.fieldErrors;
  const v = state.values;
  const topic = v?.requestType ?? defaultTopic ?? "";
  const topicErr = fe?.requestType?.[0];

  if (state.message) return <Alert tone="success">{state.message}</Alert>;

  return (
    <form action={action} noValidate className="space-y-4">
      <input type="hidden" name="kind" value="contact" />
      <div aria-hidden className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
        <label>Ne pas remplir<input type="text" name="website" tabIndex={-1} autoComplete="off" /></label>
      </div>
      {state.error && <Alert>{state.error}</Alert>}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Nom complet *" name="fullName" placeholder="Votre nom complet" autoComplete="name" required defaultValue={v?.fullName} errors={fe?.fullName} />
        <Field label="Email *" name="email" type="email" placeholder="votre@email.com" autoComplete="email" required defaultValue={v?.email} errors={fe?.email} />
        <Field label="Téléphone *" name="phone" type="tel" placeholder="+225 07 00 00 00 00" autoComplete="tel" required defaultValue={v?.phone} errors={fe?.phone} />
        <div>
          <label htmlFor="f-requestType" className="mb-1 block text-sm font-medium text-brand-dark">Type de demande *</label>
          <div className="relative">
            <select
              id="f-requestType" name="requestType" required defaultValue={topic} aria-invalid={!!topicErr}
              className={cn("w-full appearance-none rounded-lg border bg-white px-3 py-2.5 pr-9 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20", topicErr ? "border-danger" : "border-line", !topic && "text-muted")}
            >
              <option value="" disabled>Sélectionnez une option</option>
              {CONTACT_TOPICS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
            <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden />
          </div>
          {topicErr && <p role="alert" className="mt-1 text-xs text-danger">{topicErr}</p>}
        </div>
      </div>
      <Field label="Sujet *" name="subject" placeholder="Objet de votre message" required defaultValue={v?.subject} errors={fe?.subject} />
      <TextareaField label="Votre message *" name="message" rows={5} placeholder="Détaillez votre demande…" required defaultValue={v?.message} errors={fe?.message} />
      <button type="submit" disabled={pending} className="flex w-full items-center justify-center gap-2.5 rounded-lg bg-cta px-5 py-3.5 text-base font-semibold text-white transition-colors hover:bg-cta-dark disabled:cursor-not-allowed disabled:opacity-50">
        <Send className="h-5 w-5" aria-hidden />{pending ? "Envoi…" : "Envoyer le message"}
      </button>
    </form>
  );
}
