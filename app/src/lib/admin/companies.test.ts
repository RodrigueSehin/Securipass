import { describe, expect, it } from "vitest";
import { industryTone, parseCompanyFilters, createCompanySchema } from "./companies";

describe("parseCompanyFilters", () => {
  it("ne garde que les valeurs connues", () => {
    expect(parseCompanyFilters({ q: "  agl ", secteur: "Énergie", statut: "pending", ville: "Abidjan", tri: "status" }))
      .toEqual({ q: "agl", industry: "Énergie", status: "pending", city: "Abidjan", sort: "status" });
    expect(parseCompanyFilters({ statut: "banni", tri: "zzz" })).toEqual({ q: "", industry: "", status: "", city: "", sort: "recent" });
    expect(parseCompanyFilters({ q: "x".repeat(300) }).q).toHaveLength(100);
  });
});

describe("industryTone", () => {
  it("donne toujours la même couleur au même secteur", () => {
    const tones = ["a", "b", "c"] as const;
    expect(industryTone("Énergie", tones)).toBe(industryTone("Énergie", tones));
    expect(tones).toContain(industryTone("Assurance", tones));
  });
});

describe("createCompanySchema", () => {
  const base = { name: "SODECI Sécurité CI", legalForm: "SARL", registration: "CI-ABJ-2026-B-12345", taxId: "1234567A", sector: "Industrie", country: "CI", city: "Abidjan", address: "Boulevard Mitterrand",
    contactName: "Koffi Yao", contactRole: "RH", contactPhone: "+225 07 07 08 09 10", contactEmail: "KOFFI@sodeci.ci", status: "active", partnership: "client" };
  it("accepte une fiche complète et normalise l’e-mail", () => {
    const r = createCompanySchema.parse(base);
    expect(r.contactEmail).toBe("koffi@sodeci.ci");
    expect(r.hasSecondary).toBe(false);
  });
  it("exige le contact secondaire quand il est activé", () => {
    const r = createCompanySchema.safeParse({ ...base, hasSecondary: "1" });
    expect(r.success).toBe(false);
    expect(createCompanySchema.safeParse({ ...base, legalForm: "X" }).success).toBe(false);
    expect(createCompanySchema.safeParse({ ...base, primaryColor: "rouge" }).success).toBe(false);
  });
});
