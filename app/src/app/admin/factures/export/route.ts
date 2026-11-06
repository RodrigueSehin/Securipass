import { NextResponse } from "next/server";
import { INVOICE_STATUS_UI, parseBillingFilters, REFUND_STATUS_UI } from "@/lib/admin/billing";
import { loadCreditNotes, loadInvoices, loadRefunds } from "@/lib/admin/billing-queries";
import { formatDateTime } from "@/lib/format";
import { csvLine } from "@/lib/sessions/dashboard";

const MAX_ROWS = 5000;

/** Export CSV (lisible dans Excel) de l'onglet courant : factures, remboursements ou avoirs (5 000 lignes au plus). */
export async function GET(request: Request) {
  const p = new URL(request.url).searchParams;
  const f = parseBillingFilters({ onglet: p.get("onglet") ?? "", q: p.get("q") ?? "", formation: p.get("formation") ?? "", statut: p.get("statut") ?? "", du: p.get("du") ?? "", au: p.get("au") ?? "" });
  const loader = f.tab === "factures" ? loadInvoices : f.tab === "remboursements" ? loadRefunds : loadCreditNotes;
  const rows: Record<string, unknown>[] = [];
  for (let offset = 0; offset < MAX_ROWS; offset += 100) {
    const page = await loader(f, 100, offset);
    if (page.failed) return new NextResponse("Export indisponible", { status: 503 });
    rows.push(...(page.rows as unknown as Record<string, unknown>[]));
    if (offset + 100 >= page.total) break;
  }
  const s = (v: unknown) => String(v ?? "");
  const lines = f.tab === "factures"
    ? [csvLine(["N° facture", "Apprenant / Client", "Formation / Service", "Montant (FCFA)", "Statut", "Date d'émission"]),
       ...rows.map((r) => csvLine([s(r.number), s(r.payer_name), s(r.purpose), s(r.amount), INVOICE_STATUS_UI[r.status as keyof typeof INVOICE_STATUS_UI]?.label ?? s(r.status), formatDateTime(s(r.issued_at))]))]
    : f.tab === "remboursements"
      ? [csvLine(["N° remboursement", "Apprenant / Client", "Facture", "Motif", "Montant (FCFA)", "Statut", "Date"]),
         ...rows.map((r) => csvLine([s(r.number), s(r.payer_name), s(r.invoice_number), s(r.reason), s(r.amount), REFUND_STATUS_UI[r.status as keyof typeof REFUND_STATUS_UI]?.label ?? s(r.status), formatDateTime(s(r.requested_at))]))]
      : [csvLine(["N° avoir", "Apprenant / Client", "Facture", "Motif", "Montant (FCFA)", "Date d'émission"]),
         ...rows.map((r) => csvLine([s(r.number), s(r.payer_name), s(r.invoice_number), s(r.reason), s(r.amount), formatDateTime(s(r.issued_at))]))];
  return new NextResponse(`﻿${lines.join("\r\n")}\r\n`, {
    headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="${f.tab}.csv"` },
  });
}
