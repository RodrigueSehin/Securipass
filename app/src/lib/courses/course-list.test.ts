import { describe, expect, it } from "vitest";
import { countByTab, filterCourseRows, paginate, PAGE_SIZE, type CourseListRow } from "./course-list";

const row = (id: string, title: string, status: CourseListRow["status"]): CourseListRow => ({
  id, title, slug: id, status, cover: null, category: null, level: "beginner", mode: "online", durationMinutes: 60,
  priceAmount: 0, createdAt: "2026-01-01T00:00:00Z", updatedAt: "2026-01-01T00:00:00Z", learners: 0, percent: 0,
  modules: 0, lessons: 0, quizzes: 0, success: null,
});

const rows = [
  row("1", "Agent de sécurité privée", "published"),
  row("2", "Sécurité incendie", "published"),
  row("3", "Gestion des conflits", "draft"),
  row("4", "Vidéosurveillance", "in_review"),
  row("5", "Ancienne formation", "archived"),
];

describe("onglets et recherche", () => {
  it("filtre par statut, « toutes » ne filtre pas", () => {
    expect(filterCourseRows(rows, "all", "").map((r) => r.id)).toHaveLength(5);
    expect(filterCourseRows(rows, "published", "").map((r) => r.id)).toEqual(["1", "2"]);
  });

  it("cherche dans le titre sans tenir compte des accents ni de la casse", () => {
    expect(filterCourseRows(rows, "all", "SECURITE").map((r) => r.id)).toEqual(["1", "2"]);
    expect(filterCourseRows(rows, "draft", "securite")).toEqual([]);
  });

  it("compte chaque onglet sur la liste complète", () => {
    expect(countByTab(rows)).toEqual({ all: 5, published: 2, draft: 1, in_review: 1, archived: 1 });
  });
});

describe("pagination", () => {
  const many = Array.from({ length: 23 }, (_, i) => i);

  it("découpe par pages de dix", () => {
    const p = paginate(many, 2);
    expect(p.items).toHaveLength(PAGE_SIZE);
    expect(p).toMatchObject({ page: 2, pages: 3, from: 11, to: 20, total: 23 });
  });

  it("borne la page demandée", () => {
    expect(paginate(many, 99)).toMatchObject({ page: 3, from: 21, to: 23 });
    expect(paginate(many, -4).page).toBe(1);
    expect(paginate(many, Number.NaN).page).toBe(1);
  });

  it("gère une liste vide", () => {
    expect(paginate([], 1)).toMatchObject({ page: 1, pages: 1, from: 0, to: 0, total: 0, items: [] });
  });
});
