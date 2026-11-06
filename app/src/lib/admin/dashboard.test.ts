import { describe, expect, it } from "vitest";
import { buildAlerts, mergeActivity, monthLabels, niceScale, percentChange, roleShares, sparkPoints } from "./dashboard";

describe("percentChange", () => {
  it("calcule la hausse et la baisse, et ignore l'absence de base", () => {
    expect(percentChange(12, 10)).toEqual({ text: "+20%", up: true });
    expect(percentChange(8, 10)).toEqual({ text: "−20%", up: false });
    expect(percentChange(5, 0)).toBeNull();
    expect(percentChange(10, 10)).toBeNull();
  });
});

describe("monthLabels", () => {
  it("finit par le mois courant et boucle sur l'année", () => {
    const l = monthLabels(Date.parse("2026-05-12T10:00:00Z"));
    expect(l).toHaveLength(12);
    expect(l[11]).toBe("Mai");
    expect(l[0]).toBe("Juin");
    expect(monthLabels(Date.parse("2026-01-03T10:00:00Z"))[11]).toBe("Jan");
  });
});

describe("tracés", () => {
  it("place la plus grande valeur en haut et gère les séries plates", () => {
    const pts = sparkPoints([0, 5, 10], 100, 30);
    expect(pts[0][0]).toBe(0);
    expect(pts[2][0]).toBe(100);
    expect(pts[2][1]).toBeLessThan(pts[0][1]);
    expect(sparkPoints([4, 4, 4], 100, 30).every(([, y]) => y === 15)).toBe(true);
    expect(sparkPoints([], 100, 30)).toEqual([]);
  });

  it("choisit une échelle ronde", () => {
    expect(niceScale(350)).toEqual({ step: 100, top: 400 });
    expect(niceScale(0)).toEqual({ step: 1, top: 1 });
    expect(niceScale(7)).toEqual({ step: 2, top: 8 });
  });
});

describe("répartition et activité", () => {
  it("calcule les parts par profil", () => {
    const s = roleShares({ learner: 67, instructor: 14, company: 9, admin: 5, other: 5 });
    expect(s.map((x) => x.percent)).toEqual([67, 14, 9, 5, 5]);
    expect(roleShares({}).every((x) => x.percent === 0)).toBe(true);
  });

  it("trie l'activité du plus récent au plus ancien et borne la liste", () => {
    const a = (id: string, at: string) => ({ id, name: id, role: "Apprenant", avatar: null, kind: "Inscription" as const, detail: "", at });
    const out = mergeActivity([[a("a", "2026-05-12T09:00:00Z")], [a("b", "2026-05-12T10:00:00Z"), a("c", "2026-05-11T10:00:00Z")]], 2);
    expect(out.map((x) => x.id)).toEqual(["b", "a"]);
  });

  it("ne retient que les points d'attention concernés, avec les bons accords", () => {
    const base = { inReview: 0, inReviewAt: null, pendingPayment: 0, pendingPaymentAt: null, supportNew: 0, supportNewAt: null, expiring: 0, expiringAt: null, newUsers: 0, newUsersAt: null };
    expect(buildAlerts(base)).toEqual([]);
    const a = buildAlerts({ ...base, inReview: 1, supportNew: 5, expiring: 12 });
    expect(a.map((x) => x.key)).toEqual(["review", "support", "certs"]);
    expect(a[0].text).toContain("1 nouvelle formation soumise");
    expect(a[1].text).toContain("5 nouvelles demandes");
    expect(a[2].text).toContain("12 certificats expirent");
  });
});
