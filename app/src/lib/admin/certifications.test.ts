import { describe, expect, it } from "vitest";
import { createCertificationSchema, parseCertificationFilters, validityLabel, validityToMonths } from "./certifications";

const id = "0b9f5d1e-1c2a-4f3b-8d4e-5a6b7c8d9e0f";

describe("parseCertificationFilters", () => {
  it("ne garde que les valeurs connues", () => {
    expect(parseCertificationFilters({ q: " sst ", categorie: id, statut: "review", onglet: "inactive" })).toEqual({ q: "sst", category: id, status: "review", tab: "inactive" });
    expect(parseCertificationFilters({ categorie: "x", statut: "draft", onglet: "z" })).toEqual({ q: "", category: "", status: "", tab: "all" });
  });
});

describe("validityLabel", () => {
  it("exprime la durée en ans ou en mois", () => {
    expect([validityLabel(null), validityLabel(12), validityLabel(36), validityLabel(18)]).toEqual(["Illimitée", "1 an", "3 ans", "18 mois"]);
  });
});

describe("validityToMonths", () => {
  it("convertit la saisie en mois", () => {
    expect([validityToMonths("3", "years"), validityToMonths("18", "months"), validityToMonths("", "years"), validityToMonths("0", "years")]).toEqual([36, 18, null, null]);
  });
});

describe("createCertificationSchema", () => {
  const base = {
    name: "Agent de sécurité qualifié", code: "cert-sec-001", categoryId: id, level: "professional", description: "Certification attestant des compétences.", courseId: id,
    evaluationType: "qcm_practical", passingScore: "70", maxAttempts: "2", validityValue: "3", validityUnit: "years", deliveryMode: "automatic", templateId: id,
  };
  it("accepte une fiche complète, normalise le code et convertit la validité", () => {
    const r = createCertificationSchema.parse(base);
    expect([r.code, r.validity, r.autoPdf, r.status]).toEqual(["CERT-SEC-001", 36, false, "active"]);
  });
  it("exige un code, une catégorie, un modèle et un score valides", () => {
    expect(createCertificationSchema.safeParse({ ...base, code: "" }).success).toBe(false);
    expect(createCertificationSchema.safeParse({ ...base, categoryId: "x" }).success).toBe(false);
    expect(createCertificationSchema.safeParse({ ...base, templateId: "" }).success).toBe(false);
    expect(createCertificationSchema.safeParse({ ...base, passingScore: "150" }).success).toBe(false);
  });
  it("refuse une validité trop longue et un préfixe invalide", () => {
    expect(createCertificationSchema.safeParse({ ...base, validityValue: "25" }).success).toBe(false);
    expect(createCertificationSchema.safeParse({ ...base, numberPrefix: "a b" }).success).toBe(false);
  });
});
