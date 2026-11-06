import { describe, expect, it } from "vitest";
import { localToUtc } from "./timezones";
import {
  draftToFormData, findOverlap, minutesBetween, missingSteps, occurrences, parseSessionStep, sessionStep1Schema, sessionStep2Schema,
  sessionWizardUrl, spanLabel, step2Input, type SessionDraft,
} from "./wizard";

const COURSE = "11111111-1111-4111-8111-111111111111";
const base: SessionDraft = { courseId: COURSE, title: "Session Octobre 2026", deliveryMode: "online", objectives: [], requiredLevel: "beginner", language: "fr", capacity: "30" };
const planning: SessionDraft = {
  ...base, planning: "single", startDate: "2026-12-01", startTime: "09:00", endDate: "2026-12-01", endTime: "12:00",
  timezone: "Africa/Abidjan", platform: "teams", meetingUrl: "https://teams.microsoft.com/l/meetup-join/abc",
};

describe("assistant de session", () => {
  it("borne l'étape et construit les adresses", () => {
    expect(parseSessionStep("9")).toBe(1);
    expect(parseSessionStep("3")).toBe(3);
    expect(sessionWizardUrl("d1", "list")).toBe("/formateur/sessions?resultat=assistant");
    expect(sessionWizardUrl("d1", "3")).toBe("/formateur/sessions/nouvelle/d1?etape=3");
    expect(sessionWizardUrl("d1", undefined, 2)).toBe("/formateur/sessions/nouvelle/d1?etape=2");
  });

  it("valide l'étape 1", () => {
    expect(sessionStep1Schema.safeParse(base).success).toBe(true);
    expect(sessionStep1Schema.safeParse({ ...base, courseId: "" }).success).toBe(false);
    expect(sessionStep1Schema.safeParse({ ...base, deliveryMode: "hybrid" }).success).toBe(false);
    expect(sessionStep1Schema.safeParse({ ...base, capacity: "0" }).success).toBe(false);
    expect(sessionStep1Schema.safeParse({ ...base, description: "x".repeat(1001) }).success).toBe(false);
    expect(sessionStep1Schema.safeParse({ ...base, objectives: Array(11).fill("a") }).success).toBe(false);
  });

  it("valide la planification : lien https en ligne, lieu en présentiel, hybride les deux", () => {
    expect(sessionStep2Schema.safeParse(step2Input(planning)).success).toBe(true);
    expect(sessionStep2Schema.safeParse(step2Input({ ...planning, meetingUrl: "http://x.io" })).success).toBe(false);
    expect(sessionStep2Schema.safeParse(step2Input({ ...planning, platform: "" })).success).toBe(false);
    expect(sessionStep2Schema.safeParse(step2Input({ ...planning, deliveryMode: "onsite" })).success).toBe(false);
    expect(sessionStep2Schema.safeParse(step2Input({ ...planning, deliveryMode: "onsite", location: "Abidjan" })).success).toBe(true);
    expect(sessionStep2Schema.safeParse(step2Input({ ...planning, deliveryMode: "hybrid", location: "" })).success).toBe(false);
    expect(sessionStep2Schema.safeParse(step2Input({ ...planning, deliveryMode: "hybrid", location: "Salle A" })).success).toBe(true);
  });

  it("refuse une fin avant le début, une heure ou un fuseau invalides", () => {
    expect(sessionStep2Schema.safeParse(step2Input({ ...planning, endTime: "08:00" })).success).toBe(false);
    expect(sessionStep2Schema.safeParse(step2Input({ ...planning, startTime: "25:00" })).success).toBe(false);
    expect(sessionStep2Schema.safeParse(step2Input({ ...planning, timezone: "Mars/Olympus" })).success).toBe(false);
    expect(sessionStep2Schema.safeParse(step2Input({ ...planning, endDate: "2026-12-02", endTime: "08:00" })).success).toBe(true);
  });

  it("gère les séances multiples et leurs chevauchements", () => {
    const multi: SessionDraft = { ...planning, planning: "multiple", extras: [{ date: "2026-12-08", start: "09:00", end: "12:00" }, { date: "2026-12-15", start: "14:00", end: "17:00" }] };
    expect(occurrences(multi)).toHaveLength(3);
    expect(findOverlap(occurrences(multi))).toBeNull();
    expect(findOverlap(occurrences({ ...multi, extras: [{ date: "2026-12-01", start: "11:00", end: "13:00" }] }))).toEqual([1, 2]);
    expect(sessionStep2Schema.safeParse(step2Input({ ...multi, extras: [{ date: "2026-12-08", start: "12:00", end: "09:00" }] })).success).toBe(false);
    expect(occurrences({ ...multi, planning: "single" })).toHaveLength(1);
  });

  it("calcule les durées et convertit selon le fuseau", () => {
    expect(minutesBetween("2026-12-01T09:00", "2026-12-01T12:00")).toBe(180);
    expect(spanLabel(180)).toBe("3 heures");
    expect(spanLabel(90)).toBe("1 h 30");
    expect(spanLabel(2880)).toBe("2 jours");
    expect(spanLabel(0)).toBe("—");
    expect(localToUtc("2026-12-01T09:00", "Africa/Abidjan")).toBe("2026-12-01T09:00:00.000Z");
    expect(localToUtc("2026-12-01T09:00", "Africa/Lagos")).toBe("2026-12-01T08:00:00.000Z");
    expect(localToUtc("2026-12-01 09:00", "Africa/Lagos")).toBeNull();
  });

  it("indique les étapes à compléter et reconstruit le formulaire", () => {
    expect(missingSteps(base)).toEqual([2]);
    const full: SessionDraft = { ...planning, objectives: ["A", "B"], waitlistEnabled: "on", welcomeMessage: "Bienvenue" };
    expect(missingSteps(full)).toEqual([]);
    const fd = draftToFormData(full, { draft: true });
    expect(fd.getAll("objective")).toEqual(["A", "B"]);
    expect(fd.get("waitlistEnabled")).toBe("on");
    expect(fd.get("draft")).toBe("1");
    expect(fd.get("start")).toBe("2026-12-01T09:00");
    expect(fd.get("meetingPlatform")).toBe("teams");
    expect(fd.get("location")).toBe("");
    expect(draftToFormData({ ...full, deliveryMode: "onsite", location: "Abidjan" }).get("meetingUrl")).toBe("");
  });
});
