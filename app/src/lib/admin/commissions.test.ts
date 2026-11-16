import { describe, expect, it } from "vitest";
import { formatRate, monthLabel, monthShort, parseCommissionFilters, sessionLabel } from "./commissions";

describe("parseCommissionFilters", () => {
  it("ne garde que les valeurs connues", () => {
    expect(parseCommissionFilters({ onglet: "versements", q: "  sst ", mois: "2026-10", statut: "paid", formateur: "7d1c2b3a-1111-4222-8333-444455556666" }))
      .toEqual({ tab: "versements", q: "sst", month: "2026-10", status: "paid", instructor: "7d1c2b3a-1111-4222-8333-444455556666" });
    expect(parseCommissionFilters({ onglet: "x", mois: "2026-13", statut: "zzz", formateur: "nope" }))
      .toEqual({ tab: "commissions", q: "", month: "", status: "", instructor: "" });
    expect(parseCommissionFilters({ q: "x".repeat(300) }).q).toHaveLength(100);
  });
});

describe("libellés", () => {
  it("formate mois, session et taux en français", () => {
    expect(monthLabel("2026-10", "long")).toBe("Octobre 2026");
    expect(monthShort("2026-05")).toBe("Mai");
    expect(sessionLabel("2026-10-12T08:00:00Z")).toBe("Session Octobre 2026");
    expect(sessionLabel(null)).toBe("Sans session");
    expect(formatRate(15)).toBe("15 %");
    expect(formatRate(12.5)).toBe("12,5 %");
  });
});
