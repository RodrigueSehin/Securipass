import { describe, expect, it } from "vitest";
import { slugify, splitLines, withSuffix } from "./slug";

describe("slugify", () => {
  it("retire accents et ponctuation", () => {
    expect(slugify("Sauveteur Secouriste du Travail (SST) — Initial")).toBe("sauveteur-secouriste-du-travail-sst-initial");
    expect(slugify("  Sécurité incendie : œuvre  ")).toBe("securite-incendie-oeuvre");
  });
  it("garde une valeur par défaut", () => expect(slugify("!!!")).toBe("formation"));
  it("limite la longueur", () => expect(slugify("a".repeat(200)).length).toBeLessThanOrEqual(80));
});

describe("withSuffix", () => {
  it("n'ajoute rien à la première tentative, puis un suffixe aléatoire", () => {
    expect(withSuffix("abc", 0)).toBe("abc");
    expect(withSuffix("abc", 1)).toMatch(/^abc-[a-z0-9]{1,4}$/);
  });
});

describe("splitLines", () => {
  it("sépare, nettoie les puces et ignore les lignes vides", () => {
    expect(splitLines("- Premier\n\n• Deuxième\r\n  * Troisième  \n")).toEqual(["Premier", "Deuxième", "Troisième"]);
    expect(splitLines(null)).toEqual([]);
  });
});
