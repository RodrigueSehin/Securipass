import { describe, expect, it } from "vitest";
import { formatBytes, formatMinutes, formatTimeRange, fromDatetimeLocal, toDatetimeLocal } from "./format";

describe("dates (Africa/Abidjan = UTC+0)", () => {
  it("convertit une saisie locale en ISO UTC et inversement", () => {
    expect(fromDatetimeLocal("2026-11-05T08:30")).toBe("2026-11-05T08:30:00.000Z");
    expect(toDatetimeLocal("2026-11-05T08:30:00.000Z")).toBe("2026-11-05T08:30");
  });
  it("rejette une saisie invalide", () => {
    expect(fromDatetimeLocal("")).toBeNull();
    expect(fromDatetimeLocal("2026-13-45T99:99")).toBeNull();
    expect(fromDatetimeLocal("demain")).toBeNull();
  });
  it("formate une plage horaire", () => {
    expect(formatTimeRange("2026-11-05T08:00:00Z", "2026-11-05T12:00:00Z")).toMatch(/08:00.+12:00/);
  });
});

describe("durées et tailles", () => {
  it("formate les minutes", () => {
    expect([0, 45, 60, 80, 125].map(formatMinutes)).toEqual(["0 min", "45 min", "1 h", "1 h 20 min", "2 h 5 min"]);
  });
  it("formate les tailles de fichier", () => {
    expect([500, 12 * 1024, 2.4 * 1024 ** 2].map(formatBytes)).toEqual(["500 o", "12 Ko", "2,4 Mo"]);
  });
});
