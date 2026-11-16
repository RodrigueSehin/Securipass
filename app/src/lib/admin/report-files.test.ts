import { crc32 } from "node:zlib";
import { PDFDocument } from "pdf-lib";
import { describe, expect, it } from "vitest";
import { buildCsv, buildReportFile } from "./report-files";
import { PDF_MAX_ROWS, buildPdf, pdfText } from "./report-pdf";
import { columnName, escapeXml, sheetName, zipStore } from "./report-xlsx";
import { DEFAULT_INDICATORS, tableOf, type ReportDocument, type ReportParams } from "./report-generation";
import type { ReportsOverview } from "./reports";

const overview: ReportsOverview = {
  month: "2026-10", enrollments: { value: 5, prev: 4 }, active_learners: { value: 3, prev: 2 }, sessions: { value: 1, prev: 0 }, certifications: { value: 1, prev: 0 },
  commissions: { value: 15000, prev: 0, rate: 15 }, revenue: 100000, evaluations: { results: 4, passed: 3 }, completion_rate: 25, evaluation_success_rate: 75, attendance_rate: 50,
  months: [{ month: "2026-05", count: 1 }, { month: "2026-06", count: 2 }, { month: "2026-07", count: 0 }, { month: "2026-08", count: 3 }, { month: "2026-09", count: 4 }, { month: "2026-10", count: 5 }],
  courses: [{ id: "a", title: "SST – Secourisme au travail", count: 3 }],
  by_course: [{ id: "a", title: "SST – Secourisme au travail", count: 3, sessions: 2, completion: 90, success: 80 }, { id: "b", title: "Incendie", count: 2, sessions: 1, completion: null, success: null }],
};
const params = (over: Partial<ReportParams> = {}): ReportParams => ({
  type: "inscriptions", month: "2026-10", filters: { course: "", session: "", instructor: "", status: "" }, indicators: [...DEFAULT_INDICATORS, "analyse"],
  format: "csv", name: "Rapport des inscriptions – Oct. 2026", description: "Synthèse du mois", ...over,
});
const rows = Array.from({ length: 3 }, (_, i) => [`INS-2026-0000${i}`, `Apprenant ${i} ’é`, "a@x.ci", "SST", "", "Confirmée", "12/10/2026"]);
const doc = (p: ReportParams = params(), r: (string | number)[][] = rows): ReportDocument => ({ params: p, overview, table: tableOf(p.type, r), generatedAt: new Date("2026-10-22T14:35:00Z"), generatedBy: "Claire Yao" });

/** Relit une archive ZIP « stockée » : noms, contenu et contrôle de la somme CRC. */
function unzip(buf: Buffer): Record<string, string> {
  const end = buf.length - 22;
  expect(buf.readUInt32LE(end)).toBe(0x06054b50);
  const count = buf.readUInt16LE(end + 10);
  let p = buf.readUInt32LE(end + 16);
  const out: Record<string, string> = {};
  for (let i = 0; i < count; i++) {
    expect(buf.readUInt32LE(p)).toBe(0x02014b50);
    const crc = buf.readUInt32LE(p + 16), size = buf.readUInt32LE(p + 20), nameLen = buf.readUInt16LE(p + 28), local = buf.readUInt32LE(p + 42);
    const name = buf.subarray(p + 46, p + 46 + nameLen).toString("utf8");
    const start = local + 30 + buf.readUInt16LE(local + 26) + buf.readUInt16LE(local + 28);
    const data = buf.subarray(start, start + size);
    expect(crc32(data) >>> 0).toBe(crc);
    out[name] = data.toString("utf8");
    p += 46 + nameLen;
  }
  return out;
}

describe("CSV", () => {
  it("commence par la synthèse puis le détail, avec BOM et en-têtes", () => {
    const csv = buildCsv(doc());
    expect(csv.startsWith("﻿")).toBe(true);
    const lines = csv.slice(1).split("\r\n");
    expect(lines[0]).toContain("Rapport");
    expect(csv).toContain("Nombre d’inscriptions");
    expect(csv).toContain("Total");
    expect(lines).toContain('"Référence";"Apprenant";"E-mail";"Formation";"Session";"Statut";"Date d’inscription"');
    expect(csv).toContain("INS-2026-00001");
  });
  it("neutralise les formules dans les cellules", () => {
    const csv = buildCsv(doc(params(), [["=SOMME(A1)", "+1", "-1", "@x", "", "", ""]]));
    expect(csv).toContain("'=SOMME(A1)");
    expect(csv).not.toMatch(/;=SOMME/);
  });
});

describe("Excel (.xlsx)", () => {
  it("produit une archive valide avec feuilles Synthèse et Détail", async () => {
    const file = await buildReportFile(doc(params({ format: "xlsx" })));
    expect(file.filename).toBe("rapport-des-inscriptions-oct-2026.xlsx");
    expect(file.mime).toContain("spreadsheetml");
    const files = unzip(Buffer.from(file.bytes));
    expect(Object.keys(files).sort()).toEqual(["[Content_Types].xml", "_rels/.rels", "xl/_rels/workbook.xml.rels", "xl/styles.xml", "xl/workbook.xml", "xl/worksheets/sheet1.xml", "xl/worksheets/sheet2.xml"]);
    expect(files["xl/workbook.xml"]).toContain('name="Synthèse"');
    expect(files["xl/workbook.xml"]).toContain('name="Détail"');
    expect(files["xl/worksheets/sheet2.xml"]).toContain("INS-2026-00002");
    expect(files["xl/worksheets/sheet2.xml"]).toContain('<c r="A1" s="1" t="inlineStr">');
    expect(files["xl/worksheets/sheet1.xml"]).toContain("<v>3</v>");
  });
  it("échappe le XML et garde les nombres numériques", async () => {
    const d = doc(params({ format: "xlsx", type: "financier" }), [["PAY-1", "A & <B>", "Objet", 35000, "Espèces", "Confirmé", "01/10/2026"]]);
    const sheet = unzip(Buffer.from((await buildReportFile(d)).bytes))["xl/worksheets/sheet2.xml"];
    expect(sheet).toContain("A &amp; &lt;B&gt;");
    expect(sheet).toContain("<c r=\"D2\"><v>35000</v></c>");
  });
  it("outille correctement colonnes, noms d'onglets et XML", () => {
    expect([0, 25, 26, 27, 701, 702].map(columnName)).toEqual(["A", "Z", "AA", "AB", "ZZ", "AAA"]);
    expect(sheetName("a:b/c?*[d]", "x")).toBe("a b c   d");
    expect(sheetName("x".repeat(40), "y")).toHaveLength(31);
    expect(escapeXml('a\u0001"b"')).toBe("a&quot;b&quot;");
    expect(unzip(zipStore([{ name: "a.txt", data: Buffer.from("é") }]))["a.txt"]).toBe("é");
  });
});

describe("PDF", () => {
  it("produit un PDF lisible avec titre et pied de page", async () => {
    const file = await buildReportFile(doc(params({ format: "pdf" })));
    expect(file.filename).toBe("rapport-des-inscriptions-oct-2026.pdf");
    expect(Buffer.from(file.bytes).subarray(0, 5).toString()).toBe("%PDF-");
    const pdf = await PDFDocument.load(file.bytes);
    expect(pdf.getTitle()).toBe("Rapport des inscriptions - Oct. 2026");
    expect(pdf.getPageCount()).toBe(1);
  });
  it("change de page quand le détail est long et limite l'extrait", async () => {
    const many = Array.from({ length: PDF_MAX_ROWS + 50 }, (_, i) => [`INS-${i}`, `Apprenant ${i}`, "a@x.ci", "SST", "", "Confirmée", "12/10/2026"]);
    const bytes = await buildPdf(doc(params(), many));
    const pdf = await PDFDocument.load(bytes);
    expect(pdf.getPageCount()).toBeGreaterThan(5);
    expect(pdf.getPageCount()).toBeLessThan(20);
  });
  it("accepte un rapport sans indicateur, sans donnée et sans description", async () => {
    const bytes = await buildPdf(doc(params({ indicators: [], description: "", type: "presences" }), []));
    expect((await PDFDocument.load(bytes)).getPageCount()).toBe(1);
  });
  it("réduit le texte aux caractères de la police standard", () => {
    expect(pdfText("SST – Secourisme ’é… ↑ 12 % 中")).toBe("SST - Secourisme 'é... + 12 % ?");
    expect(pdfText("a\u0000b")).toBe("a b");
  });
});
