"use client";

import { useActionState, useState } from "react";
import { FileText, Info, Pencil, Plus, Save, Trash2 } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { MESSAGE_MAX, type SupportMessage } from "@/lib/admin/support";
import { deleteSupportNote, editSupportNote, postSupportMessage } from "@/lib/admin/support-actions";
import type { FormState } from "@/lib/auth/actions";

const dayFmt = new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "short", year: "numeric", timeZone: "Africa/Abidjan" });
const timeFmt = new Intl.DateTimeFormat("fr-FR", { hour: "2-digit", minute: "2-digit", timeZone: "Africa/Abidjan" });
const when = (iso: string) => `${dayFmt.format(new Date(iso))} à ${timeFmt.format(new Date(iso))}`;
const iconBtn = "flex h-9 w-9 items-center justify-center rounded-lg border bg-white";

/** Onglet « Notes internes » : notes réservées à l'équipe (jamais visibles par l'apprenant), modification, suppression et ajout. */
export function SupportNotes({ ticketId, notes, archived, base }: { ticketId: string; notes: SupportMessage[]; archived: boolean; base: string }) {
  const [editing, setEditing] = useState<string | null>(null);
  const [state, action, pending] = useActionState<FormState, FormData>(postSupportMessage, {});
  const [body, setBody] = useState("");
  const [seen, setSeen] = useState<FormState | null>(null);
  if (state.message && seen !== state) { setSeen(state); setBody(""); }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <FileText className="mt-1 h-6 w-6 text-brand" aria-hidden />
          <div><h3 className="text-lg font-extrabold text-brand-dark">Notes internes</h3><p className="text-sm text-muted">Ajoutez des notes visibles uniquement par l’équipe support (non visibles par l’apprenant).</p></div>
        </div>
        <a href="#nouvelle-note" className="inline-flex items-center gap-2 rounded-lg bg-brand px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-dark"><Plus className="h-4 w-4" aria-hidden />Nouvelle note interne</a>
      </div>

      {notes.length === 0 ? <p className="rounded-lg bg-surface px-4 py-8 text-center text-sm text-muted">Aucune note interne pour le moment.</p> : (
        <ol className="space-y-5">
          {notes.map((n) => (
            <li key={n.id} className="flex gap-3">
              <Avatar name={n.author_name} src={n.author_avatar} size={44} />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="flex flex-wrap items-center gap-2 text-sm">
                    <span className="font-extrabold text-brand-dark">{n.author_name}</span>
                    <span className="rounded-md bg-brand-soft px-2 py-0.5 text-xs font-semibold text-brand">Support</span>
                    <span className="text-brand-dark">{when(n.created_at)}</span>
                  </p>
                  {!archived && editing !== n.id && (
                    <div className="flex items-center gap-2">
                      <button type="button" onClick={() => setEditing(n.id)} aria-label="Modifier la note" className={`${iconBtn} border-line text-brand hover:bg-brand-soft`}><Pencil className="h-4 w-4" aria-hidden /></button>
                      <form action={deleteSupportNote} onSubmit={(e) => { if (!confirm("Supprimer cette note interne ?")) e.preventDefault(); }}>
                        <input type="hidden" name="messageId" value={n.id} /><input type="hidden" name="back" value={`${base}?onglet=notes`} />
                        <button aria-label="Supprimer la note" className={`${iconBtn} border-danger/40 text-danger hover:bg-danger/10`}><Trash2 className="h-4 w-4" aria-hidden /></button>
                      </form>
                    </div>
                  )}
                </div>
                {editing === n.id ? (
                  <form action={editSupportNote} className="mt-1">
                    <input type="hidden" name="messageId" value={n.id} /><input type="hidden" name="back" value={`${base}?onglet=notes`} />
                    <textarea name="body" defaultValue={n.body} maxLength={MESSAGE_MAX} rows={4} required aria-label="Texte de la note" className="w-full rounded-lg border border-warning/50 bg-warning/5 px-3 py-2.5 text-sm text-brand-dark outline-none focus:ring-2 focus:ring-warning/30" />
                    <div className="mt-2 flex gap-2">
                      <button className="inline-flex items-center gap-2 rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-dark"><Save className="h-4 w-4" aria-hidden />Enregistrer</button>
                      <button type="button" onClick={() => setEditing(null)} className="rounded-lg border border-line px-4 py-2 text-sm font-semibold text-brand-dark hover:bg-surface">Annuler</button>
                    </div>
                  </form>
                ) : <p className="mt-1 whitespace-pre-line break-words rounded-xl bg-warning/15 px-4 py-3 text-sm text-brand-dark">{n.body}</p>}
              </div>
            </li>
          ))}
        </ol>
      )}

      <form id="nouvelle-note" action={action} className="mt-6 scroll-mt-4 rounded-xl bg-brand-soft/40 p-4">
        <input type="hidden" name="ticketId" value={ticketId} /><input type="hidden" name="internal" value="1" />
        <h4 className="mb-3 flex items-center gap-2 text-base font-extrabold text-brand-dark"><FileText className="h-5 w-5 text-brand" aria-hidden />Ajouter une note interne</h4>
        <label htmlFor="note-body" className="sr-only">Note interne</label>
        <textarea id="note-body" name="body" value={body} onChange={(e) => setBody(e.target.value)} maxLength={MESSAGE_MAX} rows={4} disabled={archived}
          placeholder={archived ? "Ticket archivé : rouvrez-le pour ajouter une note." : "Rédigez une note interne pour l’équipe support…"}
          className="w-full rounded-lg border border-line bg-white px-3 py-2.5 text-sm text-brand-dark outline-none focus:border-brand focus:ring-2 focus:ring-brand/20" />
        <p className="mt-1 text-right text-xs text-muted">{body.length}/{MESSAGE_MAX}</p>
        {state.fieldErrors?.body && <p role="alert" className="text-xs text-danger">{state.fieldErrors.body[0]}</p>}
        {state.error && <p role="alert" className="text-xs text-danger">{state.error}</p>}
        {state.message && seen === state && <p role="status" className="text-xs text-success">{state.message}</p>}
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <p className="flex items-start gap-2 text-xs text-brand-dark"><Info className="mt-0.5 h-4 w-4 shrink-0 text-brand" aria-hidden /><span>Note interne : visible uniquement par les membres de l’équipe support et les administrateurs. Elle ne sera pas envoyée à l’apprenant.</span></p>
          <button disabled={pending || archived || body.trim().length === 0} className="inline-flex items-center gap-2 rounded-lg bg-brand px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-dark disabled:cursor-not-allowed disabled:opacity-50"><Save className="h-4 w-4" aria-hidden />{pending ? "Enregistrement…" : "Enregistrer la note"}</button>
        </div>
      </form>
    </div>
  );
}
