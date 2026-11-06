import { describe, expect, it } from "vitest";
import { createAdminSessionSchema, formatDayRange, parseSessionFilters, sharePercent } from "./sessions";

describe("parseSessionFilters", () => {
  it("ne garde que les valeurs connues", () => {
    const id = "0b9f5d1e-1c2a-4f3b-8d4e-5a6b7c8d9e0f";
    expect(parseSessionFilters({ q: " sst ", formation: id, statut: "in_progress", mode: "online", du: "2026-10-01", au: "2026-10-31", tri: "asc" }))
      .toEqual({ q: "sst", course: id, status: "in_progress", mode: "online", from: "2026-10-01", to: "2026-10-31", asc: true });
    expect(parseSessionFilters({ formation: "x", statut: "draft", mode: "vr", du: "demain", au: "2026-13-40" }))
      .toEqual({ q: "", course: "", status: "", mode: "", from: "", to: "", asc: false });
  });
  it("remet une période inversée dans l'ordre", () => {
    const f = parseSessionFilters({ du: "2026-11-01", au: "2026-10-01" });
    expect([f.from, f.to]).toEqual(["2026-10-01", "2026-11-01"]);
  });
});

describe("sharePercent", () => {
  it("arrondit et gère un total nul", () => {
    expect(sharePercent(12, 48)).toBe(25);
    expect(sharePercent(1, 0)).toBe(0);
  });
});

describe("formatDayRange", () => {
  const tz = "Africa/Abidjan";
  it("regroupe les jours d'un même mois", () => {
    expect(formatDayRange("2026-10-12T08:00:00Z", "2026-10-16T16:00:00Z", tz)).toMatch(/^12 – 16 oct\.? 2026$/);
  });
  it("n'affiche qu'une date pour une session d'un jour", () => {
    expect(formatDayRange("2026-10-12T08:00:00Z", "2026-10-12T16:00:00Z", tz)).toMatch(/^12 oct\.? 2026$/);
  });
  it("affiche les deux mois quand la session les chevauche", () => {
    expect(formatDayRange("2026-10-30T08:00:00Z", "2026-11-02T16:00:00Z", tz)).toMatch(/^30 oct\.? – 2 nov\.? 2026$/);
  });
});

describe("createAdminSessionSchema", () => {
  const id = "0b9f5d1e-1c2a-4f3b-8d4e-5a6b7c8d9e0f";
  const other = "1c0a6e2f-2d3b-4a4c-9e5f-6b7c8d9e0f1a";
  const ok = {
    courseId: id, code: "sp-ses-001", title: "Session Octobre 2026 - SST", description: "", startDate: "2026-10-12", startTime: "08:00", endDate: "2026-10-16", endTime: "16:00",
    timezone: "Africa/Abidjan", mode: "onsite", location: "Abidjan, Salle principale", meetingUrl: "", instructorId: id, extraInstructors: [other],
    capacity: "25", minCapacity: "10", deadlineDate: "2026-10-10", initial: "open", waitlist: "1", onlineRegistration: "1", manualValidation: "0", companyReserved: "0", coverUrl: "",
  };
  it("accepte une session valide et calcule les instants", () => {
    const r = createAdminSessionSchema.safeParse(ok);
    expect(r.success).toBe(true);
    if (r.success) expect(r.data).toMatchObject({
      code: "SP-SES-001", capacity: 25, minCapacity: 10, startAt: "2026-10-12T08:00:00.000Z", endAt: "2026-10-16T16:00:00.000Z",
      deadlineAt: "2026-10-10T23:59:00.000Z", waitlist: true, manualValidation: false, description: null, meetingUrl: null,
    });
  });
  it("exige le lieu en présentiel et le lien en ligne", () => {
    const a = createAdminSessionSchema.safeParse({ ...ok, location: "" });
    expect(!a.success && Object.keys(a.error.flatten().fieldErrors)).toEqual(["location"]);
    const b = createAdminSessionSchema.safeParse({ ...ok, mode: "online" });
    expect(!b.success && Object.keys(b.error.flatten().fieldErrors)).toEqual(["meetingUrl"]);
    expect(createAdminSessionSchema.safeParse({ ...ok, mode: "online", meetingUrl: "https://meet.example.com/x" }).success).toBe(true);
  });
  it("refuse les incohérences de dates, de places et de formateurs", () => {
    const r = createAdminSessionSchema.safeParse({ ...ok, endDate: "2026-10-01", minCapacity: "30", deadlineDate: "2026-10-20", extraInstructors: [id] });
    expect(r.success).toBe(false);
    if (!r.success) expect(Object.keys(r.error.flatten().fieldErrors).sort()).toEqual(["deadlineDate", "endDate", "extraInstructors", "minCapacity"]);
  });
  it("ramène la date limite au début quand elle tombe le jour même", () => {
    const r = createAdminSessionSchema.safeParse({ ...ok, deadlineDate: "2026-10-12" });
    expect(r.success && r.data.deadlineAt).toBe("2026-10-12T08:00:00.000Z");
  });
});
