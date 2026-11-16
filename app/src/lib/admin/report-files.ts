import { csvLine } from "@/lib/sessions/dashboard";
import { buildPdf } from "./report-pdf";
import { buildXlsx, type Cell } from "./report-xlsx";
import { REPORT_FORMATS, breakdownTotals, fileSlug, hasCourseBreakdown, indicatorTiles, periodLabel, type ReportDocument } from "./report-generation";
import { REPORT_TYPES } from "./reports";

/** Écrit un rapport au format choisi (PDF, Excel ou CSV). */

export type ReportFile = { bytes: Uint8Array; mime: string; filename: string };

const pc = (v: number | null) => (v === null ? "" : `${v} %`);

/** Lignes de la synthèse (titre, période, indicateurs et détail par formation), communes au CSV et à Excel. */
export function summaryRows(doc: ReportDocument): Cell[][] {
  const { params, overview: o } = doc;
  const rows: Cell[][] = [
    ["Rapport", params.name], ["Type", REPORT_TYPES[params.type].label], ["Période", periodLabel(params.month)],
    ...(params.description ? [["Description", params.description] as Cell[]] : []),
    [],
  ];
  const tiles = indicatorTiles(o, params.indicators);
  if (tiles.length) rows.push(["Indicateur", "Valeur", "Évolution"], ...tiles.map((t): Cell[] => [t.label, t.value, t.trend ?? ""]), []);
  if (hasCourseBreakdown(params.type) && o.by_course.length) {
    const t = breakdownTotals(o.by_course);
    rows.push(["Formation", "Sessions", "Inscriptions", "Taux de complétion", "Taux de réussite"],
      ...o.by_course.map((c): Cell[] => [c.title, c.sessions, c.count, pc(c.completion), pc(c.success)]),
      ["Total", t.sessions, t.count, pc(t.completion), pc(t.success)], []);
  }
  return rows;
}

export function buildCsv(doc: ReportDocument): string {
  const lines = [
    ...summaryRows(doc).map((r) => csvLine(r.map((c) => c ?? ""))),
    csvLine(doc.table.headers),
    ...doc.table.rows.map((r) => csvLine(r)),
  ];
  return `﻿${lines.join("\r\n")}\r\n`;
}

export function buildWorkbook(doc: ReportDocument): Buffer {
  const summary = summaryRows(doc);
  const headerRows = summary.flatMap((r, i) => (r[0] === "Indicateur" || r[0] === "Formation" || r[0] === "Total" || r[0] === "Rapport" ? [i] : []));
  return buildXlsx([
    { name: "Synthèse", rows: summary, bold: headerRows, widths: [38, 40, 16, 20, 18] },
    { name: "Détail", rows: [doc.table.headers, ...doc.table.rows], bold: [0], widths: doc.table.headers.map((h) => Math.max(14, Math.min(40, h.length + 6))) },
  ]);
}

export async function buildReportFile(doc: ReportDocument): Promise<ReportFile> {
  const f = REPORT_FORMATS[doc.params.format];
  const filename = `${fileSlug(doc.params.name, `rapport-${doc.params.type}`)}.${f.ext}`;
  if (doc.params.format === "pdf") return { bytes: await buildPdf(doc), mime: f.mime, filename };
  if (doc.params.format === "xlsx") return { bytes: buildWorkbook(doc), mime: f.mime, filename };
  return { bytes: new TextEncoder().encode(buildCsv(doc)), mime: f.mime, filename };
}
