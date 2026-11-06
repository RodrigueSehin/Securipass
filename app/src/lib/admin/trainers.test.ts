import { describe, expect, it } from "vitest";
import { createTrainerSchema, parseTrainerFilters } from "./trainers";

describe("parseTrainerFilters", () => {
  it("ne garde que les valeurs connues", () => {
    const id = "0b9f5d1e-1c2a-4f3b-8d4e-5a6b7c8d9e0f";
    expect(parseTrainerFilters({ q: "  koffi ", specialite: id, statut: "suspended", contrat: "internal", tri: "rating_desc" }))
      .toEqual({ q: "koffi", category: id, status: "suspended", contract: "internal", sort: "rating_desc" });
    expect(parseTrainerFilters({ specialite: "x", statut: "banni", contrat: "cdi", tri: "zzz" }))
      .toEqual({ q: "", category: "", status: "", contract: "", sort: "recent" });
    expect(parseTrainerFilters({ q: "x".repeat(300) }).q).toHaveLength(100);
  });
});

describe("createTrainerSchema", () => {
  const id = "0b9f5d1e-1c2a-4f3b-8d4e-5a6b7c8d9e0f";
  const ok = {
    fullName: "Koffi Jean", gender: "male", birthDate: "1985-05-15", email: " Jean.Koffi@Exemple.CI ", phoneCode: "+225", phoneNumber: "07 07 07 07 07",
    photoPath: "", jobTitle: "Formateur", mainCategory: id, extraCategories: [], organizationId: "", contract: "internal", experience: "8",
    city: "", bio: "Expert en sécurité incendie.", skills: [], diplomas: [], courseIds: [], passwordMode: "auto",
  };
  it("accepte un formateur valide et normalise les champs", () => {
    const r = createTrainerSchema.safeParse(ok);
    expect(r.success).toBe(true);
    if (r.success) expect(r.data).toMatchObject({ email: "jean.koffi@exemple.ci", experience: 8, city: null });
  });
  it("refuse les champs obligatoires manquants ou invalides", () => {
    const r = createTrainerSchema.safeParse({ ...ok, gender: "", contract: "", mainCategory: "", bio: "court", experience: "-1" });
    expect(r.success).toBe(false);
    if (!r.success) expect(Object.keys(r.error.flatten().fieldErrors).sort()).toEqual(["bio", "contract", "experience", "gender", "mainCategory"]);
  });
  it("exige un mot de passe solide en mode manuel", () => {
    expect(createTrainerSchema.safeParse({ ...ok, passwordMode: "manual", password: "court" }).success).toBe(false);
    expect(createTrainerSchema.safeParse({ ...ok, passwordMode: "manual", password: "MotDePasse123" }).success).toBe(true);
  });
});
