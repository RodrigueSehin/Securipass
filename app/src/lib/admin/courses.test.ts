import { describe, expect, it } from "vitest";
import { courseOrder, courseExportCells, formatHours, parseCourseFilters, publishedShare, sanitizeSearch, successRate } from "./courses";

describe("parseCourseFilters", () => {
  it("ne garde que les valeurs connues", () => {
    expect(parseCourseFilters({ q: "  incendie ", statut: "in_review", mode: "online", tri: "title", categorie: "7d1c2b3a-1111-4222-8333-444455556666" }))
      .toEqual({ q: "incendie", status: "in_review", mode: "online", sort: "title", category: "7d1c2b3a-1111-4222-8333-444455556666" });
    expect(parseCourseFilters({ statut: "banni", mode: "vr", tri: "zzz", categorie: "pas-un-uuid" }))
      .toEqual({ q: "", status: "", mode: "", sort: "recent", category: "" });
    expect(parseCourseFilters({ q: "x".repeat(300) }).q).toHaveLength(100);
  });
});

describe("sanitizeSearch", () => {
  it("neutralise les caractères de filtre", () => {
    expect(sanitizeSearch("SST, (test) 100%_*")).toBe("SST test 100");
  });
});

describe("courseOrder", () => {
  it("trie par date décroissante par défaut, avec un critère stable", () => {
    expect(courseOrder("recent")[0]).toEqual({ column: "created_at", ascending: false });
    expect(courseOrder("title")[0]).toEqual({ column: "title", ascending: true });
    expect(courseOrder("duration")[0]).toEqual({ column: "duration_minutes", ascending: false });
    expect(courseOrder("status").at(-1)).toEqual({ column: "id", ascending: true });
  });
});

describe("formatHours", () => {
  it("affiche la durée en heures", () => {
    expect(formatHours(2400)).toBe("40h");
    expect(formatHours(510)).toBe("8h30");
    expect(formatHours(45)).toBe("45 min");
    expect(formatHours(0)).toBe("—");
  });
});

describe("successRate et publishedShare", () => {
  it("calcule les taux sans division par zéro", () => {
    expect(successRate(87, 13)).toBe(87);
    expect(successRate(0, 0)).toBeNull();
    expect(publishedShare(98, 124)).toBe(79);
    expect(publishedShare(0, 0)).toBeNull();
  });
});

describe("courseExportCells", () => {
  it("produit les cellules dans l'ordre des colonnes", () => {
    const cells = courseExportCells({
      id: "c1", course_code: "SP-FOR-001", title: "SST", category: "Secourisme", instructor: "Awa", delivery_mode: "onsite",
      duration_minutes: 2400, price_amount: 35000, status: "published", created_at: "2026-01-12T00:00:00Z",
    }, () => "12/01/2026");
    expect(cells).toEqual(["SP-FOR-001", "SST", "Secourisme", "Awa", "Présentiel", "40h", 35000, "Publiée", "12/01/2026"]);
  });
});
