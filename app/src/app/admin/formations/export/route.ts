import { NextResponse } from "next/server";
import { COURSE_EXPORT_HEADERS, courseExportCells, parseCourseFilters, type CourseExportRow } from "@/lib/admin/courses";
import { loadCourses } from "@/lib/admin/courses-queries";
import { formatDateTime } from "@/lib/format";
import { csvLine } from "@/lib/sessions/dashboard";

const MAX_ROWS = 5000;

/** Export CSV : les lignes cochées si présentes, sinon le résultat du filtre courant (5 000 formations au plus). */
export async function GET(request: Request) {
  const p = new URL(request.url).searchParams;
  const filters = parseCourseFilters({
    q: p.get("q") ?? "", statut: p.get("statut") ?? "", categorie: p.get("categorie") ?? "", mode: p.get("mode") ?? "", tri: p.get("tri") ?? "",
  });
  const ids = new Set(p.getAll("id"));

  const rows: CourseExportRow[] = [];
  for (let offset = 0; offset < MAX_ROWS; offset += 100) {
    const page = await loadCourses(filters, 100, offset);
    if (page.failed) return new NextResponse("Export indisponible", { status: 503 });
    for (const r of page.rows) {
      rows.push({
        id: r.id, course_code: r.course_code, title: r.title, category: r.category?.name ?? null, instructor: r.instructor?.full_name ?? null,
        delivery_mode: r.delivery_mode, duration_minutes: r.duration_minutes, price_amount: r.price_amount, status: r.status, created_at: r.created_at,
      });
    }
    if (offset + 100 >= page.total) break;
  }
  const out = ids.size > 0 ? rows.filter((r) => ids.has(r.id)) : rows;
  const lines = [csvLine(COURSE_EXPORT_HEADERS), ...out.map((c) => csvLine(courseExportCells(c, formatDateTime)))];
  return new NextResponse(`﻿${lines.join("\r\n")}\r\n`, {
    headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": 'attachment; filename="formations.csv"' },
  });
}
