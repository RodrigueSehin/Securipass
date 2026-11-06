import { Suspense } from "react";
import { notFound } from "next/navigation";
import { PrintButton } from "@/components/admin/billing-toolbar";
import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { INVOICE_STATUS_UI, type InvoiceStatus } from "@/lib/admin/billing";
import { PAYMENT_METHODS, type PaymentMethod } from "@/lib/admin/payments";
import { createClient } from "@/lib/supabase/server";
import { cn, formatFcfa } from "@/lib/utils";

export const metadata = { title: "Facture" };

type Row = {
  id: string; number: string; amount: number; status: InvoiceStatus; issued_at: string; label: string | null; note: string | null;
  learner: { full_name: string | null; email: string; phone: string | null } | null; organization: { name: string; address: string | null; city: string | null } | null;
  course: { title: string } | null; due_date: string | null; lines: { position: number; description: string; quantity: number; unit_price: number; discount_percent: number }[]; payment: { reference: string; method: PaymentMethod; discount_amount: number; fees_amount: number; gross_amount: number | null } | null;
};
const date = (iso: string) => new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long", year: "numeric", timeZone: "Africa/Abidjan" }).format(new Date(iso));

async function Invoice({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const supabase = await createClient();
  const { data: inv } = await supabase.from("invoices")
    .select("id, number, amount, status, issued_at, label, note, learner:profiles(full_name, email, phone), organization:organizations(name, address, city), course:courses(title), due_date, lines:invoice_lines(position, description, quantity, unit_price, discount_percent), payment:payments(reference, method, discount_amount, fees_amount, gross_amount)")
    .eq("id", id).maybeSingle<Row>();
  if (!inv) notFound();
  const st = INVOICE_STATUS_UI[inv.status];
  const name = inv.learner?.full_name || inv.learner?.email || inv.organization?.name || "—";
  const pay = inv.payment;
  return (
    <article className="mx-auto max-w-3xl space-y-6 rounded-2xl border border-line bg-white p-8 shadow-card print:border-0 print:shadow-none">
      <header className="flex flex-wrap items-start justify-between gap-4 border-b border-line pb-5">
        <div><p className="text-2xl font-extrabold text-brand">SECURIPASS</p><p className="text-sm text-muted">Former · Certifier · Sécuriser</p></div>
        <div className="text-right"><p className="text-xl font-extrabold text-brand-dark">Facture {inv.number}</p><p className="text-sm text-muted">Émise le {date(inv.issued_at)}{inv.due_date ? ` · échéance le ${new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${inv.due_date}T00:00:00Z`))}` : ""}</p>
          <span className={cn("mt-2 inline-block rounded-lg px-3 py-1 text-xs font-semibold", st.tone)}>{st.label}</span></div>
      </header>
      <section><p className="text-xs font-semibold uppercase tracking-wide text-muted">Facturé à</p>
        <p className="mt-1 text-lg font-bold text-brand-dark">{name}</p>
        {inv.learner && <p className="text-sm text-brand-dark/80">{inv.learner.email}{inv.learner.phone ? ` · ${inv.learner.phone}` : ""}</p>}
        {inv.organization && <p className="text-sm text-brand-dark/80">{[inv.organization.address, inv.organization.city].filter(Boolean).join(", ")}</p>}
      </section>
      <table className="w-full text-left text-sm">
        <thead className="border-b border-line text-xs text-muted"><tr><th scope="col" className="py-2 font-semibold">Désignation</th><th scope="col" className="py-2 text-right font-semibold">Montant</th></tr></thead>
        <tbody>
          {inv.lines.length > 0 ? [...inv.lines].sort((x, y) => x.position - y.position).map((l) => (
            <tr key={l.position} className="border-b border-line"><td className="py-3 text-brand-dark">{l.description}<span className="block text-xs text-muted">{l.quantity} × {formatFcfa(l.unit_price)}{l.discount_percent > 0 ? ` − ${l.discount_percent} %` : ""}</span></td><td className="py-3 text-right text-brand-dark">{formatFcfa(Math.round(l.quantity * l.unit_price * (1 - l.discount_percent / 100)))}</td></tr>
          )) : (
          <tr className="border-b border-line"><td className="py-3 text-brand-dark">{inv.course?.title ?? inv.label ?? "Prestation"}</td><td className="py-3 text-right text-brand-dark">{formatFcfa(pay?.gross_amount ?? inv.amount)}</td></tr>
          )}
          {pay && pay.discount_amount > 0 && <tr className="border-b border-line"><td className="py-3 text-brand-dark">Remise</td><td className="py-3 text-right text-brand-dark">− {formatFcfa(pay.discount_amount)}</td></tr>}
          {pay && pay.fees_amount > 0 && <tr className="border-b border-line"><td className="py-3 text-brand-dark">Frais</td><td className="py-3 text-right text-brand-dark">{formatFcfa(pay.fees_amount)}</td></tr>}
        </tbody>
        <tfoot><tr><th scope="row" className="py-3 text-base font-extrabold text-brand-dark">Total</th><td className="py-3 text-right text-lg font-extrabold text-brand">{formatFcfa(inv.amount)}</td></tr></tfoot>
      </table>
      {pay && <p className="text-sm text-brand-dark/80">Paiement {pay.reference} · {PAYMENT_METHODS[pay.method]}</p>}
      {inv.note && <p className="rounded-lg bg-surface p-3 text-sm text-brand-dark">{inv.note}</p>}
      <p className="border-t border-line pt-4 text-xs text-muted">Montants en francs CFA (FCFA). Document généré depuis l’administration SECURIPASS.</p>
    </article>
  );
}

export default function InvoicePage(props: { params: Promise<{ id: string }> }) {
  return (
    <div className="space-y-5">
      <div className="print:hidden"><AdminPageHeader crumbs={[{ label: "Factures et remboursements", href: "/admin/factures" }, { label: "Facture" }]} icon="document" title="Facture" description="Aperçu de la facture : imprimez-la ou enregistrez-la en PDF depuis la boîte d’impression." actions={<PrintButton label="Imprimer / PDF" />} /></div>
      <Suspense fallback={<div className="h-96 animate-pulse rounded-2xl bg-white" aria-hidden />}>
        <Invoice {...props} />
      </Suspense>
    </div>
  );
}
