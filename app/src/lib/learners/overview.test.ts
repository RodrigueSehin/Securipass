import { describe, expect, it } from "vitest";
import { buildLearnerRows, filterLearners, learnerStatus, overviewStats, recentActivity, topCourses } from "./overview";

const NOW = Date.parse("2026-10-20T10:00:00Z");
const DAY = 86_400_000;
const iso = (daysAgo: number) => new Date(NOW - daysAgo * DAY).toISOString();

const enr = (id: string, learner: string, course: string, status = "confirmed", enrolledDaysAgo = 30) =>
  ({ id, course_id: course, learner_id: learner, session_id: null, status, enrolled_at: iso(enrolledDaysAgo), completed_at: null });

const inputs = (enrollments: ReturnType<typeof enr>[], completions: { learner_id: string; content_id: string; completed_at: string }[] = []) => ({
  enrollments,
  profiles: new Map([
    ["u1", { full_name: "Kouassi Jean", email: "jean@mail.ci", avatar_url: null }],
    ["u2", { full_name: "Traoré Fatou", email: "fatou@mail.ci", avatar_url: null }],
    ["u3", { full_name: "Aka Serge", email: "serge@mail.ci", avatar_url: null }],
  ]),
  courses: new Map([["c1", "Sécurité incendie"], ["c2", "Premiers secours"]]),
  sessions: new Map(),
  contents: [
    { id: "k1", course_id: "c1", duration_minutes: 10 }, { id: "k2", course_id: "c1", duration_minutes: 10 },
    { id: "k3", course_id: "c1", duration_minutes: 10 }, { id: "k4", course_id: "c1", duration_minutes: 10 },
  ],
  completions,
  attempts: [],
  certifiedEnrollmentIds: new Set<string>(),
  now: NOW,
});

describe("statut d'un apprenant", () => {
  const base = { enrollmentStatus: "confirmed", percentStatus: "in_progress" as const, certified: false, lastActivity: iso(2), enrolledAt: iso(30), now: NOW };
  it("distingue les cas", () => {
    expect(learnerStatus(base)).toBe("in_progress");
    expect(learnerStatus({ ...base, lastActivity: iso(20) })).toBe("late");
    expect(learnerStatus({ ...base, percentStatus: "not_started", lastActivity: null })).toBe("not_started");
    expect(learnerStatus({ ...base, percentStatus: "completed" })).toBe("completed");
    expect(learnerStatus({ ...base, certified: true })).toBe("completed");
    expect(learnerStatus({ ...base, enrollmentStatus: "cancelled" })).toBe("dropped");
    expect(learnerStatus({ ...base, enrollmentStatus: "expired", percentStatus: "completed" })).toBe("dropped");
  });
});

describe("lignes et indicateurs", () => {
  const completions = [
    { learner_id: "u1", content_id: "k1", completed_at: iso(1) }, { learner_id: "u1", content_id: "k2", completed_at: iso(1) },
    { learner_id: "u1", content_id: "k3", completed_at: iso(1) },
    { learner_id: "u2", content_id: "k1", completed_at: iso(1) }, { learner_id: "u2", content_id: "k2", completed_at: iso(1) },
    { learner_id: "u2", content_id: "k3", completed_at: iso(1) }, { learner_id: "u2", content_id: "k4", completed_at: iso(1) },
  ];
  const enrollments = [enr("e1", "u1", "c1"), enr("e2", "u2", "c1"), enr("e3", "u3", "c1"), enr("e4", "u3", "c2", "cancelled"), enr("e5", "u3", "c2", "pending_payment")];
  const rows = buildLearnerRows(inputs(enrollments, completions));

  it("calcule la progression et ignore les inscriptions non confirmées", () => {
    expect(rows).toHaveLength(4);
    const byId = Object.fromEntries(rows.map((r) => [r.id, r]));
    expect(byId.e1).toMatchObject({ percent: 75, status: "in_progress", name: "Kouassi Jean" });
    expect(byId.e2).toMatchObject({ percent: 100, status: "completed" });
    expect(byId.e3).toMatchObject({ percent: 0, status: "not_started", lastActivity: null });
    expect(byId.e4.status).toBe("dropped");
  });

  it("agrège les statuts (non commencé compté en cours)", () => {
    const s = overviewStats(rows, NOW);
    expect(s.total).toBe(4);
    expect(s.inProgress.count).toBe(2);
    expect(s.completed.count).toBe(1);
    expect(s.dropped.count).toBe(1);
    expect(s.inProgress.percent).toBe(50);
  });

  it("filtre par texte, statut, formation", () => {
    expect(filterLearners(rows, { q: "traore" }).map((r) => r.id)).toEqual(["e2"]);
    expect(filterLearners(rows, { status: "dropped" })).toHaveLength(1);
    expect(filterLearners(rows, { course: "c2" })).toHaveLength(1);
    expect(filterLearners(rows, { q: "MAIL.CI" })).toHaveLength(4);
  });

  it("classe les formations par nombre d'apprenants actifs", () => {
    expect(topCourses(rows)).toEqual([{ id: "c1", title: "Sécurité incendie", count: 3 }]);
  });

  it("construit l'activité récente, certificats compris", () => {
    const a = recentActivity({ ...inputs(enrollments, completions), certDates: new Map([["e2", iso(0.1)]]) });
    expect(a[0]).toMatchObject({ name: "Traoré Fatou", verb: "a obtenu son certificat" });
    expect(a.some((x) => x.verb === "a repris la formation" && x.name === "Kouassi Jean")).toBe(true);
  });
});
