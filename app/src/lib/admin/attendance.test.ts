import { describe, expect, it } from "vitest";
import { attendanceComment, attendanceRate, attendanceRowSchema, formatRate, parseAttendanceFilters } from "./attendance";

const id = "0b9f5d1e-1c2a-4f3b-8d4e-5a6b7c8d9e0f";

describe("parseAttendanceFilters", () => {
  it("ne garde que les valeurs connues", () => {
    expect(parseAttendanceFilters({ vue: "seances", formation: id, session: id, date: "2026-11-24" }))
      .toEqual({ view: "seances", course: id, session: id, date: "2026-11-24" });
    expect(parseAttendanceFilters({ vue: "x", formation: "y", session: "z", date: "demain" }))
      .toEqual({ view: "liste", course: "", session: "", date: "" });
  });
});

describe("attendanceRate / formatRate", () => {
  it("calcule le taux avec une décimale et gère zéro inscrit", () => {
    expect(attendanceRate(22, 24)).toBe(91.7);
    expect(attendanceRate(0, 0)).toBeNull();
    expect(formatRate(91.7).replace(/ | /g, " ")).toBe("91,7 %");
    expect(formatRate(null)).toBe("—");
  });
});

describe("attendanceComment", () => {
  it("préfère la justification saisie, sinon la mention du statut", () => {
    expect(attendanceComment({ status: "excused", justification: "Certificat médical" })).toBe("Certificat médical");
    expect(attendanceComment({ status: "excused", justification: null })).toBe("Absence justifiée");
    expect(attendanceComment({ status: "absent", justification: null })).toBe("Non justifiée");
    expect(attendanceComment({ status: "present", justification: null })).toBeNull();
  });
});

describe("attendanceRowSchema", () => {
  const base = { learner: id, status: "present", checkIn: "08:02", checkOut: "12:31", justification: "" };
  it("accepte une ligne valide ou non saisie", () => {
    expect(attendanceRowSchema.safeParse(base).success).toBe(true);
    expect(attendanceRowSchema.safeParse({ ...base, status: "", checkIn: "", checkOut: "" }).success).toBe(true);
  });
  it("refuse un départ avant l’arrivée et un statut inconnu", () => {
    expect(attendanceRowSchema.safeParse({ ...base, checkOut: "08:00" }).success).toBe(false);
    expect(attendanceRowSchema.safeParse({ ...base, status: "malade" }).success).toBe(false);
  });
});
