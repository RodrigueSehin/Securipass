import { NextResponse } from "next/server";
import { LEARNER_DISPLAY, parseLearnerFilters, type LearnerRow } from "@/lib/admin/learners";
import { loadLearners } from "@/lib/admin/learners-queries";
import { formatDate } from "@/lib/format";
import { csvLine } from "@/lib/sessions/dashboard";

const MAX_ROWS = 5000;

/** Export CSV : les lignes cochées si présentes, sinon le résultat du filtre courant (5 000 apprenants au plus). */
export async function GET(request: Request) {
  const p = new URL(request.url).searchParams;
  const filters = parseLearnerFilters({
    q: p.get("q") ?? "", onglet: p.get("onglet") ?? "", formation: p.get("formation") ?? "", entreprise: p.get("entreprise") ?? "",
    statut: p.get("statut") ?? "", tri: p.get("tri") ?? "",
  });
  const ids = new Set(p.getAll("id"));

  const rows: LearnerRow[] = [];
  for (let offset = 0; offset < MAX_ROWS; offset += 100) {
    const page = await loadLearners(filters, 100, offset);
    if (page.failed) return new NextResponse("Export indisponible", { status: 503 });
    rows.push(...page.rows);
    if (offset + 100 >= page.total) break;
  }
  const out = ids.size > 0 ? rows.filter((r) => ids.has(r.id)) : rows;
  const lines = [
    csvLine(["Matricule", "Nom", "E-mail", "Téléphone", "Entreprise", "Formation principale", "Inscriptions", "Progression", "Statut", "Compte", "Date d'inscription"]),
    ...out.map((l) => csvLine([
      l.learner_code ?? "", l.full_name, l.email, l.phone ?? "", l.organization ?? "", l.course_title ?? "", l.enrollments_count,
      l.progress === null ? "" : `${l.progress} %`, LEARNER_DISPLAY[l.display_status]?.label ?? l.display_status, l.account_status, formatDate(l.created_at),
    ])),
  ];
  return new NextResponse(`﻿${lines.join("\r\n")}\r\n`, {
    headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": 'attachment; filename="apprenants.csv"' },
  });
}
