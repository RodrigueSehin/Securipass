import { describe, expect, it } from "vitest";
import { sessionSchema } from "./schemas";

const base = {
  courseId: "3f6f1e2a-8b1c-4a0e-9c3d-2f7a5b6c7d8e",
  title: "Session novembre",
  start: "2026-11-05T08:00",
  end: "2026-11-05T12:00",
  deliveryMode: "onsite",
  location: "Centre SECURIPASS, Abidjan",
  capacity: "20",
};

describe("sessionSchema", () => {
  it("accepte une session présentielle valide", () => {
    const r = sessionSchema.safeParse(base);
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.start).toBe("2026-11-05T08:00:00.000Z");
      expect(r.data.capacity).toBe(20);
      expect(r.data.waitlistEnabled).toBe(false);
    }
  });
  it("refuse une fin avant le début", () => {
    expect(sessionSchema.safeParse({ ...base, end: "2026-11-05T07:00" }).success).toBe(false);
  });
  it("exige un lieu en présentiel/hybride et un lien https en ligne/hybride", () => {
    expect(sessionSchema.safeParse({ ...base, location: "" }).success).toBe(false);
    expect(sessionSchema.safeParse({ ...base, deliveryMode: "online", location: "" }).success).toBe(false);
    expect(sessionSchema.safeParse({ ...base, deliveryMode: "online", location: "", meetingUrl: "http://x" }).success).toBe(false);
    expect(sessionSchema.safeParse({ ...base, deliveryMode: "online", location: "", meetingUrl: "https://meet.x.ci/a" }).success).toBe(true);
    expect(sessionSchema.safeParse({ ...base, deliveryMode: "hybrid", meetingUrl: "https://meet.x.ci/a" }).success).toBe(true);
    expect(sessionSchema.safeParse({ ...base, deliveryMode: "hybrid" }).success).toBe(false);
  });
  it("la date limite d'inscription ne peut pas suivre le début", () => {
    expect(sessionSchema.safeParse({ ...base, registrationDeadline: "2026-11-04T18:00" }).success).toBe(true);
    expect(sessionSchema.safeParse({ ...base, registrationDeadline: "2026-11-06T18:00" }).success).toBe(false);
  });
  it("refuse une capacité nulle ou décimale", () => {
    expect(sessionSchema.safeParse({ ...base, capacity: "0" }).success).toBe(false);
    expect(sessionSchema.safeParse({ ...base, capacity: "2.5" }).success).toBe(false);
  });
});
