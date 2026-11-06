import { NextResponse } from "next/server";
import { loadTrainers } from "@/lib/admin/trainers-queries";
import { CONTRACTS, parseTrainerFilters, TRAINER_STATUS, type TrainerRow } from "@/lib/admin/trainers";
import { formatDateTime } from "@/lib/format";
import { csvLine } from "@/lib/sessions/dashboard";

const MAX_ROWS = 5000;

/** Export CSV : les lignes cochées si présentes, sinon le résultat du filtre courant (5 000 formateurs au plus). */
export async function GET(request: Request) {
  const p = new URL(request.url).searchParams;
  const filters = parseTrainerFilters({ q: p.get("q") ?? "", specialite: p.get("specialite") ?? "", statut: p.get("statut") ?? "", contrat: p.get("contrat") ?? "", tri: p.get("tri") ?? "" });
  const ids = new Set(p.getAll("id"));

  const rows: TrainerRow[] = [];
  for (let offset = 0; offset < MAX_ROWS; offset += 100) {
    const page = await loadTrainers(filters, 100, offset);
    if (page.failed) return new NextResponse("Export indisponible", { status: 503 });
    rows.push(...page.rows);
    if (offset + 100 >= page.total) break;
  }
  const out = ids.size > 0 ? rows.filter((r) => ids.has(r.id)) : rows;
  const lines = [
    csvLine(["Nom", "E-mail", "Téléphone", "Spécialités", "Formations", "Apprenants", "Note", "Avis", "Statut", "Type de contrat", "Date d’ajout"]),
    ...out.map((t) => csvLine([
      t.full_name, t.email, t.phone ?? "", t.specialties.join(", "), String(t.courses), String(t.learners),
      t.rating == null ? "" : String(t.rating).replace(".", ","), String(t.reviews),
      TRAINER_STATUS[t.status]?.label ?? t.status, CONTRACTS[t.contract_type]?.label ?? t.contract_type, formatDateTime(t.added_at),
    ])),
  ];
  return new NextResponse(`﻿${lines.join("\r\n")}\r\n`, {
    headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": 'attachment; filename="formateurs.csv"' },
  });
}
