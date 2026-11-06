import { NextResponse } from "next/server";
import { listMySessions } from "@/lib/courses/instructor-queries";
import { MODES } from "@/lib/courses/labels";
import { formatDateTime } from "@/lib/format";
import { DISPLAY_STATUS, csvLine, displayStatus, filterSessions } from "@/lib/sessions/dashboard";

/** Export CSV des sessions du formateur connecté, avec les filtres de la liste. */
export async function GET(request: Request) {
  const rows = await listMySessions();
  const p = new URL(request.url).searchParams;
  const now = Date.now();
  const filtered = filterSessions(rows, {
    q: p.get("q") ?? "", course: p.get("course") ?? "", status: p.get("status") ?? "", date: p.get("date") ?? "",
  }, now);
  const lines = [
    csvLine(["Référence", "Session", "Formation", "Début", "Fin", "Format", "Lieu", "Participants", "Capacité", "Statut"]),
    ...filtered.map((s) => csvLine([
      s.reference, s.title, s.course?.title ?? "", formatDateTime(s.start_at, s.timezone), formatDateTime(s.end_at, s.timezone),
      MODES[s.delivery_mode], s.location ?? "", s.taken, s.capacity, DISPLAY_STATUS[displayStatus(s, now)].label,
    ])),
  ];
  return new NextResponse(`﻿${lines.join("\r\n")}\r\n`, {
    headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": 'attachment; filename="sessions.csv"' },
  });
}
