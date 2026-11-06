import { describe, expect, it } from "vitest";
import { isValidPhone } from "./validation";

describe("isValidPhone", () => {
  it("accepte les formats courants, dont celui de la maquette", () => {
    for (const v of ["+225 07 07 07 07 07", "0707070707", "+22507070707", "+33 6 12 34 56 78", " 07 07 07 07 "]) expect(isValidPhone(v)).toBe(true);
  });
  it("refuse trop court, trop long, lettres et caractères parasites", () => {
    for (const v of ["", "1234567", "abc", "07-07-07-07", "+225 (07) 07 07", "0".repeat(21), "+1234567890123456", "++22507070707"]) expect(isValidPhone(v)).toBe(false);
  });
});
