import { describe, expect, it } from "vitest";
import { formatDuration, formatFcfa } from "./utils";

describe("formatFcfa", () => {
  it("formate sans décimales avec séparateur de milliers", () => {
    expect(formatFcfa(49000)).toBe("49 000 FCFA");
    expect(formatFcfa(0)).toBe("0 FCFA");
  });
});

describe("formatDuration", () => {
  it("affiche minutes ou heures", () => {
    expect(formatDuration(45)).toBe("45 min");
    expect(formatDuration(3600)).toBe("60 heures");
    expect(formatDuration(60)).toBe("1 heure");
  });
});
