import { describe, expect, it } from "vitest";
import { REPORT_TYPES, REPORT_TYPE_KEYS, courseShares, isReportType, lastMonths, overviewRows, parseMonth, reportFile, reportName, type ReportsOverview } from "./reports";

const now = new Date("2026-10-22T14:35:00Z");

describe("parseMonth et lastMonths", () => {
  it("garde un mois valide passé ou courant, sinon le mois en cours", () => {
    expect(parseMonth("2026-05", now)).toBe("2026-05");
    expect(parseMonth("2026-10", now)).toBe("2026-10");
    expect(parseMonth("2027-01", now)).toBe("2026-10");
    expect(parseMonth("2026-13", now)).toBe("2026-10");
    expect(parseMonth(null, now)).toBe("2026-10");
  });
  it("liste les 12 derniers mois du plus récent au plus ancien", () => {
    const m = lastMonths(now);
    expect(m).toHaveLength(12);
    expect(m[0]).toBe("2026-10");
    expect(m[3]).toBe("2026-07");
    expect(m[11]).toBe("2025-11");
  });
});

describe("types de rapports", () => {
  it("décrit 9 rapports, chacun avec ses en-têtes", () => {
    expect(REPORT_TYPE_KEYS).toHaveLength(9);
    for (const k of REPORT_TYPE_KEYS) expect(REPORT_TYPES[k].headers.length).toBeGreaterThan(3);
    expect(isReportType("financier")).toBe(true);
    expect(isReportType("constructor")).toBe(false);
    expect(isReportType(null)).toBe(false);
  });
  it("nomme les rapports et les fichiers", () => {
    expect(reportName("inscriptions", "2026-10")).toBe("Rapport des inscriptions – Oct. 2026");
    expect(reportName("activite", "2026-10")).toBe("Rapport d’activité – Oct. 2026");
    expect(reportFile("sessions", "2026-10")).toBe("rapport-sessions-2026-10.csv");
  });
});

describe("courseShares", () => {
  it("garde 4 formations et regroupe le reste", () => {
    const items = courseShares([{ title: "A", count: 40 }, { title: "B", count: 30 }, { title: "C", count: 10 }, { title: "D", count: 10 }, { title: "E", count: 5 }], 100);
    expect(items.map((i) => [i.label, i.percent])).toEqual([["A", 40], ["B", 30], ["C", 10], ["D", 10], ["Autres formations", 10]]);
    expect(courseShares([], 0)).toEqual([]);
    expect(courseShares([{ title: "A", count: 3 }], 3)).toEqual([{ label: "A", count: 3, percent: 100 }]);
  });
});

describe("overviewRows", () => {
  it("résume les indicateurs avec « — » quand un taux est inconnu", () => {
    const o: ReportsOverview = {
      month: "2026-10", enrollments: { value: 5, prev: 4 }, active_learners: { value: 3, prev: 2 }, sessions: { value: 1, prev: 0 }, certifications: { value: 0, prev: 0 },
      commissions: { value: 15000, prev: 0, rate: 15 }, revenue: 100000, evaluations: { results: 0, passed: 0 }, by_course: [], completion_rate: 25, evaluation_success_rate: null, attendance_rate: 50, months: [], courses: [{ id: "x", title: "SST", count: 2 }],
    };
    const r = Object.fromEntries(overviewRows(o));
    expect(r["Période"]).toBe("Octobre 2026");
    expect(r["Taux de réussite aux évaluations"]).toBe("—");
    expect(r["Taux de complétion des formations"]).toBe("25 %");
    expect(r["Top 1 : SST (inscriptions)"]).toBe(2);
  });
});
