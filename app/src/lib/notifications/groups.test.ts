import { describe, expect, it } from "vitest";
import { groupByDay } from "./groups";

const NOW = Date.parse("2026-10-22T10:00:00Z");

describe("regroupement par jour", () => {
  it("nomme aujourd'hui et hier, puis la date", () => {
    const groups = groupByDay([
      { id: "a", created_at: "2026-10-22T09:00:00Z" },
      { id: "b", created_at: "2026-10-21T18:00:00Z" },
      { id: "c", created_at: "2026-09-25T11:00:00Z" },
    ], NOW);
    expect(groups.map((g) => g.label)).toEqual(["Aujourd’hui", "Hier", expect.stringMatching(/25 septembre 2026/)]);
    expect(groups[0].items.map((i) => i.id)).toEqual(["a"]);
  });
});
