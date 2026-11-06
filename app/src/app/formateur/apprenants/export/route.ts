import { NextResponse } from "next/server";
import { formatDateTime } from "@/lib/format";
import { filterLearners, LEARNER_STATUS } from "@/lib/learners/overview";
import { loadLearnerOverview } from "@/lib/learners/queries";
import { csvLine } from "@/lib/sessions/dashboard";

/** Export CSV : les lignes cochées si présentes, sinon le résultat du filtre courant. */
export async function GET(request: Request) {
  const p = new URL(request.url).searchParams;
  const data = await loadLearnerOverview(Date.now());
  const ids = new Set(p.getAll("id"));
  const rows = ids.size > 0
    ? data.rows.filter((r) => ids.has(r.id))
    : filterLearners(data.rows, { q: p.get("q") ?? "", session: p.get("session") ?? "", status: p.get("status") ?? "", course: p.get("course") ?? "" });
  const lines = [
    csvLine(["Apprenant", "E-mail", "Formation", "Session", "Progression (%)", "Statut", "Dernière activité"]),
    ...rows.map((r) => csvLine([
      r.name, r.email, r.course, r.sessionTitle ?? "", r.percent, LEARNER_STATUS[r.status].label, r.lastActivity ? formatDateTime(r.lastActivity) : "",
    ])),
  ];
  return new NextResponse(`﻿${lines.join("\r\n")}\r\n`, {
    headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": 'attachment; filename="apprenants.csv"' },
  });
}
