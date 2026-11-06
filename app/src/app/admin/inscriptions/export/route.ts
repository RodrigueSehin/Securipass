import { NextResponse } from "next/server";
import { loadEnrollments } from "@/lib/admin/enrollments-queries";
import { parseEnrollmentFilters, PAYMENT_STATUS_UI, RAW_STATUS_LABEL, type EnrollmentRow } from "@/lib/admin/enrollments";
import { formatDateTime } from "@/lib/format";
import { csvLine } from "@/lib/sessions/dashboard";

const MAX_ROWS = 5000;

/** Export CSV : les lignes cochées si présentes, sinon le résultat du filtre courant (5 000 inscriptions au plus). */
export async function GET(request: Request) {
  const p = new URL(request.url).searchParams;
  const filters = parseEnrollmentFilters({
    q: p.get("q") ?? "", formation: p.get("formation") ?? "", session: p.get("session") ?? "", statut: p.get("statut") ?? "",
    du: p.get("du") ?? "", au: p.get("au") ?? "", tri: p.get("tri") ?? "",
  });
  const ids = new Set(p.getAll("id"));

  const rows: EnrollmentRow[] = [];
  for (let offset = 0; offset < MAX_ROWS; offset += 100) {
    const page = await loadEnrollments(filters, 100, offset);
    if (page.failed) return new NextResponse("Export indisponible", { status: 503 });
    rows.push(...page.rows);
    if (offset + 100 >= page.total) break;
  }
  const out = ids.size > 0 ? rows.filter((r) => ids.has(r.id)) : rows;
  const lines = [
    csvLine(["Référence", "Apprenant", "E-mail", "Téléphone", "Formation", "Session", "Date d'inscription", "Statut", "Paiement"]),
    ...out.map((e) => csvLine([
      e.reference, e.learner_name, e.learner_email, e.learner_phone ?? "", e.course_title, e.session_title ?? "",
      formatDateTime(e.enrolled_at, e.session_timezone ?? undefined), RAW_STATUS_LABEL[e.status] ?? e.status, e.payment_status ? PAYMENT_STATUS_UI[e.payment_status].label : "",
    ])),
  ];
  return new NextResponse(`﻿${lines.join("\r\n")}\r\n`, {
    headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": 'attachment; filename="inscriptions.csv"' },
  });
}
