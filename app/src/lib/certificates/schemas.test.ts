import { describe, expect, it } from "vitest";
import { certificateErrorMessage, issueSchema, reissueSchema, statusSchema } from "./schemas";

const ids = { enrollmentId: "11111111-1111-4111-8111-111111111111", templateId: "22222222-2222-4222-8222-222222222222" };

describe("formulaire d'émission", () => {
  it("les champs vides prennent la valeur du modèle", () => {
    const r = issueSchema.parse({ ...ids, title: "", body: "  ", signatoryName: "", validityMonths: "" });
    expect(r.title).toBeUndefined();
    expect(r.body).toBeUndefined();
    expect(r.validityMonths).toBeUndefined();
  });
  it("valide la durée de validité", () => {
    expect(issueSchema.safeParse({ ...ids, validityMonths: "24" }).success).toBe(true);
    expect(issueSchema.safeParse({ ...ids, validityMonths: "500" }).success).toBe(false);
  });
  it("la réémission exige un motif", () => {
    expect(reissueSchema.safeParse({ certificateId: ids.enrollmentId, templateId: ids.templateId, reason: "ab" }).success).toBe(false);
  });
  it("la révocation accepte une action connue seulement", () => {
    expect(statusSchema.safeParse({ certificateId: ids.enrollmentId, action: "delete" }).success).toBe(false);
    expect(statusSchema.safeParse({ certificateId: ids.enrollmentId, action: "revoke", reason: "Fraude avérée" }).success).toBe(true);
  });
});

describe("messages d'erreur", () => {
  it("traduit les refus connus, et ne révèle pas les autres", () => {
    expect(certificateErrorMessage("ERROR: not_eligible")).toMatch(/conditions/);
    expect(certificateErrorMessage("duplicate key value violates unique constraint certificates_one_active")).toMatch(/existe déjà/);
    expect(certificateErrorMessage("boom")).toMatch(/support/);
  });
});
