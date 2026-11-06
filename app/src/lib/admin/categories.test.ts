import { describe, expect, it } from "vitest";
import { createCategorySchema, parseCategoryFilters } from "./categories";

describe("parseCategoryFilters", () => {
  it("ne garde que les valeurs connues", () => {
    expect(parseCategoryFilters({ q: "  feu ", statut: "pending", tri: "name_asc" })).toEqual({ q: "feu", status: "pending", sort: "name_asc" });
    expect(parseCategoryFilters({ statut: "banni", tri: "zzz" })).toEqual({ q: "", status: "", sort: "recent" });
    expect(parseCategoryFilters({ q: "x".repeat(300) }).q).toHaveLength(100);
  });
});

describe("createCategorySchema", () => {
  const ok = {
    name: "Sécurité incendie", code: " cat-inc-001 ", parentId: "", order: "", shortDescription: "Prévention et lutte contre l'incendie.", longDescription: "",
    icon: "flame", color: "#EF4444", coverUrl: "", status: "active", visiblePlatform: "1", visibleCatalogue: "0",
  };
  it("accepte une catégorie valide et normalise les champs", () => {
    const r = createCategorySchema.safeParse(ok);
    expect(r.success).toBe(true);
    if (r.success) expect(r.data).toMatchObject({ code: "CAT-INC-001", order: 0, color: "#ef4444", longDescription: null, coverUrl: null, visiblePlatform: true, visibleCatalogue: false });
  });
  it("refuse les champs invalides", () => {
    const r = createCategorySchema.safeParse({ ...ok, name: "a", code: "x y", color: "rouge", shortDescription: "court", status: "?", coverUrl: "http://x" });
    expect(r.success).toBe(false);
    if (!r.success) expect(Object.keys(r.error.flatten().fieldErrors).sort()).toEqual(["code", "color", "coverUrl", "name", "shortDescription", "status"]);
  });
});
