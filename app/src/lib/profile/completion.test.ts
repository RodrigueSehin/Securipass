import { describe, expect, it } from "vitest";
import { profileCompletion, type CompletionFields } from "./completion";
import { personalSchema, professionalSchema, preferencesSchema } from "./schemas";

const empty: CompletionFields = {
  full_name: "Awa Koné", phone: null, locality: null, address: null, profession: null, experience_band: null,
  education_level: null, languages: [], availability: null, training_goal: null, photo_path: null,
};

describe("complétion du profil", () => {
  it("un profil minimal vaut 0 %", () => {
    expect(profileCompletion(empty)).toMatchObject({ percent: 0, complete: false });
  });
  it("une section complète compte, une section partielle non", () => {
    const r = profileCompletion({ ...empty, phone: "+225 07 07 07 07 07", locality: "Abidjan", address: "Cocody" });
    expect(r.sections[0].done).toBe(true);
    expect(r.percent).toBe(33);
  });
  it("le profil est complet quand toutes les sections le sont", () => {
    const r = profileCompletion({
      ...empty, phone: "+225 07 07 07 07 07", locality: "Abidjan", address: "Cocody",
      profession: "Agent de sécurité", experience_band: "2_to_5", education_level: "baccalaureate",
      languages: ["fr"], availability: "full_time", training_goal: "Obtenir mes certificats", photo_path: "u/photo.jpg",
    });
    expect(r).toMatchObject({ percent: 100, complete: true });
  });
});

describe("validation du profil", () => {
  it("accepte un champ facultatif vide", () => {
    const r = personalSchema.parse({ fullName: "Awa Koné", timezone: "Africa/Abidjan", nationality: "  ", gender: "" });
    expect(r.nationality).toBeUndefined();
    expect(r.gender).toBeUndefined();
  });
  it("refuse une valeur hors liste", () => {
    expect(professionalSchema.safeParse({ educationLevel: "doctorat", languages: [] }).success).toBe(false);
    expect(professionalSchema.safeParse({ languages: ["fr", "klingon"] }).success).toBe(false);
  });
  it("lit les cases à cocher des préférences", () => {
    expect(preferencesSchema.parse({ notifyEmail: "on" })).toEqual({ notifyEmail: true, notifySms: false });
  });
});
