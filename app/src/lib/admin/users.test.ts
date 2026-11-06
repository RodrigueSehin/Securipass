import { describe, expect, it } from "vitest";
import { createUserSchema, pageWindow, parseUserFilters, temporaryPassword } from "./users";

describe("parseUserFilters", () => {
  it("ne garde que les valeurs connues", () => {
    expect(parseUserFilters({ q: "  jean  ", role: "instructor", statut: "suspended", periode: "30d", tri: "asc" }))
      .toEqual({ q: "jean", role: "instructor", status: "suspended", period: "30d", asc: true });
    expect(parseUserFilters({ role: "root", statut: "banni", periode: "1an", tri: "x" }))
      .toEqual({ q: "", role: "", status: "", period: "", asc: false });
    expect(parseUserFilters({ q: "x".repeat(300) }).q).toHaveLength(100);
  });
});

describe("pageWindow", () => {
  it("affiche toutes les pages quand il y en a peu", () => {
    expect(pageWindow(1, 1)).toEqual([1]);
    expect(pageWindow(3, 7)).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });
  it("abrège avec des points de suspension, comme dans la maquette", () => {
    expect(pageWindow(1, 525)).toEqual([1, 2, 3, 4, 5, "…", 525]);
    expect(pageWindow(100, 525)).toEqual([1, "…", 99, 100, 101, "…", 525]);
    expect(pageWindow(525, 525)).toEqual([1, "…", 521, 522, 523, 524, 525]);
  });
});

describe("createUserSchema", () => {
  const ok = {
    fullName: "Jean Koffi", gender: "male", email: "  Jean.Koffi@Exemple.CI ", phoneCode: "+225", phoneNumber: "07 07 07 07 07", photoPath: "",
    organizationId: "", jobTitle: "Agent de sécurité", department: "Sécurité", roles: ["learner"], status: "active", passwordMode: "auto",
  };
  it("normalise l'e-mail et transforme les champs vides en null", () => {
    const r = createUserSchema.parse({ ...ok, gender: "", jobTitle: "", department: "" });
    expect(r.email).toBe("jean.koffi@exemple.ci");
    expect(r.gender).toBeNull();
    expect(r.jobTitle).toBeNull();
    expect(r.department).toBeNull();
    expect(r.organizationId).toBe("");
  });
  it("exige nom, e-mail valide, téléphone valide et au moins un rôle connu", () => {
    expect(createUserSchema.safeParse(ok).success).toBe(true);
    expect(createUserSchema.safeParse({ ...ok, email: "abc" }).success).toBe(false);
    expect(createUserSchema.safeParse({ ...ok, fullName: "A" }).success).toBe(false);
    expect(createUserSchema.safeParse({ ...ok, phoneNumber: "12" }).success).toBe(false);
    expect(createUserSchema.safeParse({ ...ok, phoneCode: "+999" }).success).toBe(false);
    expect(createUserSchema.safeParse({ ...ok, roles: [] }).success).toBe(false);
    expect(createUserSchema.safeParse({ ...ok, roles: ["root"] }).success).toBe(false);
    expect(createUserSchema.safeParse({ ...ok, status: "banni" }).success).toBe(false);
    expect(createUserSchema.safeParse({ ...ok, organizationId: "pas-un-uuid" }).success).toBe(false);
  });
  it("contrôle le mot de passe uniquement quand il est défini à la main", () => {
    expect(createUserSchema.safeParse({ ...ok, password: "court" }).success).toBe(true);
    expect(createUserSchema.safeParse({ ...ok, passwordMode: "manual", password: "court1" }).success).toBe(false);
    expect(createUserSchema.safeParse({ ...ok, passwordMode: "manual", password: "uniquementlettres" }).success).toBe(false);
    expect(createUserSchema.safeParse({ ...ok, passwordMode: "manual", password: "1234567890123" }).success).toBe(false);
    expect(createUserSchema.safeParse({ ...ok, passwordMode: "manual", password: "Securipass2026" }).success).toBe(true);
  });
});

describe("temporaryPassword", () => {
  it("fait 16 caractères, sans caractères ambigus, avec chiffre et symbole", () => {
    const p = temporaryPassword((n) => Uint8Array.from({ length: n }, (_, i) => i * 7));
    expect(p).toHaveLength(16);
    expect(p).not.toMatch(/[0OIl1]/);
    expect(p).toMatch(/[0-9]/);
    expect(p).toMatch(/#/);
  });
});
