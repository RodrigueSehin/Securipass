import { describe, expect, it } from "vitest";
import { ageOn, buildSignupMetadata, formDataToRecord, registerSchema, registerStep1Schema, registerStep2Schema, safeRedirect, TERMS_VERSION } from "./schemas";

const valid = {
  fullName: "Kouassi Jean-Pierre",
  birthDate: "1990-05-20",
  email: "  JP@Example.com ",
  phone: "+225 07 07 07 07 07",
  password: "motdepasse12",
  confirmPassword: "motdepasse12",
  acceptTerms: "on",
};

describe("ageOn", () => {
  const today = new Date("2026-10-19T12:00:00Z");
  it("calcule l'âge révolu, avant et après l'anniversaire", () => {
    expect(ageOn("2000-10-19", today)).toBe(26);
    expect(ageOn("2000-10-20", today)).toBe(25);
    expect(ageOn("2010-01-01", today)).toBe(16);
  });
  it("rejette les dates impossibles ou mal formées", () => {
    expect(ageOn("2000-02-31", today)).toBeNull();
    expect(ageOn("20/05/1990", today)).toBeNull();
    expect(ageOn("", today)).toBeNull();
  });
});

describe("registerStep1Schema", () => {
  it("accepte une première étape valide et normalise l'e-mail", () => {
    const r = registerStep1Schema.safeParse(valid);
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.email).toBe("jp@example.com");
  });
  it("exige le téléphone (obligatoire sur la maquette)", () => {
    expect(registerStep1Schema.safeParse({ ...valid, phone: "" }).success).toBe(false);
    expect(registerStep1Schema.safeParse({ ...valid, phone: "abc" }).success).toBe(false);
  });
  it("refuse un mot de passe faible ou non confirmé", () => {
    expect(registerStep1Schema.safeParse({ ...valid, password: "court", confirmPassword: "court" }).success).toBe(false);
    expect(registerStep1Schema.safeParse({ ...valid, confirmPassword: "autre12345" }).success).toBe(false);
  });
  it("refuse une date de naissance invalide, future ou trop récente (moins de 16 ans)", () => {
    expect(registerStep1Schema.safeParse({ ...valid, birthDate: "" }).success).toBe(false);
    expect(registerStep1Schema.safeParse({ ...valid, birthDate: "2999-01-01" }).success).toBe(false);
    const recent = new Date(); recent.setUTCFullYear(recent.getUTCFullYear() - 10);
    expect(registerStep1Schema.safeParse({ ...valid, birthDate: recent.toISOString().slice(0, 10) }).success).toBe(false);
    expect(registerStep1Schema.safeParse({ ...valid, birthDate: "1800-01-01" }).success).toBe(false);
  });
  it("exige l'acceptation des conditions", () => {
    expect(registerStep1Schema.safeParse({ ...valid, acceptTerms: undefined }).success).toBe(false);
  });
});

describe("registerStep2Schema et registerSchema", () => {
  it("applique des valeurs par défaut sûres", () => {
    const r = registerStep2Schema.parse({});
    expect(r).toEqual({ situation: "individual", interests: [], notifyEmail: false, notifySms: false });
  });
  it("refuse une situation inconnue et des centres d'intérêt dangereux", () => {
    expect(registerStep2Schema.safeParse({ situation: "roi" }).success).toBe(false);
    expect(registerStep2Schema.safeParse({ interests: ["<script>"] }).success).toBe(false);
    expect(registerStep2Schema.safeParse({ interests: Array.from({ length: 11 }, (_, i) => `c${i}`) }).success).toBe(false);
  });
  it("valide l'ensemble des étapes", () => {
    const r = registerSchema.safeParse({ ...valid, situation: "employee", interests: ["secourisme"], notifyEmail: "on" });
    expect(r.success).toBe(true);
  });
});

describe("formDataToRecord et buildSignupMetadata", () => {
  it("conserve les valeurs multiples des centres d'intérêt", () => {
    const fd = new FormData();
    fd.append("fullName", "A B"); fd.append("interests", "secourisme"); fd.append("interests", "securite-incendie");
    expect(formDataToRecord(fd)).toEqual({ fullName: "A B", interests: ["secourisme", "securite-incendie"] });
  });
  it("transmet le consentement et la version des conditions, jamais de rôle ni de mot de passe", () => {
    const data = registerSchema.parse({ ...valid, interests: ["secourisme"], notifyEmail: "on" });
    const meta = buildSignupMetadata(data);
    expect(meta).toMatchObject({ terms_accepted: true, terms_version: TERMS_VERSION, notify_email: true, notify_sms: false });
    expect(Object.keys(meta)).not.toContain("password");
    expect(Object.keys(meta)).not.toContain("role");
  });
});

describe("safeRedirect", () => {
  it("garde les chemins internes", () => expect(safeRedirect("/app/profil", "/app")).toBe("/app/profil"));
  it("rejette les URLs externes", () => {
    expect(safeRedirect("https://evil.com", "/app")).toBe("/app");
    expect(safeRedirect("//evil.com", "/app")).toBe("/app");
    expect(safeRedirect("/\\evil.com", "/app")).toBe("/app");
    expect(safeRedirect(null, "/app")).toBe("/app");
  });
});
