import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import { monthShort } from "./commissions";
import { breakdownTotals, hasCourseBreakdown, indicatorTiles, periodLabel, type ReportDocument } from "./report-generation";
import { REPORT_TYPES, courseShares, DONUT_COLORS } from "./reports";

/** Rapport PDF (A4 portrait) : bandeau, synthèse, graphiques facultatifs, détail par formation et table de données. */

const W = 595.28, H = 841.89, M = 36, FOOT = 34;
const BRAND = rgb(0.145, 0.388, 0.922), INK = rgb(0.043, 0.122, 0.267), MUTED = rgb(0.36, 0.42, 0.53), LINE = rgb(0.89, 0.914, 0.953), SOFT = rgb(0.953, 0.969, 1), OK = rgb(0.063, 0.659, 0.459);
export const PDF_MAX_ROWS = 300;

/** Réduit le texte aux caractères que la police standard sait écrire (WinAnsi) : le reste devient « ? ». */
export function pdfText(s: string): string {
  return s.replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/[–—]/g, "-").replace(/…/g, "...")
    .replace(/[  ]/g, " ").replace(/↑/g, "+").replace(/↓/g, "-")
    .replace(/[\u0000-\u001F]/g, " ").replace(/[^ -~ -ÿ]/g, "?");
}

export async function buildPdf(doc: ReportDocument): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  pdf.setTitle(pdfText(doc.params.name));
  pdf.setProducer("SECURIPASS");
  pdf.setCreationDate(doc.generatedAt);
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);

  let page: PDFPage = pdf.addPage([W, H]);
  let y = H - M;
  const newPage = () => { page = pdf.addPage([W, H]); y = H - M; };
  const ensure = (h: number) => { if (y - h < M + FOOT) newPage(); };
  const fit = (text: string, f: PDFFont, size: number, max: number) => {
    let t = pdfText(text);
    if (f.widthOfTextAtSize(t, size) <= max) return t;
    while (t.length > 1 && f.widthOfTextAtSize(`${t}...`, size) > max) t = t.slice(0, -1);
    return `${t}...`;
  };
  const text = (t: string, x: number, yy: number, size: number, f = font, color = INK) => page.drawText(pdfText(t), { x, y: yy, size, font: f, color });
  const textRight = (t: string, xr: number, yy: number, size: number, f = font, color = INK) => { const s = pdfText(t); page.drawText(s, { x: xr - f.widthOfTextAtSize(s, size), y: yy, size, font: f, color }); };
  const heading = (t: string) => { ensure(30); y -= 8; text(t, M, y - 10, 12, bold, BRAND); y -= 22; };
  const contentW = W - 2 * M;
  const { params, overview: o, table } = doc;

  // Bandeau
  page.drawRectangle({ x: 0, y: H - 78, width: W, height: 78, color: BRAND });
  text("SECURIPASS", M, H - 40, 22, bold, rgb(1, 1, 1));
  text("Former · Certifier · Sécuriser", M, H - 56, 8, font, rgb(0.85, 0.9, 1));
  textRight(params.name, W - M, H - 36, 13, bold, rgb(1, 1, 1));
  textRight(`Période : ${periodLabel(params.month)}`, W - M, H - 54, 9.5, font, rgb(1, 1, 1));
  y = H - 78 - 18;
  if (params.description) {
    const words = pdfText(params.description).split(" ");
    let line = "";
    for (const w of words) {
      if (font.widthOfTextAtSize(`${line} ${w}`.trim(), 9) > contentW) { text(line, M, y, 9, font, MUTED); y -= 12; line = w; } else line = `${line} ${w}`.trim();
    }
    if (line) { text(line, M, y, 9, font, MUTED); y -= 12; }
    y -= 4;
  }

  // Synthèse
  const tiles = indicatorTiles(o, params.indicators);
  if (tiles.length > 0) {
    heading("Synthèse générale");
    const perRow = 4, gap = 10, tw = (contentW - gap * (perRow - 1)) / perRow, th = 52;
    tiles.forEach((t, i) => {
      if (i % perRow === 0) { ensure(th + 10); if (i > 0) y -= th + gap; }
      const x = M + (i % perRow) * (tw + gap);
      page.drawRectangle({ x, y: y - th, width: tw, height: th, color: SOFT, borderColor: LINE, borderWidth: 1 });
      text(fit(t.label, font, 8, tw - 12), x + 8, y - 14, 8, font, MUTED);
      text(fit(t.value, bold, 13, tw - 12), x + 8, y - 32, 13, bold, INK);
      if (t.trend) text(t.trend, x + 8, y - 45, 8, bold, OK);
    });
    y -= th + 12;
  }

  // Graphiques
  if (params.indicators.includes("analyse")) {
    heading("Analyse");
    const ch = 130, half = (contentW - 16) / 2;
    ensure(ch + 24);
    const top = y;
    text("Évolution des inscriptions", M, top - 8, 9.5, bold);
    const max = Math.max(1, ...o.months.map((m) => m.count));
    const base = top - ch + 14, plotH = ch - 44, bw = Math.min(26, (half - 10) / Math.max(1, o.months.length) - 8);
    page.drawLine({ start: { x: M, y: base }, end: { x: M + half, y: base }, thickness: 0.8, color: LINE });
    o.months.forEach((m, i) => {
      const x = M + 6 + i * ((half - 12) / o.months.length) + 4;
      const h = (m.count / max) * plotH;
      page.drawRectangle({ x, y: base, width: bw, height: Math.max(h, 0.5), color: BRAND });
      textRight(String(m.count), x + bw + 2, base + h + 3, 7, bold, INK);
      text(monthShort(m.month), x, base - 11, 7, font, MUTED);
    });
    const x2 = M + half + 16;
    text("Répartition par formation", x2, top - 8, 9.5, bold);
    const shares = courseShares(o.by_course.length ? o.by_course : o.courses.map((c) => ({ ...c })), o.enrollments.value);
    shares.forEach((s, i) => {
      const yy = top - 28 - i * 19;
      page.drawRectangle({ x: x2, y: yy - 3, width: 8, height: 8, color: rgb(...hexToRgb(DONUT_COLORS[i % DONUT_COLORS.length])) });
      text(fit(s.label, font, 8, half - 70), x2 + 14, yy - 1, 8);
      textRight(`${s.percent} %`, x2 + half, yy - 1, 8, bold);
      page.drawRectangle({ x: x2 + 14, y: yy - 8, width: Math.max(2, (s.percent / 100) * (half - 14)), height: 2.5, color: rgb(...hexToRgb(DONUT_COLORS[i % DONUT_COLORS.length])) });
    });
    if (shares.length === 0) text("Aucune inscription sur la période.", x2, top - 30, 8.5, font, MUTED);
    y = top - ch - 6;
  }

  // Par formation
  if (hasCourseBreakdown(params.type) && o.by_course.length > 0) {
    heading(params.type === "formations" ? "Formations" : "Inscriptions par formation");
    const cols = [{ h: "#", w: 22, a: "l" }, { h: "Formation", w: contentW - 22 - 4 * 70, a: "l" }, { h: "Sessions", w: 70, a: "r" }, { h: "Inscriptions", w: 70, a: "r" }, { h: "Complétion", w: 70, a: "r" }, { h: "Réussite", w: 70, a: "r" }] as const;
    const t = breakdownTotals(o.by_course);
    const pc = (v: number | null) => (v === null ? "-" : `${v} %`);
    const rows: string[][] = [...o.by_course.map((c, i) => [String(i + 1), c.title, String(c.sessions), String(c.count), pc(c.completion), pc(c.success)]), ["", "Total", String(t.sessions), String(t.count), pc(t.completion), pc(t.success)]];
    drawTable(cols.map((c) => c.h), rows, cols.map((c) => c.w), cols.map((c) => c.a === "r"), true);
  }

  // Détail
  const shown = table.rows.slice(0, PDF_MAX_ROWS);
  heading(`Détail des données : ${REPORT_TYPES[params.type].label} (${table.rows.length} ligne${table.rows.length > 1 ? "s" : ""})`);
  if (table.rows.length === 0) {
    text("Aucune donnée pour ces paramètres.", M, y - 4, 9, font, MUTED);
    y -= 16;
  }
  else {
    const n = table.headers.length, w = contentW / n;
    drawTable(table.headers, shown.map((r) => r.map((c) => String(c ?? ""))), table.headers.map(() => w), table.headers.map(() => false), false);
    if (table.rows.length > shown.length) { ensure(16); text(`Extrait des ${PDF_MAX_ROWS} premières lignes : téléchargez le rapport en Excel ou CSV pour la totalité.`, M, y - 4, 8, font, MUTED); y -= 14; }
  }

  // Pieds de page
  const pages = pdf.getPages();
  const stamp = `Généré le ${new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium", timeStyle: "short", timeZone: "Africa/Abidjan" }).format(doc.generatedAt)} par ${doc.generatedBy}`;
  pages.forEach((p, i) => {
    p.drawLine({ start: { x: M, y: M + 14 }, end: { x: W - M, y: M + 14 }, thickness: 0.6, color: LINE });
    p.drawText(pdfText(stamp), { x: M, y: M, size: 7.5, font, color: MUTED });
    const label = `Page ${i + 1} / ${pages.length}`;
    p.drawText(label, { x: W - M - font.widthOfTextAtSize(label, 7.5), y: M, size: 7.5, font, color: MUTED });
  });
  return pdf.save();

  function drawTable(headers: readonly string[], rows: string[][], widths: number[], right: boolean[], totalRow: boolean) {
    const size = 7.5, rh = 15;
    const head = () => {
      ensure(rh * 2);
      page.drawRectangle({ x: M, y: y - rh, width: contentW, height: rh, color: SOFT });
      let x = M;
      headers.forEach((h, i) => { const s = fit(h, bold, size, widths[i] - 8); if (right[i]) textRight(s, x + widths[i] - 4, y - 10.5, size, bold); else text(s, x + 4, y - 10.5, size, bold); x += widths[i]; });
      y -= rh;
    };
    head();
    rows.forEach((r, ri) => {
      if (y - rh < M + FOOT) { newPage(); head(); }
      const isTotal = totalRow && ri === rows.length - 1;
      if (isTotal) page.drawRectangle({ x: M, y: y - rh, width: contentW, height: rh, color: SOFT });
      else if (ri % 2 === 1) page.drawRectangle({ x: M, y: y - rh, width: contentW, height: rh, color: rgb(0.985, 0.989, 0.997) });
      let x = M;
      r.forEach((c, i) => { const f = isTotal ? bold : font; const s = fit(c, f, size, widths[i] - 8); if (right[i]) textRight(s, x + widths[i] - 4, y - 10.5, size, f); else text(s, x + 4, y - 10.5, size, f); x += widths[i]; });
      y -= rh;
    });
    page.drawLine({ start: { x: M, y }, end: { x: M + contentW, y }, thickness: 0.6, color: LINE });
    y -= 8;
  }
}

function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}
