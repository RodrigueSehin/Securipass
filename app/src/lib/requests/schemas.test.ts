import { describe, expect, it } from "vitest";
import { isRateLimited, requestSchema } from "./schemas";

const contact = { kind: "contact", fullName: "Awa Koné", email: "AWA@x.ci", phone: "+225 07 07 07 07", requestType: "particulier", subject: "Question", message: "Bonjour, je voudrais des infos." };

describe("requestSchema", () => {
  it("accepte un contact valide et normalise l'e-mail", () => {
    const r = requestSchema.safeParse(contact);
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.email).toBe("awa@x.ci");
  });
  it("exige le téléphone et un type de demande connu pour un contact", () => {
    expect(requestSchema.safeParse({ ...contact, phone: "" }).success).toBe(false);
    expect(requestSchema.safeParse({ ...contact, requestType: "inconnu" }).success).toBe(false);
  });
  it("rejette un message trop court", () => {
    expect(requestSchema.safeParse({ ...contact, message: "court" }).success).toBe(false);
  });
  it("exige l'entreprise et l'effectif pour un devis", () => {
    expect(requestSchema.safeParse({ ...contact, kind: "quote" }).success).toBe(false);
    expect(requestSchema.safeParse({ ...contact, kind: "quote", organization: "ACME", headcount: "25" }).success).toBe(true);
  });
  it("exige le téléphone pour une candidature formateur", () => {
    const t = { ...contact, phone: "", kind: "trainer_application", specialty: "SST", experienceYears: "5" };
    expect(requestSchema.safeParse(t).success).toBe(false);
    expect(requestSchema.safeParse({ ...t, phone: "+225 07 07 07 07" }).success).toBe(true);
  });
  it("rejette un type de demande inconnu", () => {
    expect(requestSchema.safeParse({ ...contact, kind: "autre" }).success).toBe(false);
  });
});

describe("isRateLimited", () => {
  it("bloque au-delà des seuils par e-mail ou par IP", () => {
    expect(isRateLimited({ byEmail: 2, byIp: 7 })).toBe(false);
    expect(isRateLimited({ byEmail: 3, byIp: 0 })).toBe(true);
    expect(isRateLimited({ byEmail: 0, byIp: 8 })).toBe(true);
  });
});

describe("newsletterSchema", () => {
  it("n'exige que l'e-mail et complète les champs techniques", () => {
    const r = requestSchema.safeParse({ kind: "newsletter", email: "A@x.ci" });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data).toMatchObject({ email: "a@x.ci", fullName: "Abonné newsletter" });
    expect(requestSchema.safeParse({ kind: "newsletter", email: "pas-un-mail" }).success).toBe(false);
  });
});
