import { describe, expect, it } from "vitest";
import { BLOG_POSTS } from "@/content/blog";
import { blogHref, categoryCounts, popularPosts, queryPosts } from "./blog";

describe("blog", () => {
  it("trie du plus récent au plus ancien", () => {
    const { items } = queryPosts(BLOG_POSTS, {});
    expect(items.map((p) => p.date)).toEqual(items.map((p) => p.date).toSorted().toReversed());
  });
  it("filtre par catégorie et ignore une catégorie inconnue", () => {
    expect(queryPosts(BLOG_POSTS, { category: "secourisme" }).items.every((p) => p.category === "secourisme")).toBe(true);
    expect(queryPosts(BLOG_POSTS, { category: "inconnue" }).total).toBe(BLOG_POSTS.length);
  });
  it("recherche sans tenir compte des accents ni de la casse", () => {
    expect(queryPosts(BLOG_POSTS, { q: "REANIMATION" }).total).toBe(1);
    expect(queryPosts(BLOG_POSTS, { q: "zzz" }).total).toBe(0);
  });
  it("borne la page demandée", () => {
    expect(queryPosts(BLOG_POSTS, { page: 99 }).page).toBe(1);
    expect(queryPosts(BLOG_POSTS, { page: -3 }).page).toBe(1);
  });
  it("compte les articles par catégorie et classe les populaires", () => {
    expect(categoryCounts(BLOG_POSTS).get("agent-securite")).toBe(2);
    expect(popularPosts(BLOG_POSTS).map((p) => p.popular)).toEqual([1, 2, 3, 4, 5]);
  });
  it("conserve les filtres dans les liens", () => {
    expect(blogHref({})).toBe("/blog");
    expect(blogHref({ categorie: "secourisme", page: 2 })).toBe("/blog?categorie=secourisme&page=2");
  });
});
