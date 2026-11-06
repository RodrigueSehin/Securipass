import { describe, expect, it } from "vitest";
import { applyFilters, durationKey, facetCounts, pageWindow, paginate, sortCourses, type CatalogueCourse } from "./catalogue";
import { parseCatalogueParams } from "./filters";

const mk = (id: string, over: Partial<CatalogueCourse> = {}): CatalogueCourse => ({
  id, title: `Formation ${id}`, description: null, category: { name: "Secourisme", slug: "secourisme" },
  delivery_mode: "onsite", level: "beginner", duration_minutes: 480, price_amount: 20000, published_at: "2026-01-01T00:00:00Z", ...over,
});

const courses = [
  mk("a", { title: "Agent de sécurité", category: { name: "Sécurité privée", slug: "securite-privee" }, delivery_mode: "online", level: "intermediate", duration_minutes: 3600, price_amount: 49000, description: "Surveillance et prévention" }),
  mk("b", { title: "SST – Secourisme au travail", duration_minutes: 840, price_amount: 35000 }),
  mk("c", { title: "Sécurité incendie", category: { name: "Incendie", slug: "securite-incendie" }, delivery_mode: "hybrid", duration_minutes: 300, price_amount: 0, published_at: "2026-03-01T00:00:00Z" }),
  mk("d", { title: "Vidéosurveillance", category: null, level: "advanced", duration_minutes: 4200, price_amount: 120000 }),
];
const f = (raw: Record<string, string | string[]>) => parseCatalogueParams(raw);
const ids = (l: CatalogueCourse[]) => l.map((c) => c.id);

describe("durationKey", () => {
  it("classe aux bornes", () => {
    expect([599, 600, 1800, 1801, 3600, 3601].map(durationKey)).toEqual(["d1", "d2", "d2", "d3", "d3", "d4"]);
  });
});

describe("applyFilters", () => {
  it("ne filtre rien sans critère", () => expect(ids(applyFilters(courses, f({})))).toEqual(["a", "b", "c", "d"]));
  it("recherche sans tenir compte des accents ni de la casse, dans le titre et la description", () => {
    expect(ids(applyFilters(courses, f({ q: "secu" })))).toEqual(["a", "c"]);
    expect(ids(applyFilters(courses, f({ q: "PREVENTION" })))).toEqual(["a"]);
  });
  it("combine plusieurs valeurs d'une facette (OU) et plusieurs facettes (ET)", () => {
    expect(ids(applyFilters(courses, f({ categorie: ["securite-privee", "securite-incendie"] })))).toEqual(["a", "c"]);
    expect(ids(applyFilters(courses, f({ categorie: ["securite-privee", "securite-incendie"], format: "hybrid" })))).toEqual(["c"]);
  });
  it("filtre par niveau, durée et fourchette de prix (gratuit inclus)", () => {
    expect(ids(applyFilters(courses, f({ niveau: "advanced" })))).toEqual(["d"]);
    expect(ids(applyFilters(courses, f({ duree: ["d1", "d2"] })))).toEqual(["b", "c"]);
    expect(ids(applyFilters(courses, f({ pmin: "0", pmax: "35000" })))).toEqual(["b", "c"]);
  });
  it("« places disponibles » exige la liste des formations ouvertes", () => {
    expect(ids(applyFilters(courses, f({ dispo: "1" })))).toEqual([]);
    expect(ids(applyFilters(courses, f({ dispo: "1" }), { openIds: new Set(["b"]) }))).toEqual(["b"]);
  });
});

describe("facetCounts", () => {
  it("ignore la facette comptée mais respecte les autres filtres", () => {
    const counts = facetCounts(courses, f({ categorie: "securite-privee", format: "online" }));
    // catégories : compte avec format=online uniquement, sans filtrer par catégorie
    expect(counts.categories).toEqual({ "securite-privee": 1 });
    // formats : compte avec la catégorie sélectionnée, sans filtrer par format
    expect(counts.modes).toEqual({ online: 1 });
    expect(facetCounts(courses, f({})).categories).toEqual({ "securite-privee": 1, secourisme: 1, "securite-incendie": 1 });
  });
});

describe("sortCourses", () => {
  it("trie par prix, durée et nom", () => {
    expect(ids(sortCourses(courses, "prix_asc", new Map()))).toEqual(["c", "b", "a", "d"]);
    expect(ids(sortCourses(courses, "prix_desc", new Map()))).toEqual(["d", "a", "b", "c"]);
    expect(ids(sortCourses(courses, "duree", new Map()))).toEqual(["c", "b", "a", "d"]);
    expect(ids(sortCourses(courses, "nom", new Map()))).toEqual(["a", "c", "b", "d"]); // « Sécurité » avant « SST » en ordre alphabétique français
  });
  it("trie par popularité réelle, puis par récence à égalité", () => {
    expect(ids(sortCourses(courses, "populaires", new Map([["d", 9], ["b", 3]])))).toEqual(["d", "b", "c", "a"]);
    expect(ids(sortCourses(courses, "populaires", new Map()))[0]).toBe("c"); // aucune inscription : la plus récente
  });
  it("ne modifie pas la liste d'origine", () => {
    const copy = ids(courses);
    sortCourses(courses, "prix_desc", new Map());
    expect(ids(courses)).toEqual(copy);
  });
});

describe("paginate et pageWindow", () => {
  it("découpe et borne la page demandée", () => {
    const list = Array.from({ length: 27 }, (_, i) => i);
    expect(paginate(list, 1, 8)).toMatchObject({ pages: 4, total: 27, page: 1 });
    expect(paginate(list, 4, 8).items).toEqual([24, 25, 26]);
    expect(paginate(list, 99, 8).page).toBe(4);
    expect(paginate([], 1, 8)).toMatchObject({ pages: 1, items: [] });
  });
  it("affiche toutes les pages si peu nombreuses, sinon des points de suspension", () => {
    expect(pageWindow(1, 4)).toEqual([1, 2, 3, 4]);
    expect(pageWindow(1, 7)).toEqual([1, 2, 3, 4, 5, 6, 7]);
    expect(pageWindow(1, 12)).toEqual([1, 2, 3, 4, "…", 11, 12]);
    expect(pageWindow(6, 12)).toEqual([1, 2, "…", 5, 6, 7, "…", 11, 12]);
    expect(pageWindow(12, 12)).toEqual([1, 2, "…", 11, 12]);
  });
});

describe("mise en avant", () => {
  it("place les formations mises en avant en tête du tri par pertinence, pas des autres tris", () => {
    const base = { description: null, category: null, delivery_mode: "online" as const, level: "beginner" as const, duration_minutes: 60, price_amount: 0 };
    const list = [
      { ...base, id: "a", title: "A", published_at: "2026-01-02" },
      { ...base, id: "b", title: "B", published_at: "2026-01-01", featured: true },
    ];
    const popularity = new Map([["a", 50], ["b", 1]]);
    expect(sortCourses(list, "pertinence" as never, popularity).map((c) => c.id)).toEqual(["b", "a"]);
    expect(sortCourses(list, "nom", popularity).map((c) => c.id)).toEqual(["a", "b"]);
  });
});
