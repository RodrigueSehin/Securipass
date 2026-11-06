import { describe, expect, it } from "vitest";
import { assessmentCounts, assessmentStatus, filterRoster, parseAssessmentFilters, percentOf, questionResult, saveAssessmentSchema, type RosterRow } from "./assessments";

const id = "0b9f5d1e-1c2a-4f3b-8d4e-5a6b7c8d9e0f";

describe("assessmentStatus / assessmentCounts", () => {
  it("distingue évalué, en cours et non évalué", () => {
    expect(assessmentStatus(true, false)).toBe("evaluated");
    expect(assessmentStatus(false, true)).toBe("in_progress");
    expect(assessmentStatus(false, false)).toBe("not_evaluated");
    expect(assessmentCounts(["evaluated", "evaluated", "in_progress", "not_evaluated"])).toEqual({ total: 4, evaluated: 2, inProgress: 1, notEvaluated: 1 });
    expect(percentOf(8, 12)).toBe(67);
    expect(percentOf(0, 0)).toBe(0);
  });
});

describe("questionResult", () => {
  it("accorde les points seulement si l’ensemble coché est exactement l’attendu", () => {
    expect(questionResult(5, ["a", "c"], ["c", "a"])).toEqual({ earned: 5, right: true });
    expect(questionResult(5, ["a", "c"], ["a"])).toEqual({ earned: 0, right: false });
    expect(questionResult(2, ["b"], undefined)).toEqual({ earned: 0, right: false });
    expect(questionResult(2, [], [])).toEqual({ earned: 0, right: false });
  });
});

describe("parseAssessmentFilters / filterRoster", () => {
  it("normalise les paramètres de l’adresse", () => {
    expect(parseAssessmentFilters({ q: " fatou ", statut: "evaluated", page: "2", par: "16", onglet: "historique" })).toEqual({ q: "fatou", status: "evaluated", page: 2, size: 16, tab: "historique" });
    expect(parseAssessmentFilters({ statut: "x", page: "-1", par: "7", onglet: "x" })).toEqual({ q: "", status: "", page: 1, size: 8, tab: "evaluation" });
  });
  const row = (name: string, status: RosterRow["status"]): RosterRow => ({ learnerId: name, name, email: `${name.toLowerCase()}@mail.ci`, avatar: null, status, scorePercent: null, passed: null });
  it("filtre par nom, e-mail et statut", () => {
    const rows = [row("Fatou", "evaluated"), row("Serge", "in_progress"), row("Marie", "not_evaluated")];
    expect(filterRoster(rows, { q: "FAT", status: "" }).map((r) => r.name)).toEqual(["Fatou"]);
    expect(filterRoster(rows, { q: "@mail", status: "in_progress" }).map((r) => r.name)).toEqual(["Serge"]);
  });
});

describe("saveAssessmentSchema", () => {
  const base = { sessionId: id, learnerId: id, score: "18", result: "passed", comment: " Très bien " };
  it("accepte une note avec virgule et nettoie le commentaire", () => {
    expect(saveAssessmentSchema.parse({ ...base, score: "17,5" })).toMatchObject({ score: 17.5, comment: "Très bien" });
    expect(saveAssessmentSchema.parse({ ...base, comment: "" }).comment).toBeNull();
  });
  it("refuse une note absente ou invalide, un résultat inconnu et un commentaire trop long", () => {
    expect(saveAssessmentSchema.safeParse({ ...base, score: "" }).success).toBe(false);
    expect(saveAssessmentSchema.safeParse({ ...base, score: "abc" }).success).toBe(false);
    expect(saveAssessmentSchema.safeParse({ ...base, score: "-1" }).success).toBe(false);
    expect(saveAssessmentSchema.safeParse({ ...base, result: "maybe" }).success).toBe(false);
    expect(saveAssessmentSchema.safeParse({ ...base, comment: "x".repeat(501) }).success).toBe(false);
  });
});
