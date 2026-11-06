import { describe, expect, it } from "vitest";
import { evaluationState, evaluationStats, type EvalAttempt } from "./evaluations";

const NOW = Date.parse("2026-10-21T10:00:00Z");
const sched = { available_at: null, due_at: null, max_attempts: 2 };
const sub = (score: number, passed: boolean): EvalAttempt => ({
  evaluation_id: "e", submitted_at: "2026-10-20T09:00:00Z", deadline_at: null, score_percent: score, passed,
});
const open = (deadline: string | null): EvalAttempt => ({
  evaluation_id: "e", submitted_at: null, deadline_at: deadline, score_percent: null, passed: null,
});

describe("état d'une évaluation", () => {
  it("à venir : ouverture dans le futur, aucune tentative", () => {
    const s = evaluationState({ ...sched, available_at: "2026-10-30T09:00:00Z" }, [], NOW);
    expect(s.category).toBe("upcoming");
    expect(s.openNow).toBe(false);
  });
  it("disponible et non commencée : à venir, ouverte maintenant", () => {
    const s = evaluationState(sched, [], NOW);
    expect(s.category).toBe("upcoming");
    expect(s.openNow).toBe(true);
  });
  it("en cours : tentative ouverte et non échue", () => {
    const s = evaluationState(sched, [open("2026-10-21T11:00:00Z")], NOW);
    expect(s.category).toBe("in_progress");
    expect(s.inProgress).toBe(true);
  });
  it("une tentative dont le délai est dépassé n'est plus « en cours »", () => {
    const s = evaluationState(sched, [open("2026-10-21T09:00:00Z")], NOW);
    expect(s.category).toBe("upcoming");
  });
  it("terminée dès qu'une tentative est réussie", () => {
    const s = evaluationState(sched, [sub(40, false), sub(80, true)], NOW);
    expect(s.category).toBe("finished");
    expect(s.passed).toBe(true);
    expect(s.bestScore).toBe(80);
  });
  it("terminée quand toutes les tentatives sont utilisées sans réussite", () => {
    const s = evaluationState(sched, [sub(40, false), sub(50, false)], NOW);
    expect(s.category).toBe("finished");
    expect(s.passed).toBe(false);
  });
  it("une évaluation échue après une tentative est terminée", () => {
    const s = evaluationState({ ...sched, due_at: "2026-10-21T09:00:00Z" }, [sub(30, false)], NOW);
    expect(s.category).toBe("finished");
  });
  it("une évaluation échue sans tentative n'est pas « à venir » ni ouverte", () => {
    const s = evaluationState({ ...sched, due_at: "2026-10-21T09:00:00Z" }, [], NOW);
    expect(s.openNow).toBe(false);
  });
});

describe("statistiques", () => {
  it("réussite calculée sur les évaluations terminées par une note", () => {
    const items = [
      { state: evaluationState(sched, [sub(80, true)], NOW) },
      { state: evaluationState(sched, [sub(40, false), sub(50, false)], NOW) },
      { state: evaluationState(sched, [open("2026-10-21T11:00:00Z")], NOW) },
      { state: evaluationState({ ...sched, available_at: "2026-11-01T00:00:00Z" }, [], NOW) },
    ];
    expect(evaluationStats(items)).toEqual({ passed: 1, failed: 1, inProgress: 1, upcoming: 1, successRate: 50 });
  });
  it("aucune note : taux nul", () => {
    expect(evaluationStats([]).successRate).toBeNull();
  });
});
