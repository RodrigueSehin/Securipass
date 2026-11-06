import { describe, expect, it } from "vitest";
import { computeKpis, csvLine, displayStatus, distribution, filterSessions, monthGrid, shiftMonth } from "./dashboard";

const NOW = Date.parse("2026-10-12T10:00:00Z");
const s = (status: "draft" | "scheduled" | "cancelled" | "completed", start: string, end: string, extra = {}) =>
  ({ status, start_at: start, end_at: end, title: "Session", reference: "SEC-2026-001", course_id: "c1", course: { title: "Sécurité incendie" }, ...extra });

describe("displayStatus", () => {
  it("déduit en cours, planifiée et terminée des dates", () => {
    expect(displayStatus(s("scheduled", "2026-10-12T09:00:00Z", "2026-10-12T12:00:00Z"), NOW)).toBe("in_progress");
    expect(displayStatus(s("scheduled", "2026-11-05T14:00:00Z", "2026-11-05T17:00:00Z"), NOW)).toBe("planned");
    expect(displayStatus(s("scheduled", "2026-09-28T09:00:00Z", "2026-09-28T12:00:00Z"), NOW)).toBe("completed");
    expect(displayStatus(s("completed", "2026-12-01T09:00:00Z", "2026-12-01T12:00:00Z"), NOW)).toBe("completed");
  });
  it("garde brouillon et annulée tels quels", () => {
    expect(displayStatus(s("draft", "2026-11-05T14:00:00Z", "2026-11-05T17:00:00Z"), NOW)).toBe("draft");
    expect(displayStatus(s("cancelled", "2026-09-28T09:00:00Z", "2026-09-28T12:00:00Z"), NOW)).toBe("cancelled");
  });
});

describe("filterSessions", () => {
  const rows = [
    s("scheduled", "2026-10-12T09:00:00Z", "2026-10-12T12:00:00Z", { title: "Octobre", course_id: "c1" }),
    s("scheduled", "2026-11-05T14:00:00Z", "2026-11-05T17:00:00Z", { title: "Novembre", course_id: "c2", reference: "SEC-2026-002", course: { title: "Premiers secours" } }),
    s("cancelled", "2026-08-25T09:00:00Z", "2026-08-25T12:00:00Z", { title: "Août", course_id: "c2", course: { title: "Premiers secours" } }),
  ];
  it("filtre par statut affiché, formation et dates", () => {
    expect(filterSessions(rows, { status: "planned" }, NOW).map((r) => r.title)).toEqual(["Novembre"]);
    expect(filterSessions(rows, { course: "c2" }, NOW)).toHaveLength(2);
    expect(filterSessions(rows, { date: "passees" }, NOW).map((r) => r.title)).toEqual(["Août"]);
    expect(filterSessions(rows, { date: "mois" }, NOW).map((r) => r.title)).toEqual(["Octobre"]);
  });
  it("cherche sans tenir compte des accents ni de la casse, y compris dans la référence", () => {
    expect(filterSessions(rows, { q: "securite" }, NOW)).toHaveLength(1);
    expect(filterSessions(rows, { q: "sec-2026-002" }, NOW)).toHaveLength(1);
  });
});

describe("indicateurs", () => {
  it("compare le mois courant au mois précédent", () => {
    const rows = [
      s("scheduled", "2026-11-05T14:00:00Z", "2026-11-05T17:00:00Z"),
      s("scheduled", "2026-10-20T14:00:00Z", "2026-10-20T17:00:00Z"),
      s("scheduled", "2026-10-25T14:00:00Z", "2026-10-25T17:00:00Z"),
      s("scheduled", "2026-09-30T14:00:00Z", "2026-09-30T17:00:00Z"),
    ];
    const planned = computeKpis(rows, NOW).find((k) => k.key === "planned")!;
    expect(planned.value).toBe(3);
    expect(planned.trend).toEqual({ text: "+2", up: true }); // 2 planifiées en octobre, aucune en septembre (terminée)
  });
  it("répartit par statut en pourcentage", () => {
    const rows = [
      s("scheduled", "2026-11-05T14:00:00Z", "2026-11-05T17:00:00Z"),
      s("cancelled", "2026-08-25T09:00:00Z", "2026-08-25T12:00:00Z"),
    ];
    const d = distribution(rows, NOW);
    expect(d.find((x) => x.key === "planned")).toMatchObject({ count: 1, percent: 50 });
    expect(d.some((x) => x.key === "draft")).toBe(false);
  });
});

describe("calendrier", () => {
  it("commence le lundi et marque aujourd'hui et les jours avec session", () => {
    const grid = monthGrid("2026-10", [s("scheduled", "2026-10-20T09:00:00Z", "2026-10-20T12:00:00Z")], NOW);
    expect(grid.length % 7).toBe(0);
    expect(grid[0].date).toBe("2026-09-28");
    expect(grid.find((d) => d.today)?.date).toBe("2026-10-12");
    expect(grid.find((d) => d.date === "2026-10-20")?.statuses).toEqual(["planned"]);
  });
  it("décale les mois", () => {
    expect(shiftMonth("2026-12", 1)).toBe("2027-01");
    expect(shiftMonth("2026-01", -1)).toBe("2025-12");
  });
});

describe("csvLine", () => {
  it("double les guillemets et neutralise les formules", () => {
    expect(csvLine(['a"b', "=1+1", 3])).toBe('"a""b";"\'=1+1";"3"');
  });
});
