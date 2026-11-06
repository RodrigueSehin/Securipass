import { describe, expect, it } from "vitest";
import { pdfSafe, renderCertificatePdf, wrapText, type CertificateContent } from "./pdf";
import { PDFDocument, StandardFonts } from "pdf-lib";

const base: CertificateContent = {
  holder_name: "Awa Koné", course_title: "Gestes de premiers secours", session_title: "Session mars",
  session_start: null, layout: "classic", title: "Certificat de fin de formation",
  body: "Le présent certificat atteste que Awa Koné a suivi avec succès la formation « Gestes de premiers secours ».",
  signatory_name: "Dr Traoré", signatory_role: "Responsable pédagogique", issuer: "SECURIPASS",
  issued_on: "21/10/2026", validity: "valable jusqu’au 21/10/2028",
};
const opts = { number: "SP-2026-000001", verifyUrl: "https://example.test/verifier?code=abc" };

describe("génération PDF", () => {
  for (const layout of ["classic", "modern", "minimal", "professional"] as const) {
    it(`produit un PDF valide : modèle ${layout}`, async () => {
      const bytes = await renderCertificatePdf({ ...base, layout }, opts);
      expect(Buffer.from(bytes.slice(0, 5)).toString()).toBe("%PDF-");
      const doc = await PDFDocument.load(bytes);
      expect(doc.getPageCount()).toBe(1);
      expect(doc.getTitle()).toBe("Certificat SP-2026-000001");
    });
  }

  it("accepte un nom avec des caractères hors WinAnsi sans échouer", async () => {
    const bytes = await renderCertificatePdf({ ...base, holder_name: "Mariam 日本 Ouédraogo" }, opts);
    expect(bytes.length).toBeGreaterThan(1000);
  });
});

describe("éléments imprimés", () => {
  it("produit un PDF valide sans aucun élément facultatif", async () => {
    const bytes = await renderCertificatePdf({ ...base, display: [] }, opts);
    expect(Buffer.from(bytes.slice(0, 5)).toString()).toBe("%PDF-");
    expect((await PDFDocument.load(bytes)).getPageCount()).toBe(1);
  });

  it("un PDF sans QR code, sans signatures et sans nom est plus léger que le PDF complet", async () => {
    const full = await renderCertificatePdf({ ...base, display: undefined }, opts);
    const minimal = await renderCertificatePdf({ ...base, display: ["course_title"] }, opts);
    expect(minimal.length).toBeLessThan(full.length);
  });

  it("l'absence de réglage (anciens certificats) imprime tout", async () => {
    const legacy = await renderCertificatePdf({ ...base }, opts);
    const all = await renderCertificatePdf({ ...base, display: ["holder_name", "course_title", "issue_date", "qr", "trainer_signature", "issuer_signature", "number"] }, opts);
    expect(Math.abs(legacy.length - all.length)).toBeLessThan(200);
  });
});

describe("texte", () => {
  it("remplace les caractères non représentables", () => {
    expect(pdfSafe("Awa 日本")).toBe("Awa ??");
    expect(pdfSafe("« Sécurité » – l’essentiel")).toBe("« Sécurité » – l’essentiel");
  });
  it("découpe les longs textes", async () => {
    const doc = await PDFDocument.create();
    const font = await doc.embedFont(StandardFonts.Helvetica);
    const lines = wrapText("mot ".repeat(80), font, 14, 300);
    expect(lines.length).toBeGreaterThan(3);
    for (const l of lines) expect(font.widthOfTextAtSize(l, 14)).toBeLessThanOrEqual(300);
  });
});
