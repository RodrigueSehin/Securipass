import { describe, expect, it } from "vitest";
import { signupErrorMessage } from "./signup-errors";

describe("erreurs d'inscription", () => {
  it("traduit les cas connus", () => {
    expect(signupErrorMessage("user_already_exists")).toMatch(/Connectez-vous/);
    expect(signupErrorMessage("over_email_send_rate_limit")).toMatch(/Réessayez/);
  });
  it("affiche le code pour une erreur inconnue, afin de pouvoir la diagnostiquer", () => {
    expect(signupErrorMessage("unexpected_failure")).toMatch(/code : unexpected_failure/);
  });
  it("reste utilisable sans code", () => {
    expect(signupErrorMessage(undefined)).toMatch(/support/);
  });
});
