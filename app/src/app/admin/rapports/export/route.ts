import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { buildReportFile } from "@/lib/admin/report-files";
import { parseReportParams, tableOf, type ReportParams } from "@/lib/admin/report-generation";
import { isReportType, overviewRows, parseMonth, reportFile } from "@/lib/admin/reports";
import { loadReportRows, loadReportsOverview, loadRunParams, logReport } from "@/lib/admin/reports-queries";
import { csvLine } from "@/lib/sessions/dashboard";

const NO_STORE = { "Cache-Control": "no-store" };
const fail = (msg: string, status: number) => new NextResponse(msg, { status, headers: NO_STORE });

/**
 * Télécharge un rapport.
 *  - `run=<id>` : régénère à l'identique un rapport de l'historique (jamais journalisé à nouveau) ;
 *  - `type=synthese` : indicateurs du mois en CSV (bouton « Exporter » de la page des rapports) ;
 *  - sinon : paramètres du générateur (type, mois, formation, session, formateur, statut, ind, format, nom, description) ;
 *    le rapport est inscrit dans « Rapports récents » seulement avec `journal=1`.
 * Un lien ancien `type=…&mois=…` sans format donne le CSV du type.
 */
export async function GET(request: Request) {
  const p = new URL(request.url).searchParams;

  // Accès réservé aux administrateurs : sans session ou sans rôle, la base refuse (forbidden) et aucun fichier n'est produit.
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return fail("Connexion requise", 401);
  const { data: isAdmin } = await supabase.rpc("has_role", { _role: "admin" });
  if (!isAdmin) return fail("Accès refusé", 403);

  if (p.get("type") === "synthese") {
    const month = parseMonth(p.get("mois"));
    const overview = await loadReportsOverview(month);
    if (!overview) return fail("Export indisponible", 503);
    const lines = [csvLine(["Indicateur", "Valeur"]), ...overviewRows(overview).map(([k, v]) => csvLine([k, v]))];
    return new NextResponse(`﻿${lines.join("\r\n")}\r\n`, {
      headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="synthese-${month}.csv"`, ...NO_STORE },
    });
  }

  const runId = p.get("run");
  let params: ReportParams | null;
  if (runId) {
    params = await loadRunParams(runId);
    if (!params) return fail("Rapport introuvable", 404);
  } else {
    if (!isReportType(p.get("type"))) return fail("Type de rapport inconnu", 400);
    const legacy = !p.has("format");
    params = parseReportParams(p);
    if (legacy) params = { ...params, format: "csv", name: params.name };
  }

  const [overview, rows] = await Promise.all([loadReportsOverview(params.month, params.filters), loadReportRows(params.type, params.month, params.filters)]);
  if (!overview || !rows) return fail("Export indisponible", 503);

  const file = await buildReportFile({
    params, overview, table: tableOf(params.type, rows), generatedAt: new Date(),
    generatedBy: (await supabase.from("profiles").select("full_name, email").eq("id", user.id).maybeSingle<{ full_name: string | null; email: string }>()).data?.full_name?.trim() || "Administration",
  });
  if (!runId && p.get("journal") === "1") await logReport(params, rows.length);

  // Nom du fichier : issu du nom du rapport (ASCII) ; les anciens liens gardent le nom historique.
  const filename = !runId && !p.has("format") ? reportFile(params.type, params.month, "csv") : file.filename;
  return new NextResponse(Buffer.from(file.bytes), {
    headers: { "Content-Type": file.mime, "Content-Disposition": `attachment; filename="${filename}"`, ...NO_STORE },
  });
}
