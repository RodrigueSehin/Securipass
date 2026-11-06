import { describe, expect, it } from "vitest";
import { courseProgress, nextContentId, progressStatus, type ContentRow } from "./progress";

const contents: ContentRow[] = [
  { id: "a", course_id: "c1", duration_minutes: 20 },
  { id: "b", course_id: "c1", duration_minutes: 10 },
  { id: "c", course_id: "c1", duration_minutes: 30 },
  { id: "x", course_id: "c2", duration_minutes: 5 },
];

describe("progression d'une formation", () => {
  it("calcule le pourcentage et les minutes sur les seules leçons de la formation", () => {
    const p = courseProgress(contents, new Set(["a", "x"]), "c1");
    expect(p).toMatchObject({ total: 3, done: 1, percent: 33, totalMinutes: 60, doneMinutes: 20 });
  });
  it("une formation sans leçon publiée vaut 0 %", () => {
    expect(courseProgress(contents, new Set(), "vide")).toMatchObject({ total: 0, percent: 0 });
  });
});

describe("statut d'une formation", () => {
  it("non commencée, en cours, terminée", () => {
    expect(progressStatus({ total: 3, done: 0 })).toBe("not_started");
    expect(progressStatus({ total: 3, done: 2 })).toBe("in_progress");
    expect(progressStatus({ total: 3, done: 3 })).toBe("completed");
  });
  it("une formation sans contenu n'est jamais « terminée »", () => {
    expect(progressStatus({ total: 0, done: 0 })).toBe("not_started");
  });
});

describe("reprise", () => {
  const ordered = [
    { id: "l1", course_id: "c1", module_position: 1, position: 2 },
    { id: "l0", course_id: "c1", module_position: 1, position: 1 },
    { id: "m1", course_id: "c1", module_position: 2, position: 1 },
  ];
  it("reprend à la première leçon non terminée, dans l'ordre du programme", () => {
    expect(nextContentId(ordered, new Set(["l0"]), "c1")).toBe("l1");
    expect(nextContentId(ordered, new Set(["l0", "l1"]), "c1")).toBe("m1");
  });
  it("renvoie null quand tout est terminé", () => {
    expect(nextContentId(ordered, new Set(["l0", "l1", "m1"]), "c1")).toBeNull();
  });
});
