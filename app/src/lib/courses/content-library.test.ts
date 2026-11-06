import { describe, expect, it } from "vitest";
import { countByType, filterContents, relatedContents, type LibraryContent } from "./content-library";

const c = (id: string, over: Partial<LibraryContent>): LibraryContent => ({
  id, title: id, type: "video", description: null, durationMinutes: 10, status: "published",
  createdAt: "2026-10-01T00:00:00Z", updatedAt: "2026-10-01T00:00:00Z", position: 1,
  moduleId: "m1", moduleTitle: "Introduction", modulePosition: 1, courseId: "f1", courseTitle: "Agent", completions: 0, ...over,
});

const rows = [
  c("a", { title: "Étude de cas", type: "practice", createdAt: "2026-10-03T00:00:00Z", position: 2 }),
  c("b", { title: "Zèbre intro", type: "video", createdAt: "2026-10-09T00:00:00Z", position: 1 }),
  c("c", { title: "Support PDF", type: "pdf", moduleId: "m2", modulePosition: 2, courseId: "f2", createdAt: "2026-10-05T00:00:00Z" }),
  c("d", { title: "Quiz intro", type: "text", createdAt: "2026-09-30T00:00:00Z", position: 3 }),
];

describe("filtres et tri", () => {
  it("trie par date de création, la plus récente d'abord", () => {
    expect(filterContents(rows, {}).map((r) => r.id)).toEqual(["b", "c", "a", "d"]);
  });

  it("filtre par type valide, ignore un type inconnu", () => {
    expect(filterContents(rows, { type: "video" }).map((r) => r.id)).toEqual(["b"]);
    expect(filterContents(rows, { type: "quiz" })).toHaveLength(0);
    expect(filterContents(rows, { type: "inconnu" })).toHaveLength(4);
  });

  it("filtre par formation et par module", () => {
    expect(filterContents(rows, { course: "f2" }).map((r) => r.id)).toEqual(["c"]);
    expect(filterContents(rows, { module: "m1" }).map((r) => r.id)).toEqual(["b", "a", "d"]);
  });

  it("cherche dans le titre sans accents ni casse", () => {
    expect(filterContents(rows, { q: "ZEBRE" }).map((r) => r.id)).toEqual(["b"]);
    expect(filterContents(rows, { q: "  " })).toHaveLength(4);
  });

  it("trie par titre sur demande", () => {
    expect(filterContents(rows, { sort: "titre" }).map((r) => r.title)).toEqual(["Étude de cas", "Quiz intro", "Support PDF", "Zèbre intro"]);
  });
});

describe("compteurs et contenus liés", () => {
  it("compte chaque type, y compris à zéro", () => {
    expect(countByType(rows)).toEqual({ document: 0, video: 1, quiz: 0, case_study: 0, practice: 1, pdf: 1, presentation: 0, link: 0, text: 1 });
  });

  it("donne les autres contenus du même module, par position", () => {
    expect(relatedContents(rows, rows[0]).map((r) => r.id)).toEqual(["b", "d"]);
  });
});
