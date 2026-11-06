import { describe, expect, it } from "vitest";
import { bucketEnrollments, completionRate, coursePercent, monthlyCounts, relativeTime, successRate, type EnrollmentRow } from "./dashboard";

const e = (id: string, status: string): EnrollmentRow => ({ id, course_id: "c", learner_id: id, status, enrolled_at: "2026-10-01T00:00:00Z" });

describe("répartition des apprenants", () => {
  it("classe chaque inscription une seule fois, le certificat l'emportant", () => {
    const list = [e("1", "confirmed"), e("2", "confirmed"), e("3", "completed"), e("4", "waitlisted"), e("5", "confirmed"), e("6", "cancelled")];
    expect(bucketEnrollments(list, new Set(["3"]), new Set(["5"]))).toEqual({ formation: 2, attente: 1, certifies: 1, difficulte: 1 });
  });
});

describe("taux", () => {
  it("complétion sans les annulées", () => {
    expect(completionRate([e("1", "completed"), e("2", "confirmed"), e("3", "cancelled")])).toBe(50);
    expect(completionRate([e("3", "cancelled")])).toBeNull();
  });
  it("réussite sur les tentatives envoyées seulement", () => {
    expect(successRate([
      { submitted_at: "x", passed: true }, { submitted_at: "x", passed: false }, { submitted_at: null, passed: null },
    ])).toBe(50);
    expect(successRate([{ submitted_at: null, passed: null }])).toBeNull();
  });
  it("progression de formation bornée à 100", () => {
    expect(coursePercent(10, 2, 5)).toBe(25);
    expect(coursePercent(0, 2, 0)).toBe(0);
    expect(coursePercent(1, 1, 9)).toBe(100);
  });
});

describe("évolution mensuelle", () => {
  it("compte par mois, mois courant inclus", () => {
    const r = monthlyCounts(["2026-10-03T10:00:00Z", "2026-10-20T10:00:00Z", "2026-08-02T10:00:00Z", "2025-01-01T00:00:00Z"],
      3, Date.parse("2026-10-22T10:00:00Z"));
    expect(r.map((x) => x.count)).toEqual([1, 0, 2]);
  });
});

describe("délai relatif", () => {
  const now = Date.parse("2026-10-22T12:00:00Z");
  it("formate les délais courts", () => {
    expect(relativeTime("2026-10-22T11:59:40Z", now)).toBe("À l’instant");
    expect(relativeTime("2026-10-22T11:20:00Z", now)).toBe("Il y a 40 min");
    expect(relativeTime("2026-10-22T11:00:00Z", now)).toBe("Il y a 1 heure");
    expect(relativeTime("2026-10-22T09:00:00Z", now)).toBe("Il y a 3 heures");
    expect(relativeTime("2026-10-21T10:00:00Z", now)).toBe("Hier");
    expect(relativeTime("2026-10-18T12:00:00Z", now)).toBe("Il y a 4 jours");
  });
});
