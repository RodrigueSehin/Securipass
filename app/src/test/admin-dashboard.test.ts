import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { addUser, asUser, createTestDb, type TestDb } from "./pg-harness";

let db: TestDb;
let admin: string, ins: string, learner: string;

type Dash = {
  users: { active: number; month: number }; enrollments: { total: number; month: number }; courses: { published: number; in_review: number };
  sessions: { upcoming: number }; certificates: { total: number }; support: { open: number; new: number };
  series: Record<string, number[]>; roles: Record<string, number>;
};
const dash = (u: string | null) => asUser(db, u, async () => (await db.query<{ admin_dashboard: Dash }>(`select public.admin_dashboard()`)).rows[0].admin_dashboard);

beforeAll(async () => {
  db = await createTestDb();
  admin = await addUser(db, "admin@x.ci", ["admin"]);
  ins = await addUser(db, "ins@x.ci", ["instructor"]);
  learner = await addUser(db, "l@x.ci");
  await addUser(db, "ent@x.ci", ["company"]);
  const c = (await db.query<{ id: string }>(`insert into public.courses (instructor_id, title, slug, status, published_at, price_amount) values ($1, 'A', 'a', 'published', now(), 0) returning id`, [ins])).rows[0].id;
  await db.query(`insert into public.courses (instructor_id, title, slug, status) values ($1, 'B', 'b', 'in_review')`, [ins]);
  await db.query(`insert into public.enrollments (learner_id, course_id, status) values ($1, $2, 'confirmed')`, [learner, c]);
  await db.query(`insert into public.sessions (course_id, instructor_id, title, start_at, end_at, delivery_mode, location, capacity)
    values ($1, $2, 'Session', now() + interval '3 days', now() + interval '3 days 2 hours', 'onsite', 'Abidjan', 10)`, [c, ins]);
  await db.query(`insert into public.public_requests (kind, full_name, email, message) values ('contact', 'Awa Koné', 'awa@x.ci', 'Bonjour, une question sur les formations')`);
}, 120_000);
afterAll(async () => { await db.close(); });

describe("admin_dashboard", () => {
  it("renvoie les totaux de la plateforme au personnel", async () => {
    const d = await dash(admin);
    expect(d.users.active).toBe(4);
    expect(d.users.month).toBe(4);
    expect(d.enrollments).toMatchObject({ total: 1, month: 1 });
    expect(d.courses).toMatchObject({ published: 1, in_review: 1 });
    expect(d.sessions.upcoming).toBe(1);
    expect(d.support).toMatchObject({ open: 1, new: 1 });
  });

  it("donne 12 mois par série, le dernier étant le mois courant", async () => {
    const d = await dash(admin);
    for (const key of ["users", "enrollments", "courses", "sessions", "certificates", "support"]) expect(d.series[key]).toHaveLength(12);
    expect(d.series.users[11]).toBe(4);
    expect(d.series.enrollments[11]).toBe(1);
    expect(d.series.enrollments.slice(0, 11).every((n) => n === 0)).toBe(true);
  });

  it("répartit chaque compte actif une seule fois", async () => {
    const d = await dash(admin);
    expect(d.roles).toEqual({ admin: 1, instructor: 1, company: 1, other: 0, learner: 1 });
    expect(Object.values(d.roles).reduce((a, b) => a + b, 0)).toBe(d.users.active);
  });

  it("est refusé aux formateurs, aux apprenants et aux anonymes", async () => {
    await expect(dash(ins)).rejects.toThrow(/forbidden/);
    await expect(dash(learner)).rejects.toThrow(/forbidden/);
    await expect(dash(null)).rejects.toThrow();
  });
});
