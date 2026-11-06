import { describe, expect, it } from "vitest";
import { attachmentLinkSchema, contentStep1Schema, contentStep2Schema, contentStep3Schema } from "./schemas";
import { contentToValues, contentWizardUrl, displayFileName, parseContentStep } from "./wizard";

const module_ = "3f6f1e2a-8b1c-4a0e-9c3d-2f7a5b6c7d8e";
const valid = { moduleId: module_, contentType: "document", title: "Les obligations de l’agent", durationMinutes: "25" };

describe("étapes et adresses", () => {
  it("ramène l'étape entre 1 et 4", () => {
    expect([undefined, "0", "2", "7", "x"].map(parseContentStep)).toEqual([1, 1, 2, 1, 1]);
  });
  it("construit la destination après enregistrement", () => {
    expect(contentWizardUrl("abc", "3")).toBe("/formateur/contenus/nouveau/abc?etape=3");
    expect(contentWizardUrl("abc", undefined)).toBe("/formateur/contenus/nouveau/abc?etape=2");
    expect(contentWizardUrl("abc", undefined, 4)).toBe("/formateur/contenus/nouveau/abc?etape=4");
    expect(contentWizardUrl("abc", "list")).toBe("/formateur/contenus");
  });
  it("retrouve le nom d'un fichier stocké", () => {
    expect(displayFileName("u1/3f6f1e2a-8b1c-4a0e-9c3d-2f7a5b6c7d8e-Les_obligations.pdf")).toBe("Les_obligations.pdf");
    expect(displayFileName("u1/x.pdf", "Mon fichier.pdf")).toBe("Mon fichier.pdf");
    expect(displayFileName(null)).toBe("");
  });
  it("convertit un contenu en valeurs de formulaire", () => {
    const v = contentToValues({ title: "T", duration_minutes: 25, is_required: false, publish_at: "2026-10-12T08:00:00Z", file_size_bytes: 2400000 });
    expect(v).toMatchObject({ title: "T", durationMinutes: "25", isRequired: "0", isVisible: "1", publishAt: "2026-10-12T08:00", fileSize: "2400000", contentType: "document" });
  });
});

describe("étape 1", () => {
  it("exige module, type, titre et durée", () => {
    expect(contentStep1Schema.safeParse(valid).success).toBe(true);
    expect(contentStep1Schema.safeParse({ ...valid, title: "a" }).success).toBe(false);
    expect(contentStep1Schema.safeParse({ ...valid, durationMinutes: "0" }).success).toBe(false);
    expect(contentStep1Schema.safeParse({ ...valid, contentType: "autre" }).success).toBe(false);
    expect(contentStep1Schema.safeParse({ ...valid, moduleId: "" }).success).toBe(false);
  });
  it("un champ vide efface, un champ absent laisse inchangé", () => {
    const cleared = contentStep1Schema.safeParse({ ...valid, description: "", filePath: "", externalUrl: "" });
    expect(cleared.success && cleared.data.description).toBeNull();
    expect(cleared.success && cleared.data.filePath).toBeNull();
    expect(cleared.success && cleared.data.externalUrl).toBeNull();
    const absent = contentStep1Schema.safeParse(valid);
    expect(absent.success && absent.data.description).toBeUndefined();
  });
  it("n'accepte qu'un lien https", () => {
    expect(contentStep1Schema.safeParse({ ...valid, externalUrl: "https://youtu.be/abc" }).success).toBe(true);
    expect(contentStep1Schema.safeParse({ ...valid, externalUrl: "http://exemple.ci" }).success).toBe(false);
  });
});

describe("étape 2", () => {
  it("accepte un texte long et un quiz, refuse un identifiant invalide", () => {
    expect(contentStep2Schema.safeParse({ body: "x".repeat(2000) }).success).toBe(true);
    expect(contentStep2Schema.safeParse({ evaluationId: module_ }).success).toBe(true);
    expect(contentStep2Schema.safeParse({ evaluationId: "pas-un-uuid" }).success).toBe(false);
  });
});

describe("étape 3", () => {
  const base = { moduleId: module_, durationMinutes: "25" };
  it("valide les dates et la période de disponibilité", () => {
    expect(contentStep3Schema.safeParse({ ...base, publishAt: "2026-10-12T08:00" }).success).toBe(true);
    expect(contentStep3Schema.safeParse({ ...base, publishAt: "pas une date" }).success).toBe(false);
    expect(contentStep3Schema.safeParse({ ...base, publishAt: "2026-10-12T08:00", availableUntil: "2026-10-10T08:00" }).success).toBe(false);
    expect(contentStep3Schema.safeParse({ ...base, publishAt: "2026-10-12T08:00", availableUntil: "2026-12-10T08:00" }).success).toBe(true);
    expect(contentStep3Schema.safeParse({ ...base, publishAt: "", availableUntil: "" }).success).toBe(true);
  });
  it("convertit les options à cocher et contrôle la position et le niveau", () => {
    const r = contentStep3Schema.safeParse({ ...base, isRequired: "0", notifyLearners: "1", position: "2", requiredLevel: "advanced" });
    expect(r.success && r.data.isRequired).toBe(false);
    expect(r.success && r.data.notifyLearners).toBe(true);
    expect(r.success && r.data.position).toBe(2);
    expect(contentStep3Schema.safeParse({ ...base, position: "0" }).success).toBe(false);
    expect(contentStep3Schema.safeParse({ ...base, requiredLevel: "expert" }).success).toBe(false);
  });
});

describe("lien complémentaire", () => {
  it("exige une adresse https", () => {
    expect(attachmentLinkSchema.safeParse({ url: "https://exemple.ci/ressource", name: "Guide" }).success).toBe(true);
    expect(attachmentLinkSchema.safeParse({ url: "http://exemple.ci" }).success).toBe(false);
    expect(attachmentLinkSchema.safeParse({ url: "pas un lien" }).success).toBe(false);
  });
});
