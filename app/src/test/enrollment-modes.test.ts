import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { addUser, asUser, createTestDb, type TestDb } from "./pg-harness";

let db: TestDb;
let ins: string, other: string, l1: string, l2: string, l3: string, l4: string;
let approvalCourse: string, codeCourse: string, session: string;

const one = async (sql: string, p: unknown[] = []) => (await db.query<{ id: string }>(sql, p)).rows[0]?.id;
const as = <T,>(u: string | null, fn: () => Promise<T>) => asUser(db, u, fn);
const rpc = <T = unknown>(u: string | null, sql: string, p: unknown[] = []) => as(u, async () => (await db.query<T>(sql, p)).rows);
const status = async (learner: string, course: string) =>
  (await db.query<{ status: string }>(`select status from public.enrollments where learner_id = $1 and course_id = $2 order by enrolled_at desc limit 1`, [learner, course])).rows[0]?.status;

beforeAll(async () => {
  db = await createTestDb();
  ins = await addUser(db, "ins@x.ci", ["instructor"]);
  other = await addUser(db, "other@x.ci", ["instructor"]);
  l1 = await addUser(db, "l1@x.ci");
  l2 = await addUser(db, "l2@x.ci");
  l3 = await addUser(db, "l3@x.ci");
  l4 = await addUser(db, "l4@x.ci");
  const course = (slug: string, mode: string) => one(
    `insert into public.courses (instructor_id, title, slug, status, published_at, price_amount, enrollment_mode)
     values ($1, $2, $2, 'published', now(), 0, $3) returning id`, [ins, slug, mode]);
  approvalCourse = await course("sur-validation", "approval");
  codeCourse = await course("par-code", "code");
  await db.query(`insert into public.course_access_codes (course_id, code) values ($1, 'SECU-2026')`, [codeCourse]);
  session = await one(
    `insert into public.sessions (course_id, instructor_id, title, start_at, end_at, delivery_mode, location, capacity, waitlist_enabled)
     values ($1, $2, 'Session', now() + interval '10 days', now() + interval '10 days 4 hours', 'onsite', 'Abidjan', 1, true) returning id`,
    [approvalCourse, ins]);
}, 120_000);
afterAll(async () => { await db.close(); });

describe("inscription sur validation", () => {
  it("la demande est mise en attente et ne prend aucune place", async () => {
    const [r] = await rpc<{ enroll_self: { status: string } }>(l1, `select public.enroll_self($1,$2)`, [approvalCourse, session]);
    expect(r.enroll_self.status).toBe("pending_approval");
    const [seats] = await rpc<{ n: number }>(null, `select public.session_seats_taken($1) as n`, [session]);
    expect(seats.n).toBe(0);
  });

  it("l'apprenant n'accède pas au contenu tant que la demande n'est pas acceptée", async () => {
    const [r] = await rpc<{ ok: boolean }>(l1, `select public.has_course_access($1) as ok`, [approvalCourse]);
    expect(r.ok).toBe(false);
  });

  it("le formateur et l'apprenant sont notifiés de la demande", async () => {
    const forInstructor = await rpc<{ kind: string }>(ins, `select kind from public.notifications`);
    expect(forInstructor.map((n) => n.kind)).toContain("enrollment_request");
    const forLearner = await rpc<{ kind: string }>(l1, `select kind from public.notifications`);
    expect(forLearner.map((n) => n.kind)).toContain("enrollment_pending");
  });

  it("une deuxième demande est refusée tant que la première est en attente", async () => {
    await expect(rpc(l1, `select public.enroll_self($1,$2)`, [approvalCourse, session])).rejects.toThrow(/already_enrolled/);
  });

  it("seul le formateur de la formation décide", async () => {
    const id = await one(`select id from public.enrollments where learner_id = $1 and course_id = $2`, [l1, approvalCourse]);
    await expect(rpc(l2, `select public.review_enrollment($1, true)`, [id])).rejects.toThrow(/forbidden/);
    await expect(rpc(other, `select public.review_enrollment($1, true)`, [id])).rejects.toThrow(/forbidden/);
  });

  it("l'acceptation confirme l'inscription et notifie l'apprenant", async () => {
    const id = await one(`select id from public.enrollments where learner_id = $1 and course_id = $2`, [l1, approvalCourse]);
    const [r] = await rpc<{ review_enrollment: { status: string } }>(ins, `select public.review_enrollment($1, true)`, [id]);
    expect(r.review_enrollment.status).toBe("confirmed");
    expect(await status(l1, approvalCourse)).toBe("confirmed");
    const kinds = (await rpc<{ kind: string }>(l1, `select kind from public.notifications`)).map((n) => n.kind);
    expect(kinds).toContain("enrollment_confirmed");
    await expect(rpc(ins, `select public.review_enrollment($1, true)`, [id])).rejects.toThrow(/not_pending/);
  });

  it("session pleine à l'acceptation : liste d'attente", async () => {
    await rpc(l2, `select public.enroll_self($1,$2)`, [approvalCourse, session]);
    const id = await one(`select id from public.enrollments where learner_id = $1 and course_id = $2`, [l2, approvalCourse]);
    const [r] = await rpc<{ review_enrollment: { status: string } }>(ins, `select public.review_enrollment($1, true)`, [id]);
    expect(r.review_enrollment.status).toBe("waitlisted");
  });

  it("le refus annule la demande et notifie l'apprenant", async () => {
    await rpc(l3, `select public.enroll_self($1,$2)`, [approvalCourse, session]);
    const id = await one(`select id from public.enrollments where learner_id = $1 and course_id = $2`, [l3, approvalCourse]);
    await rpc(ins, `select public.review_enrollment($1, false)`, [id]);
    expect(await status(l3, approvalCourse)).toBe("cancelled");
    const kinds = (await rpc<{ kind: string }>(l3, `select kind from public.notifications`)).map((n) => n.kind);
    expect(kinds).toContain("enrollment_declined");
  });

  it("un apprenant qui annule lui-même sa demande ne reçoit pas de notification de refus", async () => {
    await rpc(l4, `select public.enroll_self($1,$2)`, [approvalCourse, session]);
    const id = await one(`select id from public.enrollments where learner_id = $1 and course_id = $2`, [l4, approvalCourse]);
    await rpc(l4, `select public.cancel_enrollment($1)`, [id]);
    const kinds = (await rpc<{ kind: string }>(l4, `select kind from public.notifications`)).map((n) => n.kind);
    expect(kinds).not.toContain("enrollment_declined");
  });
});

describe("inscription par code d'accès", () => {
  it("refuse un code absent ou erroné", async () => {
    await expect(rpc(l1, `select public.enroll_self($1)`, [codeCourse])).rejects.toThrow(/access_code_invalid/);
    await expect(rpc(l1, `select public.enroll_self($1, null, 'mauvais')`, [codeCourse])).rejects.toThrow(/access_code_invalid/);
  });

  it("accepte le bon code sans tenir compte de la casse", async () => {
    const [r] = await rpc<{ enroll_self: { status: string } }>(l1, `select public.enroll_self($1, null, ' secu-2026 ')`, [codeCourse]);
    expect(r.enroll_self.status).toBe("confirmed");
  });

  it("le code n'est lisible ni par un apprenant ni par un autre formateur, ni dans la fiche publique", async () => {
    expect(await rpc(l1, `select * from public.course_access_codes`)).toHaveLength(0);
    expect(await rpc(other, `select * from public.course_access_codes`)).toHaveLength(0);
    expect(await rpc(ins, `select * from public.course_access_codes`)).toHaveLength(1);
    const [d] = await rpc<{ d: Record<string, unknown> }>(null, `select public.public_course_detail('par-code') as d`);
    expect(d.d.enrollment_mode).toBe("code");
    expect(JSON.stringify(d.d)).not.toContain("SECU-2026");
  });

  it("l'inscription manuelle par le formateur n'exige pas le code", async () => {
    const s = await one(
      `insert into public.sessions (course_id, instructor_id, title, start_at, end_at, delivery_mode, location, capacity)
       values ($1, $2, 'S code', now() + interval '20 days', now() + interval '20 days 4 hours', 'onsite', 'Abidjan', 5) returning id`, [codeCourse, ins]);
    const [r] = await rpc<{ instructor_enroll_learner: { status: string } }>(ins, `select public.instructor_enroll_learner($1, 'l2@x.ci')`, [s]);
    expect(r.instructor_enroll_learner.status).toBe("confirmed");
  });
});
