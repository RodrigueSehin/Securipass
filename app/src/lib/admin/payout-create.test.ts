import { describe, expect, it } from "vitest";
import { createPayoutSchema, payoutDate, payoutDetails, payoutTotals } from "./payout-create";

const id = "7d1c2b3a-1111-4222-8333-444455556666";
const base = { instructorId: id, commissionIds: [id], method: "bank_transfer", paidDate: "2026-10-15", fees: "", reason: "Versement des commissions",
  holder: "Koffi Jean", bank: "SIB", account: "CI93 0110", proofPath: "" };

describe("payoutTotals", () => {
  it("calcule le net et plafonne les frais au total", () => {
    expect(payoutTotals([180_000, 120_000, 150_000], 0)).toEqual({ count: 3, total: 450_000, fees: 0, net: 450_000 });
    expect(payoutTotals([100_000], 2_500)).toMatchObject({ fees: 2_500, net: 97_500 });
    expect(payoutTotals([100_000], 999_999)).toMatchObject({ fees: 100_000, net: 0 });
    expect(payoutTotals([], -5)).toEqual({ count: 0, total: 0, fees: 0, net: 0 });
  });
});

describe("payoutDetails", () => {
  it("demande les coordonnées selon le mode", () => {
    expect(payoutDetails("bank_transfer").bankLabel).toBe("Établissement bancaire");
    expect(payoutDetails("mobile_money").bankLabel).toBe("Opérateur");
    expect(payoutDetails("cash")).toMatchObject({ holder: false, bank: false, account: false });
  });
});

describe("createPayoutSchema", () => {
  it("accepte un virement complet", () => {
    const r = createPayoutSchema.safeParse(base);
    expect(r.success).toBe(true);
    if (r.success) expect(r.data).toMatchObject({ fees: 0, proofPath: null, method: "bank_transfer" });
  });
  it("exige les coordonnées d'un virement mais pas celles d'un versement en espèces", () => {
    const miss = createPayoutSchema.safeParse({ ...base, holder: "", bank: "", account: "" });
    expect(miss.success).toBe(false);
    if (!miss.success) expect(Object.keys(miss.error.flatten().fieldErrors)).toEqual(expect.arrayContaining(["holder", "bank", "account"]));
    expect(createPayoutSchema.safeParse({ ...base, method: "cash", holder: "", bank: "", account: "" }).success).toBe(true);
  });
  it("refuse sans commission, sans motif ou avec des frais invalides", () => {
    expect(createPayoutSchema.safeParse({ ...base, commissionIds: [] }).success).toBe(false);
    expect(createPayoutSchema.safeParse({ ...base, reason: " " }).success).toBe(false);
    expect(createPayoutSchema.safeParse({ ...base, fees: "-4" }).success).toBe(false);
    expect(createPayoutSchema.safeParse({ ...base, instructorId: "x" }).success).toBe(false);
  });
});

describe("payoutDate", () => {
  const now = new Date("2026-10-15T09:30:00Z");
  it("garde l'heure du jour, date un jour passé à midi et refuse le futur", () => {
    expect(payoutDate("2026-10-15", now)?.toISOString()).toBe("2026-10-15T09:30:00.000Z");
    expect(payoutDate("2026-10-10", now)?.toISOString()).toBe("2026-10-10T12:00:00.000Z");
    expect(payoutDate("2026-10-16", now)).toBeNull();
    expect(payoutDate("n'importe quoi", now)).toBeNull();
  });
});
