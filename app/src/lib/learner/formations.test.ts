import { describe, expect, it } from "vitest";
import { competencyLevel, competencyProgress, countByStatus, listStatus, matchesTab } from "./formations";

const now = Date.parse("2026-10-24T10:00:00Z");
const base = { enrollmentStatus: "confirmed", total: 10, done: 3, lastActivityAt: "2026-10-20T10:00:00Z", now };

describe("statut dans la liste", () => {
  it("en cours tant que l'activité est récente", () => {
    expect(listStatus(base)).toBe("in_progress");
    expect(listStatus({ ...base, done: 0, lastActivityAt: null })).toBe("in_progress");
  });
  it("terminée quand toutes les leçons sont faites ou que l'inscription est terminée", () => {
    expect(listStatus({ ...base, done: 10 })).toBe("completed");
    expect(listStatus({ ...base, enrollmentStatus: "completed", done: 0 })).toBe("completed");
  });
  it("en attente pour une liste d'attente ou un paiement en attente", () => {
    expect(listStatus({ ...base, enrollmentStatus: "waitlisted" })).toBe("waiting");
    expect(listStatus({ ...base, enrollmentStatus: "pending_payment" })).toBe("waiting");
    expect(listStatus({ ...base, enrollmentStatus: "pending_approval" })).toBe("waiting");
  });
  it("abandonnée après 30 jours sans leçon terminée, seulement si elle est commencée", () => {
    expect(listStatus({ ...base, lastActivityAt: "2026-09-20T10:00:00Z" })).toBe("abandoned");
    expect(listStatus({ ...base, lastActivityAt: "2026-09-25T10:00:00Z" })).toBe("in_progress");
    expect(listStatus({ ...base, done: 0, lastActivityAt: null })).toBe("in_progress");
  });
  it("annulée, expirée ou suspendue : absente de la liste", () => {
    for (const s of ["cancelled", "expired", "suspended"]) expect(listStatus({ ...base, enrollmentStatus: s })).toBeNull();
  });
});

describe("onglets", () => {
  it("compte chaque statut et filtre", () => {
    const statuses = ["in_progress", "in_progress", "completed", "waiting", "abandoned"] as const;
    expect(countByStatus([...statuses])).toEqual({ toutes: 5, en_cours: 2, terminees: 1, en_attente: 1, abandonnees: 1 });
    expect(matchesTab("completed", "toutes")).toBe(true);
    expect(matchesTab("completed", "terminees")).toBe(true);
    expect(matchesTab("completed", "en_cours")).toBe(false);
  });
});

describe("compétences", () => {
  it("déduit le niveau de la progression", () => {
    expect([10, 49, 50, 84, 85, 100].map(competencyLevel)).toEqual(["Débutant", "Débutant", "Intermédiaire", "Intermédiaire", "Avancé", "Avancé"]);
  });
  it("moyenne la progression des formations qui couvrent la compétence, triée et limitée", () => {
    const r = competencyProgress([
      { competencies: ["Secourisme", "Prévention"], percent: 60 },
      { competencies: ["Secourisme", " "], percent: 20 },
      { competencies: ["Cadre légal"], percent: 90 },
    ], 2);
    expect(r).toEqual([
      { name: "Cadre légal", percent: 90, level: "Avancé" },
      { name: "Prévention", percent: 60, level: "Intermédiaire" },
    ]);
  });
});
