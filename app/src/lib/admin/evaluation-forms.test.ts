import { describe, expect, it } from "vitest";
import { createEvaluationSchema, questionProgress, questionSchema } from "./evaluations";

const id = "0b9f5d1e-1c2a-4f3b-8d4e-5a6b7c8d9e0f";

describe("createEvaluationSchema", () => {
  const base = {
    title: "Évaluation finale – SST", courseId: id, kind: "quiz", sessionId: id, plannedQuestions: "40", duration: "60", passingScore: "70", attempts: "1",
    startDate: "2026-11-24", startTime: "09:00", endDate: "2026-11-24", endTime: "10:00", timezone: "Africa/Abidjan", gradingMode: "points100", status: "draft", files: [],
  };
  it("accepte un QCM complet et convertit les dates en UTC", () => {
    const r = createEvaluationSchema.parse(base);
    expect([r.plannedQuestions, r.duration, r.passingScore, r.shuffleQuestions]).toEqual([40, 60, 70, false]);
    expect(r.availableAt).toBe("2026-11-24T09:00:00.000Z");
    expect(r.intent).toBe("save");
  });
  it("exige le nombre de questions pour un QCM seulement", () => {
    expect(createEvaluationSchema.safeParse({ ...base, plannedQuestions: "" }).success).toBe(false);
    expect(createEvaluationSchema.parse({ ...base, kind: "practical", plannedQuestions: "" }).plannedQuestions).toBeNull();
  });
  it("refuse une fin avant le début et une note hors bornes", () => {
    expect(createEvaluationSchema.safeParse({ ...base, endTime: "08:00" }).success).toBe(false);
    expect(createEvaluationSchema.safeParse({ ...base, passingScore: "120" }).success).toBe(false);
  });
});

describe("questionSchema", () => {
  const base = { evaluationId: id, prompt: "Quel est l’objectif des EPI ?", type: "single", points: "5", options: ["A", "B", "C", "D"], correct: ["1"] };
  it("construit les options et la clé de réponse", () => {
    const r = questionSchema.parse(base);
    expect(r.kind).toBe("single");
    expect(r.options.map((o) => o.id)).toEqual(["a", "b", "c", "d"]);
    expect(r.correctIds).toEqual(["b"]);
  });
  it("contrôle le nombre de bonnes réponses selon le type", () => {
    expect(questionSchema.safeParse({ ...base, correct: [] }).success).toBe(false);
    expect(questionSchema.safeParse({ ...base, correct: ["0", "1"] }).success).toBe(false);
    expect(questionSchema.safeParse({ ...base, type: "multiple", correct: ["0", "1"] }).success).toBe(true);
    expect(questionSchema.safeParse({ ...base, type: "multiple", correct: ["0", "1", "2", "3"] }).success).toBe(false);
  });
  it("refuse des options vides ou en double", () => {
    expect(questionSchema.safeParse({ ...base, options: ["A", "", "C", "D"] }).success).toBe(false);
    expect(questionSchema.safeParse({ ...base, options: ["A", "a", "C", "D"] }).success).toBe(false);
  });
  it("génère Vrai / Faux", () => {
    const r = questionSchema.parse({ ...base, type: "true_false", options: [], correct: ["1"] });
    expect(r.options.map((o) => o.label)).toEqual(["Vrai", "Faux"]);
    expect([r.kind, r.correctIds]).toEqual(["single", ["b"]]);
  });
});

describe("questionProgress", () => {
  it("calcule l’avancement par rapport aux questions prévues", () => {
    expect(questionProgress(3, 40, 15)).toMatchObject({ pct: 7.5, pointsPct: 15 });
    expect(questionProgress(3, null, 150)).toMatchObject({ pct: 0, pointsPct: 100 });
  });
});
