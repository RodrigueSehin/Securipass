import { NextResponse } from "next/server";
import { EVALUATION_KINDS, EVALUATION_STATUS_UI, evaluationDate, parseEvaluationFilters, type EvaluationRow } from "@/lib/admin/evaluations";
import { loadEvaluations } from "@/lib/admin/evaluations-queries";
import { formatDateTime } from "@/lib/format";
import { csvLine } from "@/lib/sessions/dashboard";

const MAX_ROWS = 5000;

/** Export CSV : les lignes cochées si présentes, sinon le résultat du filtre courant (5 000 évaluations au plus). */
export async function GET(request: Request) {
  const p = new URL(request.url).searchParams;
  const filters = parseEvaluationFilters({
    q: p.get("q") ?? "", formation: p.get("formation") ?? "", session: p.get("session") ?? "", statut: p.get("statut") ?? "",
    du: p.get("du") ?? "", au: p.get("au") ?? "", tri: p.get("tri") ?? "",
  });
  const ids = new Set(p.getAll("id"));

  const rows: EvaluationRow[] = [];
  for (let offset = 0; offset < MAX_ROWS; offset += 100) {
    const page = await loadEvaluations(filters, 100, offset);
    if (page.failed) return new NextResponse("Export indisponible", { status: 503 });
    rows.push(...page.rows);
    if (offset + 100 >= page.total) break;
  }
  const out = ids.size > 0 ? rows.filter((r) => ids.has(r.id)) : rows;
  const lines = [
    csvLine(["Titre", "Formation", "Session", "Type", "Questions", "Date", "Participants", "Résultats", "Réussis", "Note de réussite", "Statut"]),
    ...out.map((e) => {
      const date = evaluationDate(e);
      return csvLine([
        e.title, e.course_title, e.session_title ?? "", EVALUATION_KINDS[e.kind]?.label ?? e.kind, e.questions, date ? formatDateTime(date, e.timezone) : "",
        e.participants, e.results, e.passed, `${e.passing_score} %`, EVALUATION_STATUS_UI[e.display_status]?.label ?? e.display_status,
      ]);
    }),
  ];
  return new NextResponse(`﻿${lines.join("\r\n")}\r\n`, {
    headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": 'attachment; filename="evaluations.csv"' },
  });
}
