import { describe, expect, it } from "vitest";
import { enrollmentErrorMessage } from "./errors";

describe("enrollmentErrorMessage", () => {
  it("traduit les codes métier", () => {
    expect(enrollmentErrorMessage("session_full")).toMatch(/complète/);
    expect(enrollmentErrorMessage("already_enrolled")).toMatch(/déjà inscrit/);
    expect(enrollmentErrorMessage("payment_required")).toMatch(/payante/);
  });
  it("retrouve le code dans un message enrobé", () => {
    expect(enrollmentErrorMessage("error: registration_closed (P0001)")).toMatch(/closes/);
  });
  it("ne divulgue pas les erreurs techniques inconnues", () => {
    expect(enrollmentErrorMessage('relation "x" does not exist')).toBe("Une erreur est survenue. Réessayez.");
    expect(enrollmentErrorMessage(undefined)).toBe("Une erreur est survenue. Réessayez.");
  });
});
