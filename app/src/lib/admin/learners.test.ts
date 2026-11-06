import { describe, expect, it } from "vitest";
import { createLearnerSchema, experienceBand, parseLearnerFilters } from "./learners";

describe("parseLearnerFilters", () => {
  it("ne garde que les valeurs connues", () => {
    const id = "0b9f5d1e-1c2a-4f3b-8d4e-5a6b7c8d9e0f";
    expect(parseLearnerFilters({ q: " koffi ", onglet: "certified", formation: id, entreprise: id, statut: "training", tri: "name" }))
      .toEqual({ q: "koffi", tab: "certified", course: id, org: id, status: "training", sort: "name" });
    expect(parseLearnerFilters({ onglet: "x", formation: "y", entreprise: "z", statut: "inactive", tri: "?" }))
      .toEqual({ q: "", tab: "all", course: "", org: "", status: "", sort: "recent" });
  });
});

describe("createLearnerSchema", () => {
  const id = "0b9f5d1e-1c2a-4f3b-8d4e-5a6b7c8d9e0f";
  const base = { civility: "male", lastName: "Koffi", firstName: "Jean Marc", birthDate: "1995-03-15", nationality: "Côte d’Ivoire", phoneCode: "+225", phoneNumber: "07 58 23 45 67",
    email: "Jean.Koffi@Exemple.ci", situation: "employee", courseIds: [id], enrollment: "none" };
  it("accepte une fiche minimale et normalise l’e-mail", () => {
    const r = createLearnerSchema.parse(base);
    expect(r.email).toBe("jean.koffi@exemple.ci");
    expect(r.experienceYears).toBeNull();
  });
  it("exige une session pour inscrire, et au moins une formation", () => {
    expect(createLearnerSchema.safeParse({ ...base, enrollment: "confirmed" }).success).toBe(false);
    expect(createLearnerSchema.safeParse({ ...base, enrollment: "confirmed", sessionId: id }).success).toBe(true);
    expect(createLearnerSchema.safeParse({ ...base, courseIds: [] }).success).toBe(false);
  });
  it("contrôle le mot de passe saisi", () => {
    expect(createLearnerSchema.safeParse({ ...base, password: "court1" }).success).toBe(false);
    expect(createLearnerSchema.safeParse({ ...base, password: "Motdepasse2026" }).success).toBe(true);
  });
});

describe("experienceBand", () => {
  it("range les années dans les tranches du profil", () => {
    expect([experienceBand(null), experienceBand(1), experienceBand(3), experienceBand(10), experienceBand(11)]).toEqual([null, "under_2", "2_to_5", "5_to_10", "over_10"]);
  });
});
