import { describe, expect, it } from "vitest";
import { areaForPath, canAccessArea, homeForRoles, spacesForRoles } from "./permissions";

describe("permissions", () => {
  it("un apprenant n'accède pas aux espaces formateur, entreprise et admin", () => {
    expect(canAccessArea(["learner"], "/app")).toBe(true);
    expect(canAccessArea(["learner"], "/formateur")).toBe(false);
    expect(canAccessArea(["learner"], "/entreprise")).toBe(false);
    expect(canAccessArea(["learner"], "/admin")).toBe(false);
  });

  it("un utilisateur multi-rôles cumule les accès", () => {
    expect(canAccessArea(["learner", "instructor"], "/formateur")).toBe(true);
  });

  it("le support accède au back-office", () => {
    expect(canAccessArea(["support"], "/admin")).toBe(true);
  });

  it("détecte l'espace d'un chemin sans confondre les préfixes", () => {
    expect(areaForPath("/admin/utilisateurs")).toBe("/admin");
    expect(areaForPath("/app")).toBe("/app");
    expect(areaForPath("/application-publique")).toBeNull();
    expect(areaForPath("/formations")).toBeNull();
  });

  it("choisit l'espace d'atterrissage selon le rôle", () => {
    expect(homeForRoles(["learner"])).toBe("/app");
    expect(homeForRoles(["learner", "instructor"])).toBe("/formateur");
    expect(homeForRoles(["admin", "instructor"])).toBe("/admin");
  });
});

describe("espaces proposés dans le menu", () => {
  const hrefs = (roles: string[]) => spacesForRoles(roles).map((s) => s.href);
  it("l'administrateur accède à tous les espaces", () => {
    expect(hrefs(["learner", "admin"])).toEqual(["/app", "/formateur", "/entreprise", "/admin"]);
  });
  it("un apprenant ne voit que son espace", () => {
    expect(hrefs(["learner"])).toEqual(["/app"]);
  });
  it("un formateur voit son espace, pas l'administration", () => {
    expect(hrefs(["instructor"])).toEqual(["/formateur"]);
    expect(hrefs(["learner", "instructor"])).toEqual(["/app", "/formateur"]);
  });
  it("le personnel pédagogique voit l'administration", () => {
    expect(hrefs(["pedagogy_manager"])).toEqual(["/admin"]);
  });
});
