import { describe, expect, it } from "vitest";
import { compactAmount, createPaymentSchema, formatShare, parsePaymentFilters, paymentTotals } from "./payments";

const id = "0b9f5d1e-1c2a-4f3b-8d4e-5a6b7c8d9e0f";

describe("parsePaymentFilters", () => {
  it("ne garde que les valeurs connues", () => {
    expect(parsePaymentFilters({ q: " pay ", formation: id, statut: "failed", du: "2026-10-01", au: "2026-10-31" }))
      .toEqual({ q: "pay", course: id, status: "failed", from: "2026-10-01", to: "2026-10-31" });
    expect(parsePaymentFilters({ formation: "x", statut: "cancelled", du: "demain" })).toEqual({ q: "", course: "", status: "", from: "", to: "" });
  });
  it("remet une période inversée dans l'ordre", () => {
    const f = parsePaymentFilters({ du: "2026-11-01", au: "2026-10-01" });
    expect([f.from, f.to]).toEqual(["2026-10-01", "2026-11-01"]);
  });
});

describe("formatShare / compactAmount", () => {
  it("formate la part et l'axe des montants", () => {
    expect(formatShare(25_600_000, 28_750_000)).toBe("89,0 %");
    expect(formatShare(0, 0)).toBe("0,0 %");
    expect([compactAmount(0), compactAmount(500_000), compactAmount(8_000_000)]).toEqual(["0", "500 k", "8 M"]);
  });
});

describe("paymentTotals", () => {
  it("calcule le total avec remise en FCFA ou en pourcentage, et frais", () => {
    expect(paymentTotals(250000, 0, "fcfa", 0).total).toBe(250000);
    expect(paymentTotals(250000, 10, "percent", 1000)).toEqual({ discount: 25000, fees: 1000, total: 226000 });
    expect(paymentTotals(250000, 5000, "fcfa", 0).total).toBe(245000);
  });
});

describe("createPaymentSchema", () => {
  const base = { payerRef: "learner:" + id, kind: "course", courseId: id, amount: "250 000", method: "mobile_money", status: "confirmed", paidDate: "2026-10-22", paidTime: "10:24" };
  it("accepte un paiement de formation et calcule le total", () => {
    const r = createPaymentSchema.parse(base);
    expect([r.payer, r.payerId, r.total, r.grossAmount, r.discountAmount, r.feesAmount, r.note]).toEqual(["learner", id, 250000, 250000, 0, 0, null]);
    expect(r.paidAt.toISOString()).toBe("2026-10-22T10:24:00.000Z");
  });
  it("applique remise (FCFA ou %) et frais au montant enregistré", () => {
    expect(createPaymentSchema.parse({ ...base, discount: "10", discountUnit: "percent", fees: "500" }).total).toBe(225500);
    expect(createPaymentSchema.parse({ ...base, discount: "5000", fees: "1 000" }).total).toBe(246000);
  });
  it("exige le payeur, la formation ou la précision selon le type", () => {
    expect(createPaymentSchema.safeParse({ ...base, payerRef: "" }).success).toBe(false);
    expect(createPaymentSchema.safeParse({ ...base, courseId: "" }).success).toBe(false);
    expect(createPaymentSchema.safeParse({ ...base, kind: "other", courseId: "" }).success).toBe(false);
    expect(createPaymentSchema.safeParse({ ...base, kind: "other", courseId: "", label: "Audit de site" }).success).toBe(true);
  });
  it("refuse un montant nul, une remise excessive et un statut inconnu", () => {
    expect(createPaymentSchema.safeParse({ ...base, amount: "0" }).success).toBe(false);
    expect(createPaymentSchema.safeParse({ ...base, discount: "300000" }).success).toBe(false);
    expect(createPaymentSchema.safeParse({ ...base, discount: "120", discountUnit: "percent" }).success).toBe(false);
    expect(createPaymentSchema.safeParse({ ...base, status: "cancelled" }).success).toBe(false);
  });
});
