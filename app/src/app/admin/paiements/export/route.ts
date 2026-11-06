import { NextResponse } from "next/server";
import { PAYMENT_METHODS, PAYMENT_STATUS_UI, parsePaymentFilters, type PaymentRow } from "@/lib/admin/payments";
import { loadPayments } from "@/lib/admin/payments-queries";
import { formatDateTime } from "@/lib/format";
import { csvLine } from "@/lib/sessions/dashboard";

const MAX_ROWS = 5000;

/** Export CSV (lisible dans Excel) du résultat du filtre courant (5 000 paiements au plus). */
export async function GET(request: Request) {
  const p = new URL(request.url).searchParams;
  const filters = parsePaymentFilters({ q: p.get("q") ?? "", formation: p.get("formation") ?? "", statut: p.get("statut") ?? "", du: p.get("du") ?? "", au: p.get("au") ?? "" });
  const rows: PaymentRow[] = [];
  for (let offset = 0; offset < MAX_ROWS; offset += 100) {
    const page = await loadPayments(filters, 100, offset);
    if (page.failed) return new NextResponse("Export indisponible", { status: 503 });
    rows.push(...page.rows);
    if (offset + 100 >= page.total) break;
  }
  const lines = [
    csvLine(["Référence", "Apprenant / Entreprise", "Formation / Service", "Montant (FCFA)", "Mode de paiement", "Date de paiement", "Statut"]),
    ...rows.map((r) => csvLine([r.reference, r.payer_name ?? "", r.purpose, r.amount, PAYMENT_METHODS[r.method] ?? r.method, formatDateTime(r.paid_at), PAYMENT_STATUS_UI[r.status]?.label ?? r.status])),
  ];
  return new NextResponse(`﻿${lines.join("\r\n")}\r\n`, {
    headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": 'attachment; filename="paiements.csv"' },
  });
}
