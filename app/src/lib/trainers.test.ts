import { describe, expect, it } from "vitest";
import type { Trainer } from "@/content/trainers";
import { domainCounts, initials, queryTrainers, trainersHref } from "./trainers";

const T: Trainer[] = [
  { slug: "a", name: "Awa Koné", role: "Formatrice en secourisme", bio: "Infirmière.", domain: "secourisme", tags: ["Premiers secours"] },
  { slug: "b", name: "Yao Éric", role: "Formateur incendie", bio: "Pompier.", domain: "incendie", tags: ["Extincteurs"] },
];

describe("trainers", () => {
  it("filtre par domaine et ignore un domaine inconnu", () => {
    expect(queryTrainers(T, { domain: "incendie" }).map((t) => t.slug)).toEqual(["b"]);
    expect(queryTrainers(T, { domain: "inconnu" })).toHaveLength(2);
  });
  it("recherche sans accents ni casse, y compris dans les tags", () => {
    expect(queryTrainers(T, { q: "ERIC" }).map((t) => t.slug)).toEqual(["b"]);
    expect(queryTrainers(T, { q: "extincteurs" })).toHaveLength(1);
    expect(queryTrainers(T, { q: "zzz" })).toHaveLength(0);
  });
  it("compte par domaine, calcule les initiales et construit les liens", () => {
    expect(domainCounts(T).get("secourisme")).toBe(1);
    expect(initials("Awa Koné")).toBe("AK");
    expect(trainersHref({})).toBe("/formateurs#equipe");
    expect(trainersHref({ domaine: "incendie", q: "x" })).toBe("/formateurs?domaine=incendie&q=x#equipe");
  });
});
