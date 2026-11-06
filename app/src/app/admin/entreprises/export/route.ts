import { NextResponse } from "next/server";
import { loadCompanies } from "@/lib/admin/companies-queries";
import { COMPANY_STATUS, parseCompanyFilters, type CompanyRow } from "@/lib/admin/companies";
import { formatDateTime } from "@/lib/format";
import { csvLine } from "@/lib/sessions/dashboard";

const MAX_ROWS = 5000;

/** Export CSV : les lignes cochées si présentes, sinon le résultat du filtre courant (5 000 entreprises au plus). */
export async function GET(request: Request) {
  const p = new URL(request.url).searchParams;
  const filters = parseCompanyFilters({ q: p.get("q") ?? "", secteur: p.get("secteur") ?? "", statut: p.get("statut") ?? "", ville: p.get("ville") ?? "", tri: p.get("tri") ?? "" });
  const ids = new Set(p.getAll("id"));

  const rows: CompanyRow[] = [];
  for (let offset = 0; offset < MAX_ROWS; offset += 100) {
    const page = await loadCompanies(filters, 100, offset);
    if (page.failed) return new NextResponse("Export indisponible", { status: 503 });
    rows.push(...page.rows);
    if (offset + 100 >= page.total) break;
  }
  const out = ids.size > 0 ? rows.filter((r) => ids.has(r.id)) : rows;
  const lines = [
    csvLine(["Entreprise", "Ville", "Contact principal", "E-mail du contact", "Téléphone du contact", "Secteur d’activité", "Apprenants", "Formations", "Statut", "Date d’inscription"]),
    ...out.map((c) => csvLine([
      c.name, c.city ?? "", c.contact_name ?? "", c.contact_email ?? "", c.contact_phone ?? "", c.industry ?? "",
      String(c.learners), String(c.courses), COMPANY_STATUS[c.status]?.label ?? c.status, formatDateTime(c.created_at),
    ])),
  ];
  return new NextResponse(`﻿${lines.join("\r\n")}\r\n`, {
    headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": 'attachment; filename="entreprises.csv"' },
  });
}
