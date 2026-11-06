import { describe, expect, it } from "vitest";
import { buildStatItems } from "./stats-items";

describe("buildStatItems", () => {
  it("masque tout le bandeau quand il n'y a pas de données", () => {
    expect(buildStatItems({ courses: 0, learners: 0, companies: 0 })).toEqual([]);
  });
  it("masque le bandeau s'il reste moins de deux indicateurs", () => {
    expect(buildStatItems({ courses: 3, learners: 0, companies: 0 })).toEqual([]);
  });
  it("n'affiche que les indicateurs non nuls", () => {
    const items = buildStatItems({ courses: 12, learners: 340, companies: 0 });
    expect(items.map((i) => i.key)).toEqual(["learners", "courses"]);
    expect(items[0]).toMatchObject({ value: 340, label: "Apprenants inscrits" });
  });
  it("accorde les libellés au singulier", () => {
    const items = buildStatItems({ courses: 1, learners: 1, companies: 1 });
    expect(items.map((i) => i.label)).toEqual(["Apprenant inscrit", "Formation disponible", "Entreprise cliente"]);
  });
});
