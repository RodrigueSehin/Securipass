import { NextResponse } from "next/server";
import { ATTENDANCE_CHOICES, attendanceComment } from "@/lib/admin/attendance";
import { loadAttendanceList } from "@/lib/admin/attendance-queries";
import { csvLine } from "@/lib/sessions/dashboard";

/** Export CSV de la liste des présences d'une session (tous les inscrits). */
export async function GET(request: Request) {
  const session = new URL(request.url).searchParams.get("session") ?? "";
  if (!/^[0-9a-f-]{36}$/i.test(session)) return new NextResponse("Session invalide", { status: 400 });
  const list = await loadAttendanceList(session, 200, 0);
  if (list.failed || !list.session) return new NextResponse("Export indisponible", { status: 503 });
  const lines = [
    csvLine(["Apprenant", "Matricule", "Entreprise", "Statut de présence", "Heure d'arrivée", "Heure de départ", "Commentaires"]),
    ...list.rows.map((r) => csvLine([
      r.full_name, r.learner_code ?? "", r.organization ?? "", r.status ? ATTENDANCE_CHOICES[r.status] : "Non saisi", r.check_in ?? "", r.check_out ?? "", attendanceComment(r) ?? "",
    ])),
  ];
  return new NextResponse(`﻿${lines.join("\r\n")}\r\n`, {
    headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": 'attachment; filename="presences.csv"' },
  });
}
