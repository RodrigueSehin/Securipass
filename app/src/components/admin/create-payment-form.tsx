"use client";

import { useActionState, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, Calculator, CalendarDays, Clock, CreditCard, FileText, Info, Layers, Paperclip, RotateCcw, Save, Upload, X, type LucideIcon } from "lucide-react";
import { Alert } from "@/components/ui/feedback";
import { NOTE_MAX, PAYMENT_KINDS, PAYMENT_METHODS, paymentTotals, PROOF_MAX_MB, TRANSACTION_REF_MAX, type PaymentOptions } from "@/lib/admin/payments";
import { createPayment } from "@/lib/admin/payments-actions";
import type { FormState } from "@/lib/auth/actions";
import { createClient } from "@/lib/supabase/browser";
import { cn, formatFcfa } from "@/lib/utils";

const input = "w-full rounded-lg border border-line bg-white px-3 py-2.5 text-sm text-brand-dark outline-none focus:border-brand focus:ring-2 focus:ring-brand/20";
const lbl = "mb-1 block text-sm font-semibold text-brand-dark";
const Err = ({ e }: { e?: string[] }) => (e?.[0] ? <p role="alert" className="mt-1 text-xs text-danger">{e[0]}</p> : null);
const Req = () => <span className="text-danger">*</span>;

export type PayCourse = { id: string; title: string; price: number; level: string | null; durationLabel: string | null; cover: string | null };
export type PaySession = { id: string; courseId: string; label: string };

function Section({ icon: Icon, title, optional, children, className }: { icon: LucideIcon; title: string; optional?: boolean; children: React.ReactNode; className?: string }) {
  return (
    <section className={cn("rounded-2xl border border-line bg-white p-5 shadow-card", className)}>
      <h2 className="mb-4 flex items-center gap-3 text-base font-extrabold text-brand-dark"><Icon className="h-5 w-5 text-brand" aria-hidden />{title}{optional && <span className="text-sm font-normal text-muted">(optionnel)</span>}</h2>
      {children}
    </section>
  );
}

const num = (v: string) => Number(v.replace(/\s/g, "").replace(",", ".")) || 0;

/** Enregistrement d'un paiement : informations, détails financiers (remise, frais, total), mode et statut, récapitulatif, justificatif et notes. */
export function CreatePaymentForm({ options, courses, sessions, today, nowTime }: { options: PaymentOptions; courses: PayCourse[]; sessions: PaySession[]; today: string; nowTime: string }) {
  const [state, action, pending] = useActionState<FormState, FormData>(createPayment, {});
  const [formKey, setFormKey] = useState(0);
  return <Inner key={formKey} state={state} action={action} pending={pending} reset={() => setFormKey((k) => k + 1)} options={options} courses={courses} sessions={sessions} today={today} nowTime={nowTime} />;
}

function Inner({ state, action, pending, reset, options, courses, sessions, today, nowTime }: {
  state: FormState; action: (f: FormData) => void; pending: boolean; reset: () => void; options: PaymentOptions; courses: PayCourse[]; sessions: PaySession[]; today: string; nowTime: string;
}) {
  const fe = state.fieldErrors ?? {};
  const sv = state.values ?? {};
  const [kind, setKind] = useState(sv.kind ?? "course");
  const [courseId, setCourseId] = useState(sv.courseId ?? "");
  const [sessionId, setSessionId] = useState(sv.sessionId ?? "");
  const [label, setLabel] = useState(sv.label ?? "");
  const [amount, setAmount] = useState(sv.amount ?? "");
  const [discount, setDiscount] = useState(sv.discount ?? "0");
  const [unit, setUnit] = useState<"fcfa" | "percent">(sv.discountUnit === "percent" ? "percent" : "fcfa");
  const [fees, setFees] = useState(sv.fees ?? "0");
  const [note, setNote] = useState(sv.note ?? "");
  const [proof, setProof] = useState<{ path: string; name: string; size: number } | null>(null);
  const [proofMsg, setProofMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const withCourse = kind === "course" || kind === "certification";
  const course = courses.find((c) => c.id === courseId);
  const courseSessions = sessions.filter((s) => s.courseId === courseId);
  const session = sessions.find((s) => s.id === sessionId);
  const gross = num(amount);
  const t = paymentTotals(gross, num(discount), unit, num(fees));

  function pickCourse(id: string) {
    setCourseId(id); setSessionId("");
    const price = courses.find((c) => c.id === id)?.price ?? 0;
    if (price > 0) setAmount(String(price));
  }

  async function addProof(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (fileRef.current) fileRef.current.value = "";
    if (!file) return;
    setProofMsg(null);
    if (!["application/pdf", "image/jpeg", "image/png"].includes(file.type) || file.size > PROOF_MAX_MB * 1024 * 1024) return setProofMsg(`PDF, JPG ou PNG de ${PROOF_MAX_MB} Mo maximum.`);
    setBusy(true);
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("auth");
      const path = `${user.id}/${crypto.randomUUID()}-${file.name.replace(/[^\w.-]+/g, "_").slice(-80)}`;
      const { error } = await supabase.storage.from("payment-proofs").upload(path, file, { contentType: file.type, upsert: false });
      if (error) throw error;
      setProof({ path, name: file.name.slice(0, 200), size: file.size });
    } catch {
      setProofMsg("Impossible d’envoyer le fichier. Réessayez.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form action={action} noValidate className="space-y-6">
      {state.error && <Alert>{state.error}</Alert>}
      <input type="hidden" name="proofPath" value={proof?.path ?? ""} />
      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <div className="space-y-6">
          <Section icon={Info} title="Informations du paiement">
            <div className="grid gap-4 md:grid-cols-2">
              <div><label htmlFor="p-payer" className={lbl}>Apprenant / Client <Req /></label>
                <select id="p-payer" name="payerRef" defaultValue={sv.payerRef ?? ""} className={input} aria-invalid={!!fe.payerRef}>
                  <option value="">Choisir…</option>
                  <optgroup label="Apprenants">{options.learners.map((l) => <option key={l.id} value={`learner:${l.id}`}>{l.name}</option>)}</optgroup>
                  <optgroup label="Entreprises">{options.organizations.map((o) => <option key={o.id} value={`company:${o.id}`}>{o.name}</option>)}</optgroup>
                </select><Err e={fe.payerRef} /></div>
              <div><label htmlFor="p-kind" className={lbl}>Type de paiement <Req /></label>
                <select id="p-kind" name="kind" value={kind} onChange={(e) => setKind(e.target.value)} className={input}>{Object.keys(PAYMENT_KINDS).map((k) => <option key={k} value={k}>{k === "course" ? "Paiement de formation" : k === "certification" ? "Paiement de certification" : k === "session" ? "Paiement de session" : "Autre service"}</option>)}</select><Err e={fe.kind} /></div>
              {withCourse ? (
                <div><label htmlFor="p-course" className={lbl}>Formation / Service <Req /></label>
                  <select id="p-course" name="courseId" value={courseId} onChange={(e) => pickCourse(e.target.value)} className={input} aria-invalid={!!fe.courseId}><option value="">Choisir une formation…</option>{courses.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}</select><Err e={fe.courseId} /></div>
              ) : (
                <div><label htmlFor="p-label" className={lbl}>Formation / Service <Req /></label><input id="p-label" name="label" maxLength={200} value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Ex. Audit de site, formation groupée…" className={input} aria-invalid={!!fe.label} /><Err e={fe.label} /></div>
              )}
              <div><label htmlFor="p-session" className={lbl}>Session <span className="font-normal text-muted">(optionnelle)</span></label>
                <select id="p-session" name="sessionId" value={sessionId} onChange={(e) => setSessionId(e.target.value)} className={input} aria-invalid={!!fe.sessionId}>
                  <option value="">Aucune session</option>{(withCourse ? courseSessions : sessions).map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}</select><Err e={fe.sessionId} /></div>
              <div><label className={lbl}>Référence / N° de paiement</label><input readOnly value="Attribuée à l’enregistrement" className={cn(input, "bg-surface")} /></div>
              <div className="grid grid-cols-[minmax(0,1fr)_7rem] gap-3">
                <div><label htmlFor="p-date" className={lbl}>Date de paiement <Req /></label><input id="p-date" name="paidDate" type="date" max={today} defaultValue={sv.paidDate ?? today} className={input} aria-invalid={!!fe.paidDate} /><Err e={fe.paidDate} /></div>
                <div><label htmlFor="p-time" className={lbl}>Heure <Req /></label><input id="p-time" name="paidTime" type="time" defaultValue={sv.paidTime ?? nowTime} className={input} aria-invalid={!!fe.paidTime} /><Err e={fe.paidTime} /></div>
              </div>
            </div>
          </Section>

          <Section icon={Layers} title="Détails financiers">
            <div className="grid gap-4 md:grid-cols-2">
              <div><label htmlFor="p-amount" className={lbl}>Montant (FCFA) <Req /></label><input id="p-amount" name="amount" inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value)} className={input} aria-invalid={!!fe.amount} /><Err e={fe.amount} /></div>
              <div><label htmlFor="p-discount" className={lbl}>Remise <span className="font-normal text-muted">(optionnelle)</span></label>
                <div className="flex gap-2">
                  <input id="p-discount" name="discount" inputMode="decimal" value={discount} onChange={(e) => setDiscount(e.target.value)} className={input} aria-invalid={!!fe.discount} />
                  <input type="hidden" name="discountUnit" value={unit} />
                  <div role="group" aria-label="Unité de la remise" className="flex shrink-0 overflow-hidden rounded-lg border border-line text-sm font-semibold">
                    {([["fcfa", "FCFA"], ["percent", "%"]] as const).map(([u, l]) => <button key={u} type="button" onClick={() => setUnit(u)} aria-pressed={unit === u} className={cn("px-3", unit === u ? "bg-brand text-white" : "bg-white text-brand-dark hover:bg-brand-soft")}>{l}</button>)}
                  </div>
                </div><Err e={fe.discount} /></div>
              <div><label htmlFor="p-fees" className={lbl}>Frais <span className="font-normal text-muted">(optionnels)</span></label><input id="p-fees" name="fees" inputMode="numeric" value={fees} onChange={(e) => setFees(e.target.value)} className={input} aria-invalid={!!fe.fees} /><Err e={fe.fees} /></div>
              <div className="rounded-xl bg-brand-soft/70 p-3"><p className="text-sm font-semibold text-brand-dark">Montant total à payer <Req /></p>
                <p className="mt-1 flex items-center gap-2 text-2xl font-extrabold text-brand-dark"><Calculator className="h-5 w-5 text-brand" aria-hidden />{formatFcfa(Math.max(0, t.total))}</p></div>
            </div>
          </Section>

          <Section icon={CreditCard} title="Mode et statut">
            <div className="grid gap-4 md:grid-cols-2">
              <div><label htmlFor="p-method" className={lbl}>Mode de paiement <Req /></label>
                <select id="p-method" name="method" defaultValue={sv.method ?? "mobile_money"} className={input}>{Object.entries(PAYMENT_METHODS).map(([k, l]) => <option key={k} value={k}>{k === "mobile_money" ? "Mobile Money (Orange Money, MTN, Wave)" : l}</option>)}</select><Err e={fe.method} /></div>
              <div><label htmlFor="p-status" className={lbl}>Statut <Req /></label>
                <select id="p-status" name="status" defaultValue={sv.status ?? "confirmed"} className={input}><option value="confirmed">Confirmé</option><option value="pending">En attente</option><option value="failed">Échoué</option></select><Err e={fe.status} /></div>
            </div>
            <div className="mt-4"><label htmlFor="p-tx" className={lbl}>Référence de transaction (opérateur)</label>
              <input id="p-tx" name="transactionRef" maxLength={TRANSACTION_REF_MAX} defaultValue={sv.transactionRef ?? ""} placeholder="OM-784523001" className={input} aria-invalid={!!fe.transactionRef} /><Err e={fe.transactionRef} /></div>
          </Section>
        </div>

        <div className="space-y-6">
          <Section icon={FileText} title="Récapitulatif du paiement">
            <div className="flex items-start gap-3 border-b border-line pb-4">
              <span className="relative flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-brand-soft">
                {course?.cover ? <Image src={course.cover} alt="" fill sizes="80px" className="object-cover" unoptimized={course.cover.startsWith("http")} /> : <FileText className="h-7 w-7 text-brand" aria-hidden />}
              </span>
              <div className="min-w-0 space-y-1 text-sm">
                <p className="font-extrabold text-brand-dark">{withCourse ? course?.title ?? "Formation à choisir" : label || "Service à préciser"}</p>
                {withCourse && course?.level && <p className="text-brand-dark/80">Formation {course.level}</p>}
                {session && <p className="flex items-center gap-1.5 text-brand-dark/80"><CalendarDays className="h-4 w-4 text-muted" aria-hidden />Session : {session.label}</p>}
                {withCourse && course?.durationLabel && <p className="flex items-center gap-1.5 text-brand-dark/80"><Clock className="h-4 w-4 text-muted" aria-hidden />Durée : {course.durationLabel}</p>}
              </div>
            </div>
            <dl className="mt-3 space-y-1.5 text-sm text-brand-dark">
              <div className="flex justify-between"><dt>Montant</dt><dd>{formatFcfa(gross)}</dd></div>
              <div className="flex justify-between"><dt>Remise</dt><dd>{t.discount > 0 ? `− ${formatFcfa(t.discount)}` : formatFcfa(0)}</dd></div>
              <div className="flex justify-between"><dt>Frais</dt><dd>{formatFcfa(Math.round(t.fees))}</dd></div>
            </dl>
            <div className="mt-3 flex items-center justify-between rounded-lg bg-brand-soft px-3 py-3 font-extrabold text-brand"><span className="text-brand-dark">Total à payer</span><span>{formatFcfa(Math.max(0, t.total))}</span></div>
          </Section>

          <Section icon={Paperclip} title="Pièce justificative" optional>
            <input ref={fileRef} id="p-proof" type="file" accept="application/pdf,image/jpeg,image/png" onChange={addProof} className="sr-only" />
            {proof ? (
              <div className="flex items-center gap-2 rounded-lg border border-line px-3 py-2.5 text-sm text-brand-dark">
                <FileText className="h-5 w-5 shrink-0 text-brand" aria-hidden /><span className="min-w-0 flex-1 truncate font-semibold">{proof.name}</span><span className="text-xs text-muted">{Math.max(1, Math.round(proof.size / 1024))} Ko</span>
                <button type="button" onClick={() => setProof(null)} aria-label="Retirer le justificatif" className="text-muted hover:text-danger"><X className="h-4 w-4" aria-hidden /></button>
              </div>
            ) : (
              <label htmlFor="p-proof" className="flex cursor-pointer flex-col items-center gap-1 rounded-xl border-2 border-dashed border-line px-4 py-6 text-center hover:bg-brand-soft/40">
                <Upload className="h-7 w-7 text-brand" aria-hidden /><span className="text-sm font-bold text-brand-dark">{busy ? "Envoi…" : "Glissez-déposez votre justificatif ici ou cliquez pour sélectionner un fichier"}</span>
                <span className="text-xs text-muted">PDF, JPG, PNG (max. {PROOF_MAX_MB} Mo)</span>
              </label>
            )}
            {(proofMsg || fe.proofPath) && <p role="alert" className="mt-1 text-xs text-danger">{proofMsg ?? fe.proofPath?.[0]}</p>}
          </Section>

          <Section icon={FileText} title="Notes" optional>
            <textarea name="note" rows={4} maxLength={NOTE_MAX} value={note} onChange={(e) => setNote(e.target.value)} aria-label="Notes" className={input} />
            <p className="mt-1 text-right text-xs text-muted">{note.length} / {NOTE_MAX}</p><Err e={fe.note} />
          </Section>
        </div>
      </div>

      <p className="text-xs text-muted">Le paiement est saisi à la main : aucun prélèvement n’est déclenché. Un paiement en attente se confirme ensuite depuis la liste.</p>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link href="/admin/paiements" className="inline-flex items-center gap-2 rounded-lg border border-brand bg-white px-5 py-2.5 text-sm font-semibold text-brand hover:bg-brand-soft"><ArrowLeft className="h-4 w-4" aria-hidden /> Retour à la liste</Link>
        <div className="flex gap-3">
          <button type="button" onClick={reset} className="inline-flex items-center gap-2 rounded-lg border border-brand bg-white px-5 py-2.5 text-sm font-semibold text-brand hover:bg-brand-soft"><RotateCcw className="h-4 w-4" aria-hidden /> Réinitialiser</button>
          <button type="submit" disabled={pending || busy} className="inline-flex items-center gap-2 rounded-lg bg-brand px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-dark disabled:opacity-60"><Save className="h-4 w-4" aria-hidden /> {pending ? "Enregistrement…" : "Enregistrer le paiement"}</button>
        </div>
      </div>
    </form>
  );
}
