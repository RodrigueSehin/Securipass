import { NextResponse } from "next/server";
import { loadUsers } from "@/lib/admin/users-queries";
import { parseUserFilters, ROLE_LABEL, USER_STATUS, type UserRow } from "@/lib/admin/users";
import { formatDateTime } from "@/lib/format";
import { csvLine } from "@/lib/sessions/dashboard";

const MAX_ROWS = 5000;

/** Export CSV : les lignes cochées si présentes, sinon le résultat du filtre courant (5 000 comptes au plus). */
export async function GET(request: Request) {
  const p = new URL(request.url).searchParams;
  const filters = parseUserFilters({ q: p.get("q") ?? "", role: p.get("role") ?? "", statut: p.get("statut") ?? "", periode: p.get("periode") ?? "", tri: p.get("tri") ?? "" });
  const ids = new Set(p.getAll("id"));

  const rows: UserRow[] = [];
  for (let offset = 0; offset < MAX_ROWS; offset += 100) {
    const page = await loadUsers(filters, 100, offset);
    if (page.failed) return new NextResponse("Export indisponible", { status: 503 });
    rows.push(...page.rows);
    if (offset + 100 >= page.total) break;
  }
  const out = ids.size > 0 ? rows.filter((r) => ids.has(r.id)) : rows;
  const lines = [
    csvLine(["Nom", "E-mail", "Téléphone", "Rôles", "Organisation", "Inscription", "Dernière connexion", "Statut"]),
    ...out.map((u) => csvLine([
      u.full_name, u.email, u.phone ?? "", u.roles.map((r) => ROLE_LABEL[r] ?? r).join(", "), u.organization ?? "",
      formatDateTime(u.created_at), u.last_sign_in_at ? formatDateTime(u.last_sign_in_at) : "", USER_STATUS[u.status]?.label ?? u.status,
    ])),
  ];
  return new NextResponse(`﻿${lines.join("\r\n")}\r\n`, {
    headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": 'attachment; filename="utilisateurs.csv"' },
  });
}
