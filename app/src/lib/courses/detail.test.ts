import { describe, expect, it } from "vitest";
import { formatShortDuration, formatValidity, initials, moduleMeta, pluralize, programmeStats, summarize } from "./detail";
import type { PublicCourse } from "./types";

describe("summarize", () => {
  it("garde un texte court tel quel et ne prend que le premier paragraphe", () => {
    expect(summarize("Texte court.")).toBe("Texte court.");
    expect(summarize("Premier paragraphe.\n\nSecond paragraphe.")).toBe("Premier paragraphe.");
    expect(summarize(null)).toBe("");
  });
  it("coupe à la fin d'une phrase quand c'est possible", () => {
    const text = "Une phrase assez longue pour remplir la moitié du résumé attendu ici. Une autre phrase qui dépasse largement la limite fixée pour le test.";
    expect(summarize(text, 90)).toBe("Une phrase assez longue pour remplir la moitié du résumé attendu ici.");
  });
  it("sinon coupe à un mot avec des points de suspension", () => {
    const out = summarize("mot ".repeat(100), 50);
    expect(out.endsWith("…")).toBe(true);
    expect(out.length).toBeLessThanOrEqual(51);
  });
});

describe("programme", () => {
  const modules = [
    { id: "1", title: "A", description: null, contents: [{ title: "x", type: "text", duration_minutes: 30 }, { title: "y", type: "pdf", duration_minutes: 45 }] },
    { id: "2", title: "B", description: null, contents: [] },
  ] as unknown as PublicCourse["modules"];
  it("totalise modules, leçons et minutes", () => {
    expect(programmeStats(modules)).toEqual({ modules: 2, lessons: 2, minutes: 75 });
    expect(moduleMeta(modules[0].contents)).toEqual({ lessons: 2, minutes: 75 });
    expect(programmeStats([])).toEqual({ modules: 0, lessons: 0, minutes: 0 });
  });
});

describe("formats", () => {
  it("formatShortDuration", () => {
    expect([0, 20, 60, 90, 360].map(formatShortDuration)).toEqual(["", "20 min", "1 h", "1 h 30", "6 h"]);
  });
  it("formatValidity en années puis en mois", () => {
    expect(formatValidity(36)).toBe("3 ans");
    expect(formatValidity(12)).toBe("1 an");
    expect(formatValidity(18)).toBe("18 mois");
  });
  it("pluralize et initials", () => {
    expect(pluralize(1, "leçon", "leçons")).toBe("1 leçon");
    expect(pluralize(28, "leçon", "leçons")).toBe("28 leçons");
    expect(initials("Koffi Jean-Pierre Kouassi")).toBe("KJ");
    expect(initials("")).toBe("?");
  });
});
