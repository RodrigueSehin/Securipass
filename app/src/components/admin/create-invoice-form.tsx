"use client";

import { useActionState, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, FileText, Info, Mail, MapPin, Paperclip, Phone, Plus, RotateCcw, Save, Send, StickyNote, Trash2, Upload, X, type LucideIcon } from "lucide-react";
import { Alert } from "@/components/ui/feedback";
import { Switch } from "@/components/ui/switch";
import { daysBetween, dueDateFor, INVOICE_FILE_MAX_MB, INVOICE_FILE_TYPES, invoiceTotals, ISSUER, lineAmount, PAYMENT_TERMS, type BillingOptions, type PaymentTerms } from "@/lib/admin/billing";
import { createInvoice } from "@/lib/admin/billing-actions";
import { PAYMENT_METHODS } from "@/lib/admin/payments";
import type { FormState } from "@/lib/auth/actions";
import { createClient } from "@/lib/supabase/browser";
import { cn, formatFcfa } from "@/lib/utils";

const input = "w-full rounded-lg border border-line bg-white px-3 py-2.5 text-sm text-brand-dark outline-none focus:border-brand focus:ring-2 focus:ring-brand/20";
const cell = "w-full rounded-lg border border-line bg-white px-2.5 py-2 text-sm text-brand-dark outline-none focus:border-brand focus:ring-2 focus:ring-brand/20";
const lbl = "mb-1 block text-sm font-semibold text-brand-dark";
const Err = ({ e }: { e?: string[] }) => (e?.[0] ? <p role="alert" className="mt-1 text-xs text-danger">{e[0]}</p> : null);
const Req = () => <span className="text-danger">*</span>;
const DISCOUNTS = [0, 5, 10, 15, 20, 25, 30, 50];
const METHODS = ["mobile_money", "bank_transfer", "card", "cash", "cheque"] as const;

type Line = { description: string; quantity: string; unitPrice: string; discount: number };
type Doc = { path: string; name: string; size: number };
const num = (v: string) => Number(v.replace(/\s/g, "")) || 0;

function Section({ icon: Icon, title, optional, children, className }: { icon: LucideIcon; title: string; optional?: boolean; children: React.ReactNode; className?: string }) {
  return (
    <section className={cn("rounded-2xl border border-line bg-white p-5 shadow-card", className)}>
      <h2 className="mb-4 flex items-center gap-3 text-base font-extrabold text-brand-dark"><Icon className="h-5 w-5 text-brand" aria-hidden />{title}{optional && <span className="text-sm font-normal text-muted">(optionnelles)</span>}</h2>
      {children}
    </section>
  );
}

/** Création d'une facture : informations, lignes détaillées avec remises, conditions et notes, aperçu des totaux, pièces jointes et envoi au client. */
export function CreateInvoiceForm({ options, today }: { options: BillingOptions; today: string }) {
  const [state, action, pending] = useActionState<FormState, FormData>(createInvoice, {});
  const [formKey, setFormKey] = useState(0);
  return <Inner key={formKey} state={state} action={action} pending={pending} reset={() => setFormKey((k) => k + 1)} options={options} today={today} />;
}

function Inner({ state, action, pending, reset, options, today }: { state: FormState; action: (f: FormData) => void; pending: boolean; reset: () => void; options: BillingOptions; today: string }) {
  const fe = state.fieldErrors ?? {};
  const sv = state.values ?? {};
  const [payerRef, setPayerRef] = useState(sv.payerRef ?? "");
  const [courseId, setCourseId] = useState(sv.courseId ?? "");
  const [subject, setSubject] = useState(sv.subject ?? "");
  const [issued, setIssued] = useState(sv.issuedDate ?? today);
  const [terms, setTerms] = useState<PaymentTerms>((sv.paymentTerms as PaymentTerms) ?? "net14");
  const [due, setDue] = useState(sv.dueDate ?? dueDateFor(sv.issuedDate ?? today, (sv.paymentTerms as PaymentTerms) ?? "net14"));
  const [lines, setLines] = useState<Line[]>([{ description: "", quantity: "1", unitPrice: "", discount: 0 }]);
  const [methods, setMethods] = useState<string[]>(["mobile_money", "bank_transfer"]);
  const [note, setNote] = useState(sv.note ?? "");
  const [sendEmail, setSendEmail] = useState(sv.sendEmail === "1");
  const [email, setEmail] = useState(sv.clientEmail ?? "");
  const [docs, setDocs] = useState<Doc[]>([]);
  const [docMsg, setDocMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const parsed = lines.map((l) => ({ quantity: Math.max(0, Math.floor(num(l.quantity))), unitPrice: num(l.unitPrice), discountPercent: l.discount }));
  const t = invoiceTotals(parsed);
  const course = options.all_courses.find((c) => c.id === courseId);
  const payer = payerRef.startsWith("learner:") ? options.learners.find((l) => l.id === payerRef.slice(8)) : options.organizations.find((o) => o.id === payerRef.slice(8));

  const setLine = (i: number, p: Partial<Line>) => setLines((ls) => ls.map((l, j) => (j === i ? { ...l, ...p } : l)));
  function pickPayer(ref: string) {
    setPayerRef(ref);
    const p = ref.startsWith("learner:") ? options.learners.find((l) => l.id === ref.slice(8)) : options.organizations.find((o) => o.id === ref.slice(8));
    if (p?.email) setEmail(p.email);
  }
  function pickCourse(id: string) {
    setCourseId(id);
    const c = options.all_courses.find((x) => x.id === id);
    if (!c) return;
    if (!subject) setSubject(`Formation ${c.title}`);
    setLines((ls) => (ls.length === 1 && !ls[0].description ? [{ description: `Frais de formation – ${c.title}`, quantity: "1", unitPrice: String(Math.round(c.price)), discount: 0 }] : ls));
  }
  function pickTerms(v: PaymentTerms) { setTerms(v); setDue(dueDateFor(issued, v)); }
  function pickIssued(v: string) { setIssued(v); if (v) setDue(dueDateFor(v, terms)); }

  async function addFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const files = [...(e.target.files ?? [])];
    if (fileRef.current) fileRef.current.value = "";
    if (!files.length) return;
    setDocMsg(null);
    if (docs.length + files.length > 10) return setDocMsg("10 fichiers au maximum.");
    const bad = files.find((f) => !(INVOICE_FILE_TYPES as readonly string[]).includes(f.type) || f.size > INVOICE_FILE_MAX_MB * 1024 * 1024);
    if (bad) return setDocMsg(`« ${bad.name} » : PDF, DOC, JPG ou PNG de ${INVOICE_FILE_MAX_MB} Mo maximum.`);
    setBusy(true);
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("auth");
      const added: Doc[] = [];
      for (const f of files) {
        const path = `${user.id}/${crypto.randomUUID()}-${f.name.replace(/[^\w.-]+/g, "_").slice(-80)}`;
        const { error } = await supabase.storage.from("invoice-files").upload(path, f, { contentType: f.type, upsert: false });
        if (error) throw error;
        added.push({ path, name: f.name.slice(0, 200), size: f.size });
      }
      setDocs((d) => [...d, ...added]);
    } catch { setDocMsg("Impossible d’envoyer un fichier. Réessayez."); } finally { setBusy(false); }
  }

  return (
    <form action={action} noValidate className="space-y-6">
      {state.error && <Alert>{state.error}</Alert>}
      {lines.map((l, i) => <input key={i} type="hidden" name="line" value={JSON.stringify({ description: l.description, quantity: parsed[i].quantity, unitPrice: parsed[i].unitPrice, discountPercent: l.discount })} />)}
      {docs.map((d) => <input key={d.path} type="hidden" name="file" value={JSON.stringify(d)} />)}
      {methods.map((m) => <input key={m} type="hidden" name="method" value={m} />)}
      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <div className="space-y-6">
          <Section icon={Info} title="Informations générales">
            <div className="grid gap-4 md:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_minmax(0,1fr)]">
              <div><label className={lbl}>N° de facture</label><input readOnly value="Attribué à l’enregistrement" className={cn(input, "bg-surface")} /></div>
              <div><label htmlFor="i-issued" className={lbl}>Date d’émission <Req /></label><input id="i-issued" name="issuedDate" type="date" max={today} value={issued} onChange={(e) => pickIssued(e.target.value)} className={input} aria-invalid={!!fe.issuedDate} /><Err e={fe.issuedDate} /></div>
              <div><label htmlFor="i-due" className={lbl}>Date d’échéance <Req /></label>
                <div className="relative"><input id="i-due" name="dueDate" type="date" min={issued} value={due} onChange={(e) => setDue(e.target.value)} className={input} aria-invalid={!!fe.dueDate} />
                  {issued && due && <span className="pointer-events-none absolute right-9 top-1/2 -translate-y-1/2 rounded bg-brand-soft px-1.5 py-0.5 text-xs font-semibold text-brand">{daysBetween(issued, due)} jours</span>}</div><Err e={fe.dueDate} /></div>
            </div>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <div><label htmlFor="i-payer" className={lbl}>Client / Entreprise <Req /></label>
                <select id="i-payer" name="payerRef" value={payerRef} onChange={(e) => pickPayer(e.target.value)} className={input} aria-invalid={!!fe.payerRef}>
                  <option value="">Choisir…</option>
                  <optgroup label="Apprenants">{options.learners.map((l) => <option key={l.id} value={`learner:${l.id}`}>{l.name}</option>)}</optgroup>
                  <optgroup label="Entreprises">{options.organizations.map((o) => <option key={o.id} value={`company:${o.id}`}>{o.name}</option>)}</optgroup>
                </select><Err e={fe.payerRef} /></div>
              <div><label htmlFor="i-course" className={lbl}>Formation / Service</label>
                <select id="i-course" name="courseId" value={courseId} onChange={(e) => pickCourse(e.target.value)} className={input} aria-invalid={!!fe.courseId}>
                  <option value="">Aucune (service libre)</option>{options.all_courses.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}</select><Err e={fe.courseId} /></div>
            </div>
            <div className="mt-4"><label htmlFor="i-subject" className={lbl}>Objet de la facture <Req /></label><input id="i-subject" name="subject" maxLength={200} value={subject} onChange={(e) => setSubject(e.target.value)} className={input} aria-invalid={!!fe.subject} /><Err e={fe.subject} /></div>
          </Section>

          <Section icon={FileText} title="Détails de la facture">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[40rem] text-left text-sm">
                <thead className="bg-surface text-xs text-brand-dark"><tr>
                  <th scope="col" className="w-8 px-2 py-2.5 font-semibold">#</th><th scope="col" className="px-2 py-2.5 font-semibold">Désignation <Req /></th><th scope="col" className="w-20 px-2 py-2.5 font-semibold">Quantité <Req /></th>
                  <th scope="col" className="w-32 px-2 py-2.5 font-semibold">Prix unitaire (FCFA) <Req /></th><th scope="col" className="w-24 px-2 py-2.5 font-semibold">Remise</th><th scope="col" className="w-28 px-2 py-2.5 text-right font-semibold">Montant (FCFA)</th><th scope="col" className="w-8"><span className="sr-only">Supprimer</span></th>
                </tr></thead>
                <tbody>
                  {lines.map((l, i) => (
                    <tr key={i} className="border-t border-line align-top">
                      <td className="px-2 py-2.5 text-muted">{i + 1}</td>
                      <td className="px-2 py-2"><input value={l.description} onChange={(e) => setLine(i, { description: e.target.value })} maxLength={200} aria-label={`Désignation de la ligne ${i + 1}`} className={cell} /></td>
                      <td className="px-2 py-2"><input value={l.quantity} onChange={(e) => setLine(i, { quantity: e.target.value })} inputMode="numeric" aria-label={`Quantité de la ligne ${i + 1}`} className={cell} /></td>
                      <td className="px-2 py-2"><input value={l.unitPrice} onChange={(e) => setLine(i, { unitPrice: e.target.value })} inputMode="numeric" aria-label={`Prix unitaire de la ligne ${i + 1}`} className={cell} /></td>
                      <td className="px-2 py-2"><select value={l.discount} onChange={(e) => setLine(i, { discount: Number(e.target.value) })} aria-label={`Remise de la ligne ${i + 1}`} className={cell}>{DISCOUNTS.map((d) => <option key={d} value={d}>{d} %</option>)}</select></td>
                      <td className="whitespace-nowrap px-2 py-2.5 text-right font-semibold text-brand-dark">{new Intl.NumberFormat("fr-FR").format(lineAmount(parsed[i]))}</td>
                      <td className="px-1 py-2"><button type="button" onClick={() => setLines((ls) => (ls.length > 1 ? ls.filter((_, j) => j !== i) : ls))} disabled={lines.length <= 1} aria-label={`Supprimer la ligne ${i + 1}`} className="rounded p-1.5 text-danger hover:bg-danger/10 disabled:opacity-30"><Trash2 className="h-4 w-4" aria-hidden /></button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Err e={fe.lines} />
            <button type="button" onClick={() => setLines((ls) => (ls.length < 30 ? [...ls, { description: "", quantity: "1", unitPrice: "", discount: 0 }] : ls))} className="mt-3 inline-flex items-center gap-2 rounded-lg border border-brand px-4 py-2 text-sm font-semibold text-brand hover:bg-brand-soft"><Plus className="h-4 w-4" aria-hidden />Ajouter une ligne</button>
          </Section>

          <Section icon={StickyNote} title="Conditions et notes">
            <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
              <div><label htmlFor="i-terms" className={lbl}>Conditions de paiement</label>
                <select id="i-terms" name="paymentTerms" value={terms} onChange={(e) => pickTerms(e.target.value as PaymentTerms)} className={input}>{Object.entries(PAYMENT_TERMS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select><Err e={fe.paymentTerms} /></div>
              <fieldset><legend className={lbl}>Mode de paiement accepté</legend>
                <div className="flex flex-wrap gap-x-4 gap-y-2 pt-1.5">
                  {METHODS.map((m) => (
                    <label key={m} className="flex cursor-pointer items-center gap-2 text-sm text-brand-dark"><input type="checkbox" checked={methods.includes(m)} onChange={() => setMethods((x) => (x.includes(m) ? x.filter((y) => y !== m) : [...x, m]))} className="h-4 w-4 rounded border-line accent-[var(--color-brand)]" />{PAYMENT_METHODS[m]}</label>
                  ))}
                </div></fieldset>
            </div>
            <div className="mt-4"><label htmlFor="i-note" className={lbl}>Notes <span className="font-normal text-muted">(optionnelles)</span></label>
              <textarea id="i-note" name="note" rows={3} maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} className={input} />
              <p className="mt-1 text-right text-xs text-muted">{note.length} / 500</p><Err e={fe.note} /></div>
          </Section>
        </div>

        <div className="space-y-6">
          <Section icon={FileText} title="Aperçu de la facture">
            <div className="border-b border-line pb-4">
              <p className="text-2xl font-extrabold text-brand">SECURIPASS</p><p className="text-xs text-muted">Former · Certifier · Sécuriser</p>
              <ul className="mt-3 space-y-1.5 text-sm text-brand-dark">
                <li className="flex items-center gap-2"><MapPin className="h-4 w-4 text-muted" aria-hidden />{ISSUER.address}</li>
                <li className="flex items-center gap-2"><Phone className="h-4 w-4 text-muted" aria-hidden />{ISSUER.phone}</li>
                <li className="flex items-center gap-2"><Mail className="h-4 w-4 text-muted" aria-hidden />{ISSUER.email}</li>
              </ul>
              {(payer || course) && <p className="mt-3 text-sm text-brand-dark/80">Facturé à <b>{payer?.name ?? "—"}</b>{course ? ` · ${course.title}` : ""}</p>}
            </div>
            <dl className="mt-3 space-y-1.5 text-sm text-brand-dark">
              <div className="flex justify-between"><dt>Sous-total</dt><dd>{formatFcfa(t.subtotal)}</dd></div>
              <div className="flex justify-between"><dt>Remise globale</dt><dd>{t.discount > 0 ? `− ${formatFcfa(t.discount)}` : formatFcfa(0)}</dd></div>
            </dl>
            <div className="mt-3 flex items-center justify-between rounded-lg bg-brand-soft px-3 py-3 text-lg font-extrabold"><span className="text-brand-dark">Total</span><span className="text-brand">{formatFcfa(t.total)}</span></div>
            <p className="mt-2 text-xs text-muted">Aucune TVA n’est appliquée : le total est la somme des lignes après remises.</p>
          </Section>

          <Section icon={Paperclip} title="Pièces jointes" optional>
            <input ref={fileRef} id="i-files" type="file" multiple accept={INVOICE_FILE_TYPES.join(",")} onChange={addFiles} className="sr-only" />
            <label htmlFor="i-files" className="flex cursor-pointer flex-col items-center gap-1 rounded-xl border-2 border-dashed border-line px-4 py-6 text-center hover:bg-brand-soft/40">
              <Upload className="h-7 w-7 text-brand" aria-hidden /><span className="text-sm font-bold text-brand-dark">{busy ? "Envoi…" : "Glissez-déposez vos fichiers ici ou cliquez pour sélectionner"}</span>
              <span className="text-xs text-muted">PDF, DOC, JPG, PNG – max. {INVOICE_FILE_MAX_MB} Mo</span>
            </label>
            {(docMsg || fe.files) && <p role="alert" className="mt-1 text-xs text-danger">{docMsg ?? fe.files?.[0]}</p>}
            {docs.length > 0 && (
              <ul className="mt-3 space-y-1.5">
                {docs.map((d) => (
                  <li key={d.path} className="flex items-center gap-2 rounded-lg border border-line px-3 py-1.5 text-sm text-brand-dark">
                    <FileText className="h-4 w-4 shrink-0 text-brand" aria-hidden /><span className="min-w-0 flex-1 truncate">{d.name}</span><span className="text-xs text-muted">{Math.max(1, Math.round(d.size / 1024))} Ko</span>
                    <button type="button" onClick={() => setDocs((x) => x.filter((y) => y.path !== d.path))} aria-label={`Retirer ${d.name}`} className="text-muted hover:text-danger"><X className="h-4 w-4" aria-hidden /></button>
                  </li>
                ))}
              </ul>
            )}
          </Section>

          <section className="rounded-2xl border border-line bg-white p-5 shadow-card">
            <div className="flex items-center gap-3"><Switch name="sendEmail" label="Envoyer la facture au client par e-mail" on={sendEmail} onChange={setSendEmail} /><span className="text-sm font-bold text-brand-dark">Envoyer la facture au client par e-mail</span></div>
            <div className="mt-3"><label htmlFor="i-email" className={lbl}>E-mail du client</label>
              <input id="i-email" name="clientEmail" type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={input} aria-invalid={!!fe.clientEmail} /><Err e={fe.clientEmail} /></div>
            <p className="mt-2 text-xs text-muted">L’adresse est enregistrée avec la facture ; aucun e-mail n’est envoyé pour l’instant : transmettez la facture (impression ou PDF) au client.</p>
          </section>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link href="/admin/factures" className="inline-flex items-center gap-2 rounded-lg border border-brand bg-white px-5 py-2.5 text-sm font-semibold text-brand hover:bg-brand-soft"><ArrowLeft className="h-4 w-4" aria-hidden /> Retour à la liste</Link>
        <div className="flex flex-wrap gap-3">
          <button type="button" onClick={reset} className="inline-flex items-center gap-2 rounded-lg border border-brand bg-white px-5 py-2.5 text-sm font-semibold text-brand hover:bg-brand-soft"><RotateCcw className="h-4 w-4" aria-hidden /> Réinitialiser</button>
          <button type="submit" name="intent" value="draft" disabled={pending || busy} className="inline-flex items-center gap-2 rounded-lg border border-brand bg-white px-5 py-2.5 text-sm font-semibold text-brand hover:bg-brand-soft disabled:opacity-60"><Save className="h-4 w-4" aria-hidden /> Enregistrer en brouillon</button>
          <button type="submit" name="intent" value="issue" disabled={pending || busy} className="inline-flex items-center gap-2 rounded-lg bg-brand px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-dark disabled:opacity-60"><Send className="h-4 w-4" aria-hidden /> {pending ? "Enregistrement…" : "Émettre la facture"}</button>
        </div>
      </div>
    </form>
  );
}
