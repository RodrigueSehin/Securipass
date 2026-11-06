import { describe, expect, it } from "vitest";
import { courseToValues, parseStep, wizardUrl, type WizardCourse } from "./wizard";

const course: WizardCourse = {
  title: "Agent de sécurité", category_id: "c1", level: "beginner", delivery_mode: "onsite", duration_minutes: 90, price_amount: 0,
  language: "fr", target_audience: "Débutants\nAgents", prerequisites: null, description: "Texte", objectives: ["A", "B"], competencies: [],
  cover_url: null, evaluation_modalities: null, certificate_conditions: null, certificate_validity_months: null,
  prerequisite_course_id: null, cancellation_policy: null, accessibility: null, keywords: ["sécurité"], audience_types: ["companies", "partners"],
};

describe("étapes et adresses", () => {
  it("ramène l'étape demandée entre 1 et 5", () => {
    expect([undefined, "0", "3", "9", "x", "2.7"].map(parseStep)).toEqual([1, 1, 3, 1, 1, 2]);
  });
  it("construit l'adresse de destination", () => {
    expect(wizardUrl("abc", "3")).toBe("/formateur/formations/nouveau/abc?etape=3");
    expect(wizardUrl("abc", undefined)).toBe("/formateur/formations/nouveau/abc?etape=2");
    expect(wizardUrl("abc", "9")).toBe("/formateur/formations/nouveau/abc?etape=2");
    expect(wizardUrl("abc", "list")).toBe("/formateur/formations");
  });
});

describe("valeurs initiales", () => {
  it("convertit les listes et la durée au format des formulaires", () => {
    const v = courseToValues(course, "CODE-1");
    expect(v).toMatchObject({
      durationHours: "1.5", priceAmount: "0", objectives: "A\nB", keywords: "sécurité", audienceTypes: "companies,partners",
      targetAudience: "Débutants\nAgents", accessCode: "CODE-1", enrollmentMode: "free", subtitle: "", defaultCapacity: "",
    });
  });
  it("laisse la durée vide tant qu'elle n'est pas renseignée", () => {
    expect(courseToValues({ ...course, duration_minutes: 0 }).durationHours).toBe("");
  });
});
