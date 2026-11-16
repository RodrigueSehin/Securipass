"use client";

import { useActionState, useState } from "react";
import { Bookmark, FileText, Send } from "lucide-react";
import { AttachFileButton } from "@/components/admin/support-attachments";
import { MESSAGE_MAX } from "@/lib/admin/support";
import { postSupportMessage } from "@/lib/admin/support-actions";
import type { FormState } from "@/lib/auth/actions";
import { cn } from "@/lib/utils";

/** Réponse à l'utilisateur ou note interne (jamais visible par lui). Le message s'envoie en texte brut ; les fichiers rejoignent les pièces jointes du ticket. */
export function SupportReplyForm({ ticketId, archived }: { ticketId: string; archived: boolean }) {
  const [state, action, pending] = useActionState<FormState, FormData>(postSupportMessage, {});
  const [internal, setInternal] = useState(state.values?.internal === "1");
  const [body, setBody] = useState(state.values?.body ?? "");
  const [seen, setSeen] = useState<FormState | null>(null);
  // Après un envoi réussi, le champ se vide
  if (state.message && seen !== state) { setSeen(state); setBody(""); }

  return (
    <form action={action} className="border-t border-line pt-4">
      <input type="hidden" name="ticketId" value={ticketId} />
      <input type="hidden" name="internal" value={internal ? "1" : "0"} />
      <div role="tablist" aria-label="Type de message" className="mb-3 flex gap-1">
        <button type="button" role="tab" aria-selected={!internal} onClick={() => setInternal(false)}
          className={cn("rounded-lg px-4 py-2 text-sm font-semibold", !internal ? "bg-brand-soft text-brand" : "text-brand-dark hover:bg-surface")}>Répondre à l’utilisateur</button>
        <button type="button" role="tab" aria-selected={internal} onClick={() => setInternal(true)}
          className={cn("inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold", internal ? "bg-warning/15 text-[#a16207]" : "text-brand-dark hover:bg-surface")}><FileText className="h-4 w-4" aria-hidden />Note interne (non visible par l’utilisateur)</button>
      </div>
      <label htmlFor="reply-body" className="sr-only">{internal ? "Note interne" : "Réponse"}</label>
      <textarea id="reply-body" name="body" value={body} onChange={(e) => setBody(e.target.value)} maxLength={MESSAGE_MAX} rows={5} disabled={archived}
        placeholder={archived ? "Ticket archivé : rouvrez-le pour répondre." : internal ? "Rédigez une note pour l’équipe…" : "Rédigez votre réponse…"}
        className={cn("w-full rounded-lg border px-3 py-2.5 text-sm text-brand-dark outline-none focus:ring-2", internal ? "border-warning/50 bg-warning/5 focus:ring-warning/30" : "border-line bg-white focus:border-brand focus:ring-brand/20")} />
      {state.fieldErrors?.body && <p role="alert" className="mt-1 text-xs text-danger">{state.fieldErrors.body[0]}</p>}
      {state.error && <p role="alert" className="mt-1 text-xs text-danger">{state.error}</p>}
      {state.message && seen === state && <p role="status" className="mt-1 text-xs text-success">{state.message}</p>}
      <div className="mt-3 flex flex-wrap items-start justify-between gap-3">
        <AttachFileButton ticketId={ticketId} disabled={archived} variant="inline" />
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-xs text-muted">{body.length}/{MESSAGE_MAX}</span>
          <button type="button" disabled title="Modèles de réponses : bientôt disponible" className="inline-flex cursor-not-allowed items-center gap-2 rounded-lg border border-line bg-white px-4 py-2.5 text-sm font-semibold text-brand opacity-50"><Bookmark className="h-4 w-4" aria-hidden /> Enregistrer comme modèle</button>
          <button disabled={pending || archived || body.trim().length === 0} className="inline-flex items-center gap-2 rounded-lg bg-brand px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-dark disabled:cursor-not-allowed disabled:opacity-50">
            <Send className="h-4 w-4" aria-hidden /> {pending ? "Envoi…" : internal ? "Enregistrer la note" : "Envoyer la réponse"}
          </button>
        </div>
      </div>
    </form>
  );
}
