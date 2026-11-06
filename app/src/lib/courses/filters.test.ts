import { describe, expect, it } from "vitest";
import { parseCatalogueParams } from "./filters";

describe("parseCatalogueParams", () => {
  it("valeurs par défaut", () => {
    expect(parseCatalogueParams({})).toEqual({
      q: undefined, categories: [], levels: [], modes: [], durations: [], priceMin: undefined, priceMax: undefined,
      openOnly: false, sort: "populaires", page: 1,
    });
  });
  it("accepte des valeurs multiples (clés répétées)", () => {
    const f = parseCatalogueParams({
      q: " SST ", categorie: ["secourisme", "securite-incendie"], niveau: ["advanced", "beginner"], format: "online",
      duree: ["d1", "d4"], pmin: "10000", pmax: "50000", dispo: "1", tri: "prix_asc", page: "3",
    });
    expect(f).toMatchObject({
      q: "SST", categories: ["secourisme", "securite-incendie"], levels: ["advanced", "beginner"], modes: ["online"],
      durations: ["d1", "d4"], priceMin: 10000, priceMax: 50000, openOnly: true, sort: "prix_asc", page: 3,
    });
  });
  it("ignore les valeurs inconnues ou dangereuses", () => {
    const f = parseCatalogueParams({
      niveau: ["expert", "constructor"], format: "__proto__", duree: "toString", tri: "drop table", page: "-4",
      categorie: ["../etc", "Majuscule", "ok-slug"], pmin: "-5", pmax: "abc",
    });
    expect(f).toMatchObject({ levels: [], modes: [], durations: [], sort: "populaires", page: 1, categories: ["ok-slug"], priceMin: undefined, priceMax: undefined });
  });
  it("remet dans l'ordre un prix minimum supérieur au maximum et dédoublonne", () => {
    const f = parseCatalogueParams({ pmin: "90000", pmax: "20000", format: ["online", "online"] });
    expect(f.priceMin).toBe(20000);
    expect(f.priceMax).toBe(90000);
    expect(f.modes).toEqual(["online"]);
  });
});
