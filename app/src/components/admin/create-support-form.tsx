"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { Alert } from "@/components/ui/feedback";
import { createSupportTicket } from "@/lib/admin/support-actions";
import { DESCRIPTION_MAX, SUBJECT_MAX, SUPPORT_CATEGORIES, SUPPORT_PRIORITIES, type SupportCategory, type SupportPriority, type SupportRequester } from "@/lib/admin/support";
import type { FormState } from "@/lib/auth/actions";
import { cn } from "@/lib/utils";

const input = "w-full rounded-lg border border-line bg-white px-3 py-2.5 text-sm text-brand-dark outline-none focus:border-brand focus:ring-2 focus:ring-brand/20";
const lbl = "mb-1 block text-sm font-semibold text-brand-dark";
const Err = ({ e }: { e?: string[] }) => (e?.[0] ? <p role="alert" className="mt-1 text-xs text-danger">{e[0]}</p> : null);
const Req = () => <span className="text-danger">*</span>;

/** Ouverture d'un ticket par l'administration pour un demandeur. */
export function CreateSupportForm({ requesters, courses }: { requesters: SupportRequester[]; courses: { id: string; title: string }[] }) {
  const [state, action, pending] = useActionState<FormState, FormData>(createSupportTicket, {});
  const fe = state.fieldErrors ?? {};
  const sv = state.values ?? {};
  const [priority, setPriority] = useState<SupportPriority>((sv.priority as SupportPriority) ?? "medium");
  const [subject, setSubject] = useState(sv.subject ?? "");
  const [description, setDescription] = useState(sv.description ?? "");

  return (
    <form action={action} noValidate className="max-w-3xl space-y-5 rounded-2xl border border-line bg-white p-6 shadow-card">
      {state.error && <Alert>{state.error}</Alert>}
      <div className="grid gap-4 md:grid-cols-2">
        <div className="md:col-span-2"><label htmlFor="s-demandeur" className={lbl}>Demandeur <Req /></label>
          <select id="s-demandeur" name="requesterId" defaultValue={sv.requesterId ?? ""} className={input} aria-invalid={!!fe.requesterId}>
            <option value="">Choisir un utilisateur…</option>
            {requesters.map((r) => <option key={r.id} value={r.id}>{r.name}{r.code ? ` (${r.code})` : ""} — {r.email}</option>)}
          </select><Err e={fe.requesterId} /></div>
        <div><label htmlFor="s-categorie" className={lbl}>Catégorie <Req /></label>
          <select id="s-categorie" name="category" defaultValue={sv.category ?? "formations"} className={input} aria-invalid={!!fe.category}>
            {(Object.keys(SUPPORT_CATEGORIES) as SupportCategory[]).map((k) => <option key={k} value={k}>{SUPPORT_CATEGORIES[k]}</option>)}
          </select><Err e={fe.category} /></div>
        <fieldset>
          <legend className={lbl}>Priorité <Req /></legend>
          <div className="grid grid-cols-3 gap-2">
            {(Object.keys(SUPPORT_PRIORITIES) as SupportPriority[]).map((k) => (
              <label key={k} className={cn("flex cursor-pointer items-center justify-center gap-2 rounded-lg border px-2 py-2.5 text-sm font-semibold text-brand-dark", priority === k ? "border-brand bg-brand-soft" : "border-line hover:bg-surface")}>
                <input type="radio" name="priority" value={k} checked={priority === k} onChange={() => setPriority(k)} className="sr-only" />
                <span className={cn("h-2.5 w-2.5 rounded-full", SUPPORT_PRIORITIES[k].dot)} aria-hidden />{SUPPORT_PRIORITIES[k].label}
              </label>
            ))}
          </div><Err e={fe.priority} />
        </fieldset>
        <div className="md:col-span-2"><label htmlFor="s-formation" className={lbl}>Formation concernée <span className="font-normal text-muted">(optionnelle)</span></label>
          <select id="s-formation" name="courseId" defaultValue={sv.courseId ?? ""} className={input} aria-invalid={!!fe.courseId}>
            <option value="">Aucune formation</option>
            {courses.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
          </select><Err e={fe.courseId} /></div>
        <div className="md:col-span-2"><label htmlFor="s-sujet" className={lbl}>Sujet <Req /></label>
          <input id="s-sujet" name="subject" value={subject} onChange={(e) => setSubject(e.target.value)} maxLength={SUBJECT_MAX} className={input} aria-invalid={!!fe.subject} /><Err e={fe.subject} /></div>
        <div className="md:col-span-2"><label htmlFor="s-description" className={lbl}>Description <span className="font-normal text-muted">(optionnelle)</span></label>
          <textarea id="s-description" name="description" value={description} onChange={(e) => setDescription(e.target.value)} maxLength={DESCRIPTION_MAX} rows={6} className={input} aria-invalid={!!fe.description} />
          <p className="text-right text-xs text-muted">{description.length}/{DESCRIPTION_MAX}</p><Err e={fe.description} /></div>
      </div>
      <p className="text-xs text-muted">La demande est enregistrée au statut « Nouveau », sans responsable. Le délai de résolution visé est de 8 h (priorité haute), 24 h (moyenne) ou 72 h (basse). Aucun e-mail n’est envoyé au demandeur.</p>
      <div className="flex justify-end gap-3 border-t border-line pt-4">
        <Link href="/admin/support" className="rounded-lg border border-brand bg-white px-5 py-2.5 text-sm font-semibold text-brand hover:bg-brand-soft">Annuler</Link>
        <button disabled={pending} className="rounded-lg bg-brand px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-dark disabled:opacity-50">{pending ? "Enregistrement…" : "Créer la demande"}</button>
      </div>
    </form>
  );
}
