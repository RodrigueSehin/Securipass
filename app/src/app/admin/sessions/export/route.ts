import { NextResponse } from "next/server";
import { loadSessions } from "@/lib/admin/sessions-queries";
import { parseSessionFilters, SESSION_STATUS_UI, type SessionRow } from "@/lib/admin/sessions";
import { MODES } from "@/lib/courses/labels";
import { formatDateTime } from "@/lib/format";
import { csvLine } from "@/lib/sessions/dashboard";

const MAX_ROWS = 5000;

/** Export CSV : les lignes cochées si présentes, sinon le résultat du filtre courant (5 000 sessions au plus). */
export async function GET(request: Request) {
  const p = new URL(request.url).searchParams;
  const filters = parseSessionFilters({
    q: p.get("q") ?? "", formation: p.get("formation") ?? "", statut: p.get("statut") ?? "", mode: p.get("mode") ?? "",
    du: p.get("du") ?? "", au: p.get("au") ?? "", tri: p.get("tri") ?? "",
  });
  const ids = new Set(p.getAll("id"));

  const rows: SessionRow[] = [];
  for (let offset = 0; offset < MAX_ROWS; offset += 100) {
    const page = await loadSessions(filters, 100, offset);
    if (page.failed) return new NextResponse("Export indisponible", { status: 503 });
    rows.push(...page.rows);
    if (offset + 100 >= page.total) break;
  }
  const out = ids.size > 0 ? rows.filter((r) => ids.has(r.id)) : rows;
  const lines = [
    csvLine(["Référence", "Session", "Formation", "Formateur", "Début", "Fin", "Mode", "Lieu", "Inscrits", "Places", "Statut"]),
    ...out.map((s) => csvLine([
      s.reference, s.title, s.course_title, s.instructor_name, formatDateTime(s.start_at, s.timezone), formatDateTime(s.end_at, s.timezone),
      MODES[s.delivery_mode] ?? s.delivery_mode, s.location ?? "", s.taken, s.capacity, SESSION_STATUS_UI[s.display_status]?.label ?? s.display_status,
    ])),
  ];
  return new NextResponse(`﻿${lines.join("\r\n")}\r\n`, {
    headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": 'attachment; filename="sessions.csv"' },
  });
}
