import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import QRCode from "qrcode";
import type { Layout } from "./template";

/** Données figées à l'émission (colonne `certificates.content`). */
export type CertificateContent = {
  holder_name: string;
  course_title: string;
  session_title: string;
  session_start: string | null;
  layout: Layout;
  title: string;
  body: string;
  signatory_name: string;
  signatory_role: string;
  issuer: string;
  issued_on: string;
  validity: string;
  /** Éléments à imprimer (réglage de la formation à l'émission). Absent sur les anciens certificats : tout est imprimé. */
  display?: string[];
};

/** Un élément est imprimé quand il figure dans les réglages du certificat (ou quand les réglages sont absents). */
const shows = (content: CertificateContent, key: string) => !content.display || content.display.includes(key);

export type CertificateRenderOptions = { number: string; verifyUrl: string };

const A4_LANDSCAPE: [number, number] = [842, 595];
const GOLD = rgb(0.84, 0.64, 0.23);
const NAVY = rgb(0.035, 0.165, 0.4);
const BLUE = rgb(0.02, 0.22, 0.85);
const INK = rgb(0.07, 0.1, 0.18);
const MUTED = rgb(0.4, 0.45, 0.52);

/**
 * La police standard (WinAnsi) ne sait pas dessiner tous les caractères : ceux qu'elle ignore deviennent « ? »
 * plutôt que de faire échouer la génération.
 */
export function pdfSafe(text: string): string {
  return text.replace(/[^\x20-\x7E -ÿ‘’“”«»–—…€Œœ]/g, "?");
}

/** Découpe un texte en lignes de largeur maximale. */
export function wrapText(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const lines: string[] = [];
  for (const paragraph of text.split(/\n+/)) {
    let line = "";
    for (const word of paragraph.split(/\s+/).filter(Boolean)) {
      const candidate = line ? `${line} ${word}` : word;
      if (font.widthOfTextAtSize(candidate, size) <= maxWidth) line = candidate;
      else {
        if (line) lines.push(line);
        line = word;
      }
    }
    if (line) lines.push(line);
  }
  return lines;
}

function centered(page: PDFPage, text: string, font: PDFFont, size: number, y: number, color = INK) {
  const width = font.widthOfTextAtSize(text, size);
  page.drawText(text, { x: (A4_LANDSCAPE[0] - width) / 2, y, size, font, color });
}

function drawBody(page: PDFPage, content: CertificateContent, font: PDFFont, bold: PDFFont, top: number, color = INK) {
  const maxWidth = 620;
  centered(page, pdfSafe(content.title), bold, 26, top, color);
  if (shows(content, "holder_name")) centered(page, pdfSafe(content.holder_name), bold, 30, top - 60, color);
  const lines = wrapText(pdfSafe(content.body), font, 14, maxWidth);
  lines.slice(0, 6).forEach((line, i) => centered(page, line, font, 14, top - 100 - i * 20));
  if (shows(content, "course_title")) centered(page, pdfSafe(`Formation : ${content.course_title}`), font, 12, top - 100 - Math.min(lines.length, 6) * 20 - 14, MUTED);
}

function drawSignatures(page: PDFPage, content: CertificateContent, font: PDFFont, bold: PDFFont, y: number) {
  const name = pdfSafe(content.signatory_name);
  const role = pdfSafe(content.signatory_role);
  if (shows(content, "issuer_signature")) {
    const issuer = pdfSafe(content.issuer);
    page.drawText(issuer, { x: 240 - bold.widthOfTextAtSize(issuer, 12) / 2, y, size: 12, font: bold, color: INK });
    const label = "L'organisme de formation";
    page.drawText(label, { x: 240 - font.widthOfTextAtSize(label, 10) / 2, y: y - 16, size: 10, font, color: MUTED });
  }
  if (name && shows(content, "trainer_signature")) {
    const w = font.widthOfTextAtSize(name, 12);
    page.drawText(name, { x: 600 - w / 2, y, size: 12, font: bold, color: INK });
    const rw = font.widthOfTextAtSize(role, 10);
    page.drawText(role, { x: 600 - rw / 2, y: y - 16, size: 10, font, color: MUTED });
  }
}

function drawQr(page: PDFPage, png: Awaited<ReturnType<PDFDocument["embedPng"]>>, x: number, y: number, size: number) {
  page.drawImage(png, { x, y, width: size, height: size });
}

/** Génère le PDF d'un certificat (A4 paysage) selon son modèle. */
export async function renderCertificatePdf(content: CertificateContent, opts: CertificateRenderOptions): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.setTitle(`Certificat ${opts.number}`);
  doc.setAuthor("SECURIPASS");
  doc.setSubject(pdfSafe(content.course_title));
  const page = doc.addPage(A4_LANDSCAPE);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const serif = await doc.embedFont(StandardFonts.TimesRoman);
  const serifBold = await doc.embedFont(StandardFonts.TimesRomanBold);

  const qrPng = await doc.embedPng(await QRCode.toBuffer(opts.verifyUrl, { type: "png", margin: 1, width: 220 }));
  const footer = pdfSafe([
    shows(content, "number") ? `N° ${opts.number}` : null,
    content.validity,
    shows(content, "issue_date") ? `émis le ${content.issued_on}` : null,
    `Vérification : ${opts.verifyUrl}`,
  ].filter(Boolean).join(" · "));

  switch (content.layout) {
    case "classic": {
      page.drawRectangle({ x: 24, y: 24, width: 794, height: 547, borderColor: GOLD, borderWidth: 3 });
      page.drawRectangle({ x: 34, y: 34, width: 774, height: 527, borderColor: GOLD, borderWidth: 0.8 });
      centered(page, "SECURIPASS", serifBold, 16, 500, NAVY);
      drawBody(page, content, serif, serifBold, 420, NAVY);
      drawSignatures(page, content, serif, serifBold, 110);
      if (shows(content, "qr")) drawQr(page, qrPng, 60, 60, 90);
      break;
    }
    case "modern": {
      page.drawRectangle({ x: 0, y: 470, width: 842, height: 125, color: NAVY });
      page.drawText("SECURIPASS", { x: 48, y: 530, size: 26, font: bold, color: rgb(1, 1, 1) });
      page.drawText("Former · Certifier · Sécuriser", { x: 48, y: 506, size: 11, font, color: rgb(0.85, 0.9, 1) });
      drawBody(page, content, font, bold, 380, INK);
      drawSignatures(page, content, font, bold, 110);
      if (shows(content, "qr")) drawQr(page, qrPng, 690, 70, 100);
      break;
    }
    case "minimal": {
      page.drawRectangle({ x: 40, y: 40, width: 762, height: 515, borderColor: rgb(0.8, 0.82, 0.86), borderWidth: 0.6 });
      drawBody(page, content, font, font, 380, INK);
      drawSignatures(page, content, font, font, 110);
      if (shows(content, "qr")) drawQr(page, qrPng, 720, 58, 80);
      break;
    }
    case "professional": {
      page.drawRectangle({ x: 0, y: 0, width: 842, height: 70, color: BLUE });
      page.drawText("SECURIPASS · Certificat de formation professionnelle", { x: 40, y: 28, size: 12, font: bold, color: rgb(1, 1, 1) });
      drawBody(page, content, bold, bold, 400, NAVY);
      drawSignatures(page, content, font, bold, 120);
      if (shows(content, "qr")) drawQr(page, qrPng, 40, 92, 84);
      break;
    }
  }
  page.drawText(footer, { x: 40, y: 12, size: 7, font, color: MUTED });
  return doc.save();
}
