import { describe, expect, it } from "vitest";
import { createBlogPostSchema, parseBlogFilters, slugify } from "./blog";

describe("parseBlogFilters", () => {
  it("ne garde que les valeurs connues", () => {
    expect(parseBlogFilters({ q: " sst ", type: "news", categorie: "secourisme", statut: "draft", du: "2026-10-01", au: "2026-10-31" }))
      .toEqual({ q: "sst", kind: "news", category: "secourisme", status: "draft", from: "2026-10-01", to: "2026-10-31" });
    expect(parseBlogFilters({ type: "podcast", categorie: "x", statut: "deleted", du: "demain" }))
      .toEqual({ q: "", kind: "", category: "", status: "", from: "", to: "" });
  });
  it("remet une période inversée dans l'ordre", () => {
    const f = parseBlogFilters({ du: "2026-11-01", au: "2026-10-01" });
    expect([f.from, f.to]).toEqual(["2026-10-01", "2026-11-01"]);
  });
});

describe("slugify", () => {
  it("retire les accents et la ponctuation", () => {
    expect(slugify("Les gestes qui sauvent : que faire en cas d’arrêt cardiaque ?")).toBe("les-gestes-qui-sauvent-que-faire-en-cas-d-arret-cardiaque");
  });
});

describe("createBlogPostSchema", () => {
  const base = {
    title: "Équipements de protection : le guide", kind: "article", category: "agent-securite", visibility: "public", language: "fr", excerpt: "Tout savoir sur les EPI.",
    longBody: Array.from({ length: 400 }, () => "mot").join(" "), tags: ["epi"], coverUrl: "https://x.supabase.co/storage/v1/object/public/blog-covers/u/a.png",
    status: "published", publishDate: "2026-11-02", publishTime: "09:30", files: [],
  };
  it("accepte un contenu valide et calcule identifiant, lecture et date", () => {
    const r = createBlogPostSchema.parse(base);
    expect([r.slug, r.readMinutes, r.schedule, r.seoTitle]).toEqual(["equipements-de-protection-le-guide", 2, false, null]);
    expect(r.publishAt.toISOString()).toBe("2026-11-02T09:30:00.000Z");
  });
  it("exige image de couverture, contenu, catégorie et mots-clés bornés", () => {
    expect(createBlogPostSchema.safeParse({ ...base, coverUrl: "" }).success).toBe(false);
    expect(createBlogPostSchema.safeParse({ ...base, longBody: "" }).success).toBe(false);
    expect(createBlogPostSchema.safeParse({ ...base, category: "autre" }).success).toBe(false);
    expect(createBlogPostSchema.safeParse({ ...base, tags: Array.from({ length: 11 }, (_, i) => "t" + i) }).success).toBe(false);
  });
  it("refuse un titre sans lettres et des textes SEO trop longs", () => {
    expect(createBlogPostSchema.safeParse({ ...base, title: "?!" }).success).toBe(false);
    expect(createBlogPostSchema.safeParse({ ...base, seoDescription: "x".repeat(161) }).success).toBe(false);
  });
});
