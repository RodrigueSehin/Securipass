import { describe, expect, it } from "vitest";
import { createInvoiceSchema, createRefundSchema, daysBetween, dueDateFor, invoiceTotals, lineAmount, parseBillingFilters, sharePct } from "./billing";

const id = "0b9f5d1e-1c2a-4f3b-8d4e-5a6b7c8d9e0f";

describe("parseBillingFilters", () => {
  it("garde l'onglet, et n'accepte que les statuts de cet onglet", () => {
    expect(parseBillingFilters({ onglet: "remboursements", q: " rmb ", statut: "refunded", formation: id, du: "2026-10-01", au: "2026-10-31" }))
      .toEqual({ tab: "remboursements", q: "rmb", course: "", status: "refunded", from: "2026-10-01", to: "2026-10-31" });
    expect(parseBillingFilters({ onglet: "factures", statut: "refunded", formation: id })).toMatchObject({ tab: "factures", status: "", course: id });
    expect(parseBillingFilters({ onglet: "x", statut: "paid" })).toMatchObject({ tab: "factures", status: "paid" });
    expect(parseBillingFilters({ onglet: "avoirs", statut: "paid" }).status).toBe("");
  });
  it("remet une période inversée dans l'ordre", () => {
    const f = parseBillingFilters({ du: "2026-11-01", au: "2026-10-01" });
    expect([f.from, f.to]).toEqual(["2026-10-01", "2026-11-01"]);
  });
});

describe("sharePct", () => {
  it("formate la part avec la virgule française", () => {
    expect(sharePct(344, 386)).toBe("89,1 %");
    expect(sharePct(0, 0)).toBe("0,0 %");
  });
});

describe("invoiceTotals / lineAmount / dueDateFor", () => {
  it("calcule les lignes avec remise, le total et l’échéance", () => {
    expect(lineAmount({ quantity: 2, unitPrice: 25000, discountPercent: 10 })).toBe(45000);
    expect(invoiceTotals([{ quantity: 1, unitPrice: 250000, discountPercent: 0 }, { quantity: 1, unitPrice: 25000, discountPercent: 0 }])).toEqual({ subtotal: 275000, discount: 0, total: 275000 });
    expect(invoiceTotals([{ quantity: 2, unitPrice: 25000, discountPercent: 10 }]).discount).toBe(5000);
    expect(dueDateFor("2026-10-22", "net14")).toBe("2026-11-05");
    expect(dueDateFor("2026-10-22", "on_receipt")).toBe("2026-10-22");
    expect(daysBetween("2026-10-22", "2026-11-05")).toBe(14);
  });
});

describe("createInvoiceSchema", () => {
  const line = { description: "Frais de formation – Agent de sécurité", quantity: 1, unitPrice: 250000, discountPercent: 0 };
  const base = { payerRef: "learner:" + id, courseId: id, subject: "Formation Agent de sécurité qualifié", issuedDate: "2026-10-22", dueDate: "2026-11-05", paymentTerms: "net14", acceptedMethods: ["mobile_money"], lines: [line], files: [] };
  it("accepte une facture détaillée et calcule le total", () => {
    const r = createInvoiceSchema.parse({ ...base, lines: [line, { ...line, description: "Kit de formation", unitPrice: 25000 }] });
    expect([r.payer, r.payerId, r.total, r.intent, r.sendEmail, r.note]).toEqual(["learner", id, 275000, "issue", false, null]);
  });
  it("exige client, objet, ligne valide et échéance après l’émission", () => {
    expect(createInvoiceSchema.safeParse({ ...base, payerRef: "" }).success).toBe(false);
    expect(createInvoiceSchema.safeParse({ ...base, subject: "" }).success).toBe(false);
    expect(createInvoiceSchema.safeParse({ ...base, lines: [] }).success).toBe(false);
    expect(createInvoiceSchema.safeParse({ ...base, lines: [{ ...line, quantity: 0 }] }).success).toBe(false);
    expect(createInvoiceSchema.safeParse({ ...base, dueDate: "2026-10-01" }).success).toBe(false);
    expect(createInvoiceSchema.safeParse({ ...base, lines: [{ ...line, unitPrice: 0 }] }).success).toBe(false);
  });
  it("exige une adresse valide pour l’envoi par e-mail", () => {
    expect(createInvoiceSchema.safeParse({ ...base, sendEmail: "1", clientEmail: "pas-un-mail" }).success).toBe(false);
    expect(createInvoiceSchema.safeParse({ ...base, sendEmail: "1", clientEmail: "Estelle@Entreprise.ci" }).success).toBe(true);
  });
});

describe("createRefundSchema", () => {
  const base = { type: "refund", invoiceId: id, amount: "150 000", reason: "Annulation de la session" };
  it("accepte un remboursement ou un avoir", () => {
    expect(createRefundSchema.parse(base).amount).toBe(150000);
    expect(createRefundSchema.safeParse({ ...base, type: "credit" }).success).toBe(true);
  });
  it("refuse une facture absente, un motif vide et un type inconnu", () => {
    expect(createRefundSchema.safeParse({ ...base, invoiceId: "" }).success).toBe(false);
    expect(createRefundSchema.safeParse({ ...base, reason: "" }).success).toBe(false);
    expect(createRefundSchema.safeParse({ ...base, type: "gift" }).success).toBe(false);
  });
});
