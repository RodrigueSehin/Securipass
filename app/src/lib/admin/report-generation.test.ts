import { describe, expect, it } from "vitest";
import {
  DEFAULT_INDICATORS, breakdownTotals, fileSlug, hasCourseBreakdown, indicatorTiles, paramsFromRun, parseReportParams, periodLabel, storedParams,
} from "./report-generation";
import type { ReportsOverview } from "./reports";

const now = new Date("2026-10-22T14:35:00Z");
const id = "7d1c2b3a-1111-4222-8333-444455556666";
const q = (s: string) => new URLSearchParams(s);

const overview: ReportsOverview = {
  month: "2026-10", enrollments: { value: 1248, prev: 1095 }, active_learners: { value: 982, prev: 877 }, sessions: { value: 48, prev: 40 }, certifications: { value: 936, prev: 793 },
  commissions: { value: 1_872_000, prev: 0, rate: 15 }, revenue: 12_480_000, evaluations: { results: 50, passed: 46 }, completion_rate: 87, evaluation_success_rate: 92, attendance_rate: null,
  months: [], courses: [], by_course: [],
};

describe("parseReportParams", () => {
  it("lit les paramètres du formulaire et ignore le reste", () => {
    const p = parseReportParams(q(`f=1&type=financier&mois=2026-09&formation=${id}&session=nope&formateur=${id}&statut=completed&ind=ca&ind=analyse&ind=zzz&format=xlsx&nom=Mon%20rapport&description=Texte`), now);
    expect(p).toMatchObject({ type: "financier", month: "2026-09", format: "xlsx", name: "Mon rapport", description: "Texte", indicators: ["ca", "analyse"] });
    expect(p.filters).toEqual({ course: id, session: "", instructor: id, status: "completed" });
  });
  it("applique les valeurs par défaut sans formulaire", () => {
    const p = parseReportParams(q(""), now);
    expect(p).toMatchObject({ type: "inscriptions", month: "2026-10", format: "pdf", indicators: DEFAULT_INDICATORS, name: "Rapport des inscriptions – Oct. 2026" });
    expect(p.filters).toEqual({ course: "", session: "", instructor: "", status: "" });
  });
  it("garde zéro indicateur quand le formulaire est envoyé sans case cochée", () => {
    expect(parseReportParams(q("f=1"), now).indicators).toEqual([]);
  });
  it("refuse un type, un format, un statut ou un mois invalides et borne les textes", () => {
    const p = parseReportParams(q(`type=secret&format=exe&statut=banni&mois=2099-01&nom=ab&description=${"x".repeat(400)}`), now);
    expect(p).toMatchObject({ type: "inscriptions", format: "pdf", month: "2026-10", name: "Rapport des inscriptions – Oct. 2026" });
    expect(p.filters.status).toBe("");
    expect(p.description).toHaveLength(250);
    expect(parseReportParams(q(`nom=${"n".repeat(500)}`), now).name).toHaveLength(200);
  });
});

describe("paramsFromRun", () => {
  it("relit les paramètres enregistrés et écarte ce qui est invalide", () => {
    const base = { type: "sessions", period: "2026-10", name: "Rapport", format: "pdf", description: null };
    const p = paramsFromRun({ ...base, params: { filters: { course: id, session: "x", status: "confirmed" }, indicators: ["ca", "inconnu"] } })!;
    expect(p.filters).toEqual({ course: id, session: "", instructor: "", status: "confirmed" });
    expect(p.indicators).toEqual(["ca"]);
    expect(paramsFromRun({ ...base, params: null })!.indicators).toEqual(DEFAULT_INDICATORS);
    expect(paramsFromRun({ ...base, type: "x", params: {} })).toBeNull();
    expect(paramsFromRun({ ...base, format: "doc", params: {} })).toBeNull();
  });
  it("relit ce que storedParams enregistre", () => {
    const p = parseReportParams(q(`f=1&type=presences&formation=${id}&ind=presence`), now);
    const back = paramsFromRun({ type: p.type, period: p.month, name: p.name, format: p.format, description: p.description, params: JSON.parse(JSON.stringify(storedParams(p))) })!;
    expect(back).toEqual(p);
  });
});

describe("periodLabel", () => {
  it("donne les bornes du mois", () => {
    expect(periodLabel("2026-10")).toBe("01 oct. 2026 – 31 oct. 2026");
    expect(periodLabel("2028-02")).toBe("01 févr. 2028 – 29 févr. 2028");
  });
});

describe("indicatorTiles", () => {
  it("ne produit que les indicateurs cochés, dans l'ordre demandé, avec évolution et « — » si inconnu", () => {
    const t = indicatorTiles(overview, ["presence", "inscriptions", "analyse", "evaluations", "ca"]);
    expect(t.map((x) => x.key)).toEqual(["presence", "inscriptions", "evaluations", "ca"]);
    expect(t[0]).toMatchObject({ value: "—", trend: null });
    expect(t[1]).toMatchObject({ value: "1 248", trend: "↑ 14%" });
    expect(t[2].value).toBe("46 / 50");
    expect(t[3].value).toContain("12 480 000");
    expect(indicatorTiles(overview, [])).toEqual([]);
  });
});

describe("breakdownTotals", () => {
  it("additionne et pondère les taux par les inscriptions", () => {
    const t = breakdownTotals([
      { id: "a", title: "A", count: 300, sessions: 12, completion: 90, success: 80 },
      { id: "b", title: "B", count: 100, sessions: 8, completion: 70, success: null },
    ]);
    expect(t).toEqual({ sessions: 20, count: 400, completion: 85, success: 80 });
    expect(breakdownTotals([])).toEqual({ sessions: 0, count: 0, completion: null, success: null });
  });
  it("ajoute le détail par formation aux rapports d'inscriptions et de formations seulement", () => {
    expect(hasCourseBreakdown("inscriptions")).toBe(true);
    expect(hasCourseBreakdown("formations")).toBe(true);
    expect(hasCourseBreakdown("financier")).toBe(false);
  });
});

describe("fileSlug", () => {
  it("retire accents et caractères spéciaux", () => {
    expect(fileSlug("Rapport des inscriptions – Oct. 2026")).toBe("rapport-des-inscriptions-oct-2026");
    expect(fileSlug("../../etc/passwd")).toBe("etc-passwd");
    expect(fileSlug("???", "rapport-x")).toBe("rapport-x");
  });
});
