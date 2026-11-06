import { describe, expect, it } from "vitest";
import { certificateDisplayStatus } from "./status";

const now = Date.parse("2026-10-24T10:00:00Z");

describe("statut affiché d'un certificat", () => {
  it("valide sans date de fin ou avant la fin de validité", () => {
    expect(certificateDisplayStatus({ status: "valid", valid_until: null }, now)).toMatchObject({ label: "Valide", valid: true });
    expect(certificateDisplayStatus({ status: "valid", valid_until: "2027-01-12T00:00:00Z" }, now).valid).toBe(true);
  });
  it("expiré une fois la date de validité passée", () => {
    expect(certificateDisplayStatus({ status: "valid", valid_until: "2026-10-01T00:00:00Z" }, now)).toMatchObject({ label: "Expiré", valid: false });
  });
  it("le statut de la base l'emporte sur la date", () => {
    expect(certificateDisplayStatus({ status: "revoked", valid_until: null }, now).label).toBe("Révoqué");
    expect(certificateDisplayStatus({ status: "suspended", valid_until: null }, now).label).toBe("Suspendu");
  });
});
