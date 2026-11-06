import { describe, expect, it } from "vitest";
import { contentSchema, courseReadiness, courseSchema, evaluationStepSchema, publicationStepSchema, settingsStepSchema } from "./schemas";

const valid = {
  title: "Gestes de premiers secours",
  categoryId: "3f6f1e2a-8b1c-4a0e-9c3d-2f7a5b6c7d8e",
  description: "Une formation complète pour apprendre les gestes qui sauvent en milieu professionnel.",
  objectives: "- Alerter\n- Protéger",
  level: "beginner",
  deliveryMode: "onsite",
  durationHours: "8",
  priceAmount: "25000",
};

describe("courseSchema", () => {
  it("accepte une formation valide et transforme les listes", () => {
    const r = courseSchema.safeParse(valid);
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.objectives).toEqual(["Alerter", "Protéger"]);
      expect(r.data.durationHours).toBe(8);
      expect(r.data.priceAmount).toBe(25000);
      expect(r.data.certificateValidityMonths).toBeUndefined();
    }
  });
  it("refuse prix négatif ou décimal, durée nulle, catégorie invalide", () => {
    expect(courseSchema.safeParse({ ...valid, priceAmount: "-5" }).success).toBe(false);
    expect(courseSchema.safeParse({ ...valid, priceAmount: "10.5" }).success).toBe(false);
    expect(courseSchema.safeParse({ ...valid, durationHours: "0" }).success).toBe(false);
    expect(courseSchema.safeParse({ ...valid, categoryId: "abc" }).success).toBe(false);
  });
  it("n'accepte qu'une image https en couverture", () => {
    expect(courseSchema.safeParse({ ...valid, coverUrl: "http://x.ci/a.png" }).success).toBe(false);
    expect(courseSchema.safeParse({ ...valid, coverUrl: "https://x.ci/a.png" }).success).toBe(true);
    expect(courseSchema.safeParse({ ...valid, coverUrl: "" }).success).toBe(true);
  });
});

describe("contentSchema", () => {
  const base = { title: "Leçon", status: "draft" };
  it("une vidéo ou un PDF exige un fichier ou un lien https", () => {
    expect(contentSchema.safeParse({ ...base, contentType: "video" }).success).toBe(false);
    expect(contentSchema.safeParse({ ...base, contentType: "video", externalUrl: "http://x.ci" }).success).toBe(false);
    expect(contentSchema.safeParse({ ...base, contentType: "video", externalUrl: "https://x.ci/v" }).success).toBe(true);
    expect(contentSchema.safeParse({ ...base, contentType: "pdf", filePath: "u/doc.pdf" }).success).toBe(true);
  });
  it("un texte exige un corps, une activité pratique exige une consigne", () => {
    expect(contentSchema.safeParse({ ...base, contentType: "text" }).success).toBe(false);
    expect(contentSchema.safeParse({ ...base, contentType: "text", body: "Contenu" }).success).toBe(true);
    expect(contentSchema.safeParse({ ...base, contentType: "practice" }).success).toBe(false);
    expect(contentSchema.safeParse({ ...base, contentType: "practice", description: "Mise en situation" }).success).toBe(true);
  });
});

describe("courseReadiness", () => {
  const ok = { categoryId: "c", description: "x".repeat(60), objectives: ["a"], targetAudience: "Agents", durationMinutes: 60, evaluationModalities: "QCM", modules: [{ publishedContents: 1 }] };
  it("ne signale rien pour une formation complète", () => expect(courseReadiness(ok)).toEqual([]));
  it("liste tout ce qui manque", () => {
    const missing = courseReadiness({ objectives: [], durationMinutes: 0, modules: [] });
    expect(missing.length).toBe(7);
  });
  it("exige au moins un contenu publié", () => {
    expect(courseReadiness({ ...ok, modules: [{ publishedContents: 0 }] })).toEqual(["Publiez au moins un contenu dans le programme"]);
  });
});

describe("champs de l'assistant de création", () => {
  it("un champ vide efface la valeur, un champ absent la laisse inchangée", () => {
    const cleared = courseSchema.safeParse({ ...valid, subtitle: "", courseCode: "  " });
    expect(cleared.success && cleared.data.subtitle).toBeNull();
    expect(cleared.success && cleared.data.courseCode).toBeNull();
    const absent = courseSchema.safeParse(valid);
    expect(absent.success && absent.data.subtitle).toBeUndefined();
  });

  it("refuse un sous-titre trop long et un public inconnu", () => {
    expect(courseSchema.safeParse({ ...valid, subtitle: "x".repeat(151) }).success).toBe(false);
    expect(courseSchema.safeParse({ ...valid, audienceTypes: ["inconnu"] }).success).toBe(false);
    expect(courseSchema.safeParse({ ...valid, audienceTypes: ["companies"], keywords: ["sécurité"] }).success).toBe(true);
  });

  it("le modèle de certificat est un identifiant ou vide", () => {
    expect(courseSchema.safeParse({ ...valid, certificateTemplateId: "pas-un-uuid" }).success).toBe(false);
    const r = courseSchema.safeParse({ ...valid, certificateTemplateId: "" });
    expect(r.success && r.data.certificateTemplateId).toBeNull();
  });
});

describe("places par session et niveau de langue", () => {
  it("accepte une capacité, la vide ou la laisse absente", () => {
    const set = courseSchema.safeParse({ ...valid, defaultCapacity: "25" });
    expect(set.success && set.data.defaultCapacity).toBe(25);
    const cleared = courseSchema.safeParse({ ...valid, defaultCapacity: "" });
    expect(cleared.success && cleared.data.defaultCapacity).toBeNull();
    const absent = courseSchema.safeParse(valid);
    expect(absent.success && absent.data.defaultCapacity).toBeUndefined();
    expect(courseSchema.safeParse({ ...valid, defaultCapacity: "0" }).success).toBe(false);
  });

  it("valide le niveau de langue requis", () => {
    expect(courseSchema.safeParse({ ...valid, languageRequirement: "fluent" }).success).toBe(true);
    expect(courseSchema.safeParse({ ...valid, languageRequirement: "expert" }).success).toBe(false);
    const r = courseSchema.safeParse({ ...valid, languageRequirement: "" });
    expect(r.success && r.data.languageRequirement).toBeNull();
  });
});

describe("étape 4 : paramètres", () => {
  const base = { priceAmount: "0" }; // le prix est toujours envoyé par le formulaire
  it("une publication planifiée exige une date valide", () => {
    expect(settingsStepSchema.safeParse({ ...base, publicationMode: "scheduled" }).success).toBe(false);
    expect(settingsStepSchema.safeParse({ ...base, publicationMode: "scheduled", publishAt: "pas une date" }).success).toBe(false);
    expect(settingsStepSchema.safeParse({ ...base, publicationMode: "scheduled", publishAt: "2026-12-12T08:00" }).success).toBe(true);
    expect(settingsStepSchema.safeParse({ ...base, publicationMode: "publish" }).success).toBe(true);
  });

  it("valide les moyens de paiement et les options à cocher", () => {
    expect(settingsStepSchema.safeParse({ ...base, paymentMethods: ["card", "mobile_money"], forumEnabled: "1", showProgress: "0" }).success).toBe(true);
    expect(settingsStepSchema.safeParse({ ...base, paymentMethods: ["cheque"] }).success).toBe(false);
    const r = settingsStepSchema.safeParse({ ...base, forumEnabled: "1", allowDownloads: "0" });
    expect(r.success && r.data.forumEnabled).toBe(true);
    expect(r.success && r.data.allowDownloads).toBe(false);
    expect(settingsStepSchema.safeParse({ ...base, forumEnabled: "oui" }).success).toBe(false);
  });

  it("le prix et la formation parent sont optionnels et contrôlés", () => {
    expect(settingsStepSchema.safeParse({ priceAmount: "25000", parentCourseId: "" }).success).toBe(true);
    expect(settingsStepSchema.safeParse({ priceAmount: "-1" }).success).toBe(false);
    expect(settingsStepSchema.safeParse({ ...base, parentCourseId: "x" }).success).toBe(false);
  });
});

describe("étape 3 : évaluation", () => {
  it("accepte les réglages valides et refuse les valeurs hors limites", () => {
    expect(evaluationStepSchema.safeParse({ passMarkPercent: "70", gradingScale: "20", gradeRounding: "up", defaultAttempts: "2", showResults: "1" }).success).toBe(true);
    expect(evaluationStepSchema.safeParse({ passMarkPercent: "120" }).success).toBe(false);
    expect(evaluationStepSchema.safeParse({ gradingScale: "15" }).success).toBe(false);
    expect(evaluationStepSchema.safeParse({ defaultAttempts: "0" }).success).toBe(false);
    expect(evaluationStepSchema.safeParse({ certificateDisplay: ["qr", "inconnu"] }).success).toBe(false);
  });
});

describe("étape 5 : publication", () => {
  it("accepte les trois modes et exige une date pour la planification", () => {
    expect(publicationStepSchema.safeParse({ publicationMode: "publish", featured: "1", registrationsOpen: "0" }).success).toBe(true);
    expect(publicationStepSchema.safeParse({ publicationMode: "draft" }).success).toBe(true);
    expect(publicationStepSchema.safeParse({ publicationMode: "scheduled" }).success).toBe(false);
    expect(publicationStepSchema.safeParse({ publicationMode: "scheduled", publishAt: "2026-12-12T08:00" }).success).toBe(true);
    expect(publicationStepSchema.safeParse({ publicationMode: "immediat" }).success).toBe(false);
  });
  it("convertit les interrupteurs en booléens", () => {
    const r = publicationStepSchema.safeParse({ publicationMode: "publish", featured: "1", registrationsOpen: "0" });
    expect(r.success && r.data.featured).toBe(true);
    expect(r.success && r.data.registrationsOpen).toBe(false);
  });
});
