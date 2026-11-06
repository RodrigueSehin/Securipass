"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Save } from "lucide-react";
import { Alert } from "@/components/ui/feedback";
import type { BillingOptions } from "@/lib/admin/billing";
import { createRefund } from "@/lib/admin/billing-actions";
import type { FormState } from "@/lib/auth/actions";
import { formatFcfa } from "@/lib/utils";

const input = "w-full rounded-lg border border-line bg-white px-3 py-2.5 text-sm text-brand-dark outline-none focus:border-brand focus:ring-2 focus:ring-brand/20";
const lbl = "mb-1 block text-sm font-semibold text-brand-dark";
const Err = ({ e }: { e?: string[] }) => (e?.[0] ? <p role="alert" className="mt-1 text-xs text-danger">{e[0]}</p> : null);
const Req = () => <span className="text-danger">*</span>;

/** Remboursement ou avoir sur une facture payée, dans la limite du montant encore disponible. */
export function CreateRefundForm({ refundable, defaultInvoice }: { refundable: BillingOptions["refundable"]; defaultInvoice: string }) {
  const [state, action, pending] = useActionState<FormState, FormData>(createRefund, {});
  const fe = state.fieldErrors ?? {};
  const sv = state.values ?? {};
  const [invoiceId, setInvoiceId] = useState(sv.invoiceId ?? defaultInvoice);
  const [amount, setAmount] = useState(sv.amount ?? "");
  const inv = refundable.find((r) => r.id === invoiceId);
  return (
    <form action={action} noValidate className="max-w-2xl space-y-5 rounded-2xl border border-line bg-white p-6 shadow-card">
      {state.error && <Alert>{state.error}</Alert>}
      <div><label htmlFor="r-type" className={lbl}>Type <Req /></label>
        <select id="r-type" name="type" defaultValue={sv.type ?? "refund"} className={input}><option value="refund">Remboursement (argent rendu)</option><option value="credit">Avoir (crédit sur facture)</option></select><Err e={fe.type} /></div>
      <div><label htmlFor="r-invoice" className={lbl}>Facture payée <Req /></label>
        <select id="r-invoice" name="invoiceId" value={invoiceId} onChange={(e) => { setInvoiceId(e.target.value); const a = refundable.find((r) => r.id === e.target.value)?.available; if (a) setAmount(String(a)); }} className={input} aria-invalid={!!fe.invoiceId}>
          <option value="">Choisir une facture…</option>{refundable.map((r) => <option key={r.id} value={r.id}>{r.number} — {r.payer ?? "—"} ({formatFcfa(r.available)} disponibles)</option>)}</select><Err e={fe.invoiceId} />
        {refundable.length === 0 && <p className="mt-1 text-xs text-muted">Aucune facture payée n’a de montant disponible.</p>}</div>
      <div><label htmlFor="r-amount" className={lbl}>Montant (FCFA) <Req /></label>
        <input id="r-amount" name="amount" inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value)} className={input} aria-invalid={!!fe.amount} /><Err e={fe.amount} />
        {inv && <p className="mt-1 text-xs text-muted">Facture de {formatFcfa(inv.amount)} : {formatFcfa(inv.available)} encore disponibles.</p>}</div>
      <div><label htmlFor="r-reason" className={lbl}>Motif <Req /></label><textarea id="r-reason" name="reason" rows={3} maxLength={500} defaultValue={sv.reason ?? ""} className={input} aria-invalid={!!fe.reason} /><Err e={fe.reason} /></div>
      <p className="text-xs text-muted">Un remboursement est créé « en cours » : marquez-le effectué depuis la liste une fois l’argent rendu. Aucun virement n’est déclenché.</p>
      <div className="flex gap-3">
        <Link href="/admin/factures?onglet=remboursements" className="inline-flex items-center gap-2 rounded-lg border border-brand bg-white px-5 py-2.5 text-sm font-semibold text-brand hover:bg-brand-soft"><ArrowLeft className="h-4 w-4" aria-hidden /> Retour à la liste</Link>
        <button type="submit" disabled={pending} className="inline-flex items-center gap-2 rounded-lg bg-brand px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-dark disabled:opacity-60"><Save className="h-4 w-4" aria-hidden /> {pending ? "Enregistrement…" : "Enregistrer"}</button>
      </div>
    </form>
  );
}
