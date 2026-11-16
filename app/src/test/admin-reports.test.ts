import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { REPORT_TYPES, REPORT_TYPE_KEYS, type ReportsOverview } from "../lib/admin/reports";
import { addUser, asUser, createTestDb, type TestDb } from "./pg-harness";

let db: TestDb;
let admin: string, ins: string, l1: string, l2: string, l3: string;
let course: string, course2: string, session: string;

const as = <T,>(u: string | null, fn: () => Promise<T>) => asUser(db, u, fn);
const overview = (u: string | null, month = "") => as(u, async () => (await db.query<{ r: ReportsOverview }>(`select public.admin_reports_overview($1) as r`, [month])).rows[0].r);
const rows = (u: string | null, type: string, month = "") => as(u, async () => (await db.query<{ r: (string | number)[][] }>(`select public.admin_report_rows($1, $2) as r`, [type, month])).rows[0].r);
const one = async <T,>(sql: string, p: unknown[] = []) => (await db.query<{ id: T }>(sql, p)).rows[0].id;
const enroll = (learner: string, c: string, s: string | null, status: string, at = "now()") =>
  one<string>(`insert into public.enrollments (learner_id, course_id, session_id, status, enrolled_at) values ($1, $2, $3, $4, ${at}) returning id`, [learner, c, s, status]);

beforeAll(async () => {
  db = await createTestDb();
  admin = await addUser(db, "admin@x.ci", ["admin"], "Claire Yao");
  ins = await addUser(db, "ins@x.ci", ["instructor"], "Koffi Jean");
  l1 = await addUser(db, "l1@x.ci", [], "Awa Konan");
  l2 = await addUser(db, "l2@x.ci", [], "Moussa Koné");
  l3 = await addUser(db, "l3@x.ci", [], "Fatou Bamba");
  course = await one<string>(`insert into public.courses (instructor_id, title, slug, status, price_amount) values ($1, 'SST Secourisme', 'sst', 'published', 35000) returning id`, [ins]);
  course2 = await one<string>(`insert into public.courses (instructor_id, title, slug, status) values ($1, 'Incendie', 'incendie', 'published') returning id`, [ins]);
  session = await one<string>(`insert into public.sessions (course_id, instructor_id, title, start_at, end_at, delivery_mode, capacity, status)
    values ($1, $2, 'SST du mois', now() - interval '1 hour', now() + interval '1 hour', 'online', 10, 'scheduled') returning id`, [course, ins]);
  const e1 = await enroll(l1, course, session, "completed");
  await enroll(l2, course, session, "confirmed");
  await enroll(l3, course2, null, "confirmed");
  await enroll(l3, course, null, "cancelled");
  await enroll(l1, course2, null, "confirmed", "now() - interval '40 days'");
  await db.query(`insert into public.attendance_records (session_id, learner_id, status) values ($1, $2, 'present'), ($1, $3, 'absent')`, [session, l1, l2]);
  await db.query(`insert into public.certificates (certificate_number, verification_token, enrollment_id, learner_id, course_id, content, issued_by)
    values ('SP-2026-000001', 'tok', $1, $2, $3, '{}'::jsonb, $4)`, [e1, l1, course, ins]);
  await db.query(`insert into public.payments (kind, learner_id, course_id, amount, method, status) values ('course', $1, $2, 100000, 'cash', 'confirmed')`, [l1, course]);
}, 120_000);
afterAll(async () => { await db.close(); });

describe("synthèse du mois", () => {
  it("compte les inscriptions du mois sans les annulées, ni celles des autres mois", async () => {
    const o = await overview(admin);
    expect(o.month).toMatch(/^\d{4}-\d{2}$/);
    expect(o.enrollments.value).toBe(3);
    expect(o.enrollments.prev).toBe(1);
    expect(o.sessions.value).toBe(1);
    expect(o.certifications.value).toBe(1);
    expect(o.revenue).toBe(100_000);
    expect(o.commissions).toMatchObject({ value: 15_000, rate: 15 });
    expect(o.active_learners.value).toBe(3);
  });

  it("calcule les taux de complétion et de présence", async () => {
    const o = await overview(admin);
    expect(o.completion_rate).toBe(25); // 1 terminée sur 4 inscriptions confirmées ou terminées (l'annulée est exclue)
    expect(o.attendance_rate).toBe(50);
    expect(o.evaluation_success_rate).toBeNull();
  });

  it("classe les formations par inscriptions et donne 6 mois d'évolution", async () => {
    const o = await overview(admin);
    expect(o.courses.map((c) => [c.title, c.count])).toEqual([["SST Secourisme", 2], ["Incendie", 1]]);
    expect(o.months).toHaveLength(6);
    expect(o.months.at(-1)!.count).toBe(3);
  });

  it("accepte un mois passé et refuse un format invalide", async () => {
    expect((await overview(admin, "1999-01")).enrollments.value).toBe(0);
    await expect(overview(admin, "2026-13")).rejects.toThrow(/month_invalid/);
  });
});

describe("lignes des rapports", () => {
  it("renvoie, pour chaque type, des lignes aux colonnes de l'en-tête", async () => {
    const counts: Record<string, number> = {};
    for (const type of REPORT_TYPE_KEYS) {
      const r = await rows(admin, type);
      counts[type] = r.length;
      for (const line of r) expect(line, `colonnes du rapport ${type}`).toHaveLength(REPORT_TYPES[type].headers.length);
    }
    expect(counts).toMatchObject({ inscriptions: 4, formations: 2, sessions: 1, apprenants: 3, certifications: 1, financier: 1, presences: 1 });
    expect(counts.evaluations).toBe(0);
  });

  it("détaille les inscriptions avec statut en français et sans accès hors période", async () => {
    const r = await rows(admin, "inscriptions");
    expect(r.some((l) => l[1] === "Awa Konan" && l[5] === "Terminée")).toBe(true);
    expect(r.some((l) => l[5] === "Annulée")).toBe(true);
    expect(await rows(admin, "inscriptions", "1999-01")).toHaveLength(0);
  });

  it("calcule remplissage et présence d'une session", async () => {
    expect((await rows(admin, "sessions"))[0].slice(5, 9)).toEqual([10, 2, 20, "Planifiée"]);
    expect((await rows(admin, "presences"))[0].slice(3)).toEqual([2, 1, 1, 50]);
  });

  it("refuse un type inconnu", async () => {
    await expect(rows(admin, "secret")).rejects.toThrow(/type_invalid/);
  });
});

describe("historique des rapports", () => {
  it("journalise un rapport généré et le liste du plus récent au plus ancien", async () => {
    await as(admin, async () => db.query(`select public.admin_log_report('inscriptions', '', 'Rapport des inscriptions – Oct. 2026', 4)`));
    await as(admin, async () => db.query(`select public.admin_log_report('financier', '2026-10', 'Rapport financier – Oct. 2026', 1)`));
    const recent = await as(admin, async () => (await db.query<{ r: { type: string; period: string; generated_by: string; row_count: number }[] }>(`select public.admin_recent_reports(5) as r`)).rows[0].r);
    expect(recent).toHaveLength(2);
    expect(recent[0]).toMatchObject({ type: "financier", period: "2026-10", generated_by: "Claire Yao", row_count: 1 });
    expect((await db.query(`select 1 from public.audit_logs where action = 'report.generate'`)).rows).toHaveLength(2);
    await expect(as(admin, async () => db.query(`select public.admin_log_report('inconnu', '', 'x y z', 0)`))).rejects.toThrow();
  });
});

describe("accès", () => {
  it("est réservé aux administrateurs", async () => {
    await expect(overview(ins)).rejects.toThrow(/forbidden/);
    await expect(rows(l1, "inscriptions")).rejects.toThrow(/forbidden/);
    await expect(as(ins, async () => db.query(`select public.admin_recent_reports(5)`))).rejects.toThrow(/forbidden/);
    await expect(as(ins, async () => db.query(`select public.admin_log_report('inscriptions', '', 'abc', 0)`))).rejects.toThrow(/forbidden/);
  });
});

describe("filtres du générateur", () => {
  const filtered = (u: string | null, f: { course?: string | null; session?: string | null; instructor?: string | null; status?: string }) => as(u, async () =>
    (await db.query<{ r: ReportsOverview }>(`select public.admin_reports_overview('', $1, $2, $3, $4) as r`, [f.course ?? null, f.session ?? null, f.instructor ?? null, f.status ?? ""])).rows[0].r);
  const rowsF = (type: string, f: { course?: string | null; session?: string | null; instructor?: string | null; status?: string }) => as(admin, async () =>
    (await db.query<{ r: (string | number)[][] }>(`select public.admin_report_rows($1, '', $2, $3, $4, $5) as r`, [type, f.course ?? null, f.session ?? null, f.instructor ?? null, f.status ?? ""])).rows[0].r);

  it("restreint la synthèse à une formation, une session ou un formateur", async () => {
    expect((await filtered(admin, { course: course })).enrollments.value).toBe(2);
    expect((await filtered(admin, { course: course2 })).enrollments.value).toBe(1);
    const bySession = await filtered(admin, { session });
    expect(bySession.enrollments.value).toBe(2);
    expect(bySession.sessions.value).toBe(1);
    expect((await filtered(admin, { instructor: ins })).enrollments.value).toBe(3);
    const none = await filtered(admin, { instructor: l1 });
    expect(none).toMatchObject({ enrollments: { value: 0 }, sessions: { value: 0 }, revenue: 0, completion_rate: null });
    expect(none.by_course).toEqual([]);
    expect((await filtered(admin, { course: course2 })).revenue).toBe(0);
    expect((await filtered(admin, { course })).revenue).toBe(100_000);
  });

  it("filtre les inscriptions par statut et refuse un statut inconnu", async () => {
    expect((await filtered(admin, { status: "completed" })).enrollments.value).toBe(1);
    expect((await filtered(admin, { status: "cancelled" })).enrollments.value).toBe(1);
    await expect(filtered(admin, { status: "banni" })).rejects.toThrow(/status_invalid/);
  });

  it("détaille chaque formation : sessions, inscriptions, taux", async () => {
    const o = await filtered(admin, {});
    const sst = o.by_course.find((c) => c.title === "SST Secourisme")!;
    expect(sst).toMatchObject({ count: 2, sessions: 1, completion: 50, success: null });
    expect(o.by_course.map((c) => c.title)).toEqual(["SST Secourisme", "Incendie"]);
    expect(o.courses.map((c) => c.title)).toEqual(["SST Secourisme", "Incendie"]);
    expect(o.evaluations).toEqual({ results: 0, passed: 0 });
  });

  it("filtre les lignes des rapports", async () => {
    expect(await rowsF("inscriptions", { course })).toHaveLength(3);
    expect(await rowsF("inscriptions", { course, status: "cancelled" })).toHaveLength(1);
    expect(await rowsF("inscriptions", { session })).toHaveLength(2);
    expect(await rowsF("financier", { course: course2 })).toHaveLength(0);
    expect(await rowsF("financier", { course })).toHaveLength(1);
    expect(await rowsF("sessions", { instructor: l1 })).toHaveLength(0);
    expect(await rowsF("sessions", { instructor: ins })).toHaveLength(1);
    expect(await rowsF("certifications", { course: course2 })).toHaveLength(0);
    expect(await rowsF("formations", { course })).toHaveLength(1);
    await expect(rowsF("inscriptions", { status: "banni" })).rejects.toThrow(/status_invalid/);
  });

  it("garde format, description et paramètres d'un rapport généré", async () => {
    const id = (await as(admin, async () => (await db.query<{ r: string }>(
      `select public.admin_log_report('sessions', '2026-10', 'Rapport des sessions – Oct. 2026', 3, 'pdf', $1::jsonb, 'Synthèse du mois') as r`,
      [JSON.stringify({ filters: { course }, indicators: ["ca"] })])).rows[0].r));
    const run = (await db.query<{ format: string; description: string; params: { filters: { course: string }; indicators: string[] } }>(`select format, description, params from public.report_runs where id = $1`, [id])).rows[0];
    expect(run).toMatchObject({ format: "pdf", description: "Synthèse du mois" });
    expect(run.params.filters.course).toBe(course);
    const recent = await as(admin, async () => (await db.query<{ r: { id: string; format: string }[] }>(`select public.admin_recent_reports(10) as r`)).rows[0].r);
    expect(recent.find((r) => r.id === id)!.format).toBe("pdf");
    await expect(as(admin, async () => db.query(`select public.admin_log_report('sessions', '', 'abc', 0, 'doc')`))).rejects.toThrow();
  });
});
