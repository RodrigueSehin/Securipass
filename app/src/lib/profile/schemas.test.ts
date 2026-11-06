import { describe, expect, it } from "vitest";
import { passwordSchema, profileSchema } from "./schemas";

describe("profileSchema", () => {
  it("accepte un profil valide", () => {
    expect(profileSchema.safeParse({ fullName: "Awa Koné", phone: "+225 07 07 07 07", timezone: "Africa/Abidjan" }).success).toBe(true);
  });
  it("accepte un téléphone vide mais refuse un fuseau inconnu", () => {
    expect(profileSchema.safeParse({ fullName: "Awa", phone: "", timezone: "Africa/Abidjan" }).success).toBe(true);
    expect(profileSchema.safeParse({ fullName: "Awa", timezone: "Mars/Olympus" }).success).toBe(false);
  });
});

describe("passwordSchema", () => {
  const ok = { currentPassword: "ancienmdp123", newPassword: "nouveaumdp456", confirmPassword: "nouveaumdp456" };
  it("accepte un changement valide", () => expect(passwordSchema.safeParse(ok).success).toBe(true));
  it("refuse un mot de passe faible, non confirmé ou identique à l'actuel", () => {
    expect(passwordSchema.safeParse({ ...ok, newPassword: "court1", confirmPassword: "court1" }).success).toBe(false);
    expect(passwordSchema.safeParse({ ...ok, confirmPassword: "autre" }).success).toBe(false);
    expect(passwordSchema.safeParse({ ...ok, newPassword: "ancienmdp123", confirmPassword: "ancienmdp123" }).success).toBe(false);
  });
});
