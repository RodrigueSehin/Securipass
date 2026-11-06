import { describe, expect, it } from "vitest";
import { evaluationDate, formatPercent, parseEvaluationFilters } from "./evaluations";

describe("parseEvaluationFilters", () => {
  it("ne garde que les valeurs connues", () => {
    const id = "0b9f5d1e-1c2a-4f3b-8d4e-5a6b7c8d9e0f";
    expect(parseEvaluationFilters({ q: " sst ", formation: id, session: id, statut: "in_progress", du: "2026-10-01", au: "2026-10-31", tri: "asc" }))
      .toEqual({ q: "sst", course: id, session: id, status: "in_progress", from: "2026-10-01", to: "2026-10-31", asc: true });
    expect(parseEvaluationFilters({ formation: "x", session: "y", statut: "archived", du: "demain" }))
      .toEqual({ q: "", course: "", session: "", status: "", from: "", to: "", asc: false });
  });
  it("remet une période inversée dans l'ordre", () => {
    const f = parseEvaluationFilters({ du: "2026-11-01", au: "2026-10-01" });
    expect([f.from, f.to]).toEqual(["2026-10-01", "2026-11-01"]);
  });
});

describe("formatPercent", () => {
  it("arrondit à une décimale avec la virgule française", () => {
    expect(formatPercent(22, 24).replace(/ | /g, " ")).toBe("91,7 %");
    expect(formatPercent(0, 0)).toBe("—");
  });
});

describe("evaluationDate", () => {
  it("prend l'ouverture, sinon l'échéance", () => {
    expect(evaluationDate({ available_at: "a", due_at: "b" })).toBe("a");
    expect(evaluationDate({ available_at: null, due_at: "b" })).toBe("b");
    expect(evaluationDate({ available_at: null, due_at: null })).toBeNull();
  });
});
