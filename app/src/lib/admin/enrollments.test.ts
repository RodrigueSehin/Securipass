import { describe, expect, it } from "vitest";
import { createEnrollmentSchema, enrollmentGroup, parseEnrollmentFilters } from "./enrollments";

describe("parseEnrollmentFilters", () => {
  it("ne garde que les valeurs connues", () => {
    const id = "0b9f5d1e-1c2a-4f3b-8d4e-5a6b7c8d9e0f";
    expect(parseEnrollmentFilters({ q: " koné ", formation: id, session: id, statut: "pending", du: "2026-10-01", au: "2026-10-31", tri: "asc" }))
      .toEqual({ q: "koné", course: id, session: id, status: "pending", from: "2026-10-01", to: "2026-10-31", asc: true });
    expect(parseEnrollmentFilters({ formation: "x", session: "y", statut: "confirmed", du: "demain" }))
      .toEqual({ q: "", course: "", session: "", status: "", from: "", to: "", asc: false });
  });
  it("remet une période inversée dans l'ordre", () => {
    const f = parseEnrollmentFilters({ du: "2026-11-01", au: "2026-10-01" });
    expect([f.from, f.to]).toEqual(["2026-10-01", "2026-11-01"]);
  });
});

describe("enrollmentGroup", () => {
  it("regroupe les statuts comme la base", () => {
    expect(enrollmentGroup("pending_approval")).toBe("pending");
    expect(enrollmentGroup("pending_payment")).toBe("pending");
    expect(enrollmentGroup("confirmed")).toBe("validated");
    expect(enrollmentGroup("completed")).toBe("validated");
    expect(enrollmentGroup("cancelled")).toBe("refused");
    expect(enrollmentGroup("waitlisted")).toBe("waitlisted");
  });
});


describe("createEnrollmentSchema", () => {
  const id = "0b9f5d1e-1c2a-4f3b-8d4e-5a6b7c8d9e0f";
  const base = { mode: "existing", learnerId: id, courseId: id, sessionId: id, status: "pending", date: "2026-10-29", source: "administration", amountDue: "100 000", amountPaid: "0", paymentStatus: "to_verify", documents: [] };
  it("accepte un apprenant existant et lit les montants", () => {
    const r = createEnrollmentSchema.parse(base);
    expect([r.amountDue, r.amountPaid, r.paymentMethod]).toEqual([100000, 0, null]);
  });
  it("refuse un montant payé supérieur au montant dû", () => {
    expect(createEnrollmentSchema.safeParse({ ...base, amountPaid: "150000" }).success).toBe(false);
  });
  it("exige nom, prénom, téléphone et e-mail pour un nouvel apprenant", () => {
    expect(createEnrollmentSchema.safeParse({ ...base, mode: "new", learnerId: "" }).success).toBe(false);
    expect(createEnrollmentSchema.safeParse({ ...base, mode: "new", learnerId: "", lastName: "Traoré", firstName: "Mariam", phoneCode: "+225", phoneNumber: "07 77 63 20 18", email: "Mariam@Example.com" }).success).toBe(true);
  });
});
