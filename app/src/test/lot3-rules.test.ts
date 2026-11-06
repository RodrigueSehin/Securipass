import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { addUser, asUser, createTestDb, type TestDb } from "./pg-harness";

let db: TestDb;
let ins: string, other: string, la: string, lb: string, lc: string;
let course: string, content: string, draftContent: string, session: string, evalId: string, q1: string, q2: string;

const one = async (sql: string, p: unknown[] = []) => (await db.query<{ id: string }>(sql, p)).rows[0]?.id;
const as = <T,>(u: string | null, fn: () => Promise<T>) => asUser(db, u, fn);
const rows = async <T = Record<string, unknown>>(u: string | null, sql: string, p: unknown[] = []) =>
  as(u, async () => (await db.query<T>(sql, p)).rows);

beforeAll(async () => {
  db = await createTestDb();
  ins = await addUser(db, "ins@x.ci", ["instructor"]);
  other = await addUser(db, "other@x.ci", ["instructor"]);
  la = await addUser(db, "la@x.ci");
  lb = await addUser(db, "lb@x.ci");
  lc = await addUser(db, "lc@x.ci");

  course = await one(
    `insert into public.courses (instructor_id, category_id, title, slug, status, published_at, duration_minutes)
     values ($1, (select id from public.categories limit 1), 'Formation test', 'formation-test', 'published', now(), 60) returning id`, [ins]);
  const mod = await one(`insert into public.course_modules (course_id, title, position) values ($1, 'Module 1', 1) returning id`, [course]);
  content = await one(
    `insert into public.learning_contents (module_id, title, content_type, body, status, duration_minutes, position)
     values ($1, 'Leçon publiée', 'text', 'Texte', 'published', 20, 1) returning id`, [mod]);
  draftContent = await one(
    `insert into public.learning_contents (module_id, title, content_type, body, status, duration_minutes, position)
     values ($1, 'Brouillon', 'text', 'Texte', 'draft', 10, 2) returning id`, [mod]);

  session = await one(
    `insert into public.sessions (course_id, instructor_id, title, start_at, end_at, delivery_mode, location, capacity)
     values ($1, $2, 'Session A', now() + interval '10 days', now() + interval '10 days 4 hours', 'onsite', 'Abidjan', 10) returning id`,
    [course, ins]);
  await db.query(`insert into public.enrollments (learner_id, course_id, session_id, status) values ($1, $2, $3, 'confirmed')`, [la, course, session]);
}, 120_000);
afterAll(async () => { await db.close(); });

describe("progression", () => {
  it("un inscrit peut marquer une leçon publiée comme terminée", async () => {
    await as(la, () => db.query(`select set_content_completed($1, true)`, [content]));
    const r = await rows(la, `select content_id from public.content_completions`);
    expect(r.map((x) => x.content_id)).toContain(content);
  });
  it("un non-inscrit ne peut pas marquer de leçon", async () => {
    await expect(as(lb, () => db.query(`select set_content_completed($1, true)`, [content]))).rejects.toThrow(/not_enrolled|content_not_available/);
  });
  it("un brouillon ne peut pas être marqué", async () => {
    await expect(as(la, () => db.query(`select set_content_completed($1, true)`, [draftContent]))).rejects.toThrow(/content_not_available/);
  });
  it("l'apprenant ne voit que sa propre progression", async () => {
    await as(la, () => db.query(`select set_content_completed($1, true)`, [content]));
    const mine = await rows(lb, `select * from public.content_completions`);
    expect(mine).toHaveLength(0);
  });
  it("décocher retire la progression", async () => {
    await as(la, () => db.query(`select set_content_completed($1, false)`, [content]));
    expect(await rows(la, `select * from public.content_completions`)).toHaveLength(0);
  });
});

describe("notifications", () => {
  it("l'inscription confirmée crée une notification pour l'apprenant", async () => {
    const r = await rows(la, `select kind, title from public.notifications`);
    expect(r.map((x) => x.kind)).toContain("enrollment_confirmed");
  });
  it("une modification de session notifie les inscrits confirmés", async () => {
    await db.query(`update public.sessions set location = 'Salle 2' where id = $1`, [session]);
    const r = await rows(la, `select kind from public.notifications`);
    expect(r.map((x) => x.kind)).toContain("session_changed");
  });
  it("une annulation de session notifie les inscrits (session distincte, pour garder la suite intacte)", async () => {
    const s2 = await one(
      `insert into public.sessions (course_id, instructor_id, title, start_at, end_at, delivery_mode, location, capacity)
       values ($1, $2, 'Session annulée', now() + interval '20 days', now() + interval '20 days 4 hours', 'onsite', 'Abidjan', 10) returning id`,
      [course, ins]);
    await db.query(`insert into public.enrollments (learner_id, course_id, session_id, status) values ($1, $2, $3, 'confirmed')`, [lc, course, s2]);
    await db.query(`update public.sessions set status = 'cancelled' where id = $1`, [s2]);
    const r = await rows(lc, `select kind from public.notifications`);
    expect(r.map((x) => x.kind)).toContain("session_cancelled");
    expect(await rows(lc, `select status from public.enrollments`)).toEqual([{ status: "cancelled" }]);
  });
  it("une modification sans changement d'horaire ni de lieu ne notifie pas", async () => {
    const before = (await rows(la, `select count(*)::int as n from public.notifications`))[0].n;
    await db.query(`update public.sessions set title = 'Session A bis' where id = $1`, [session]);
    const after = (await rows(la, `select count(*)::int as n from public.notifications`))[0].n;
    expect(after).toBe(before);
  });
  it("chaque apprenant ne lit que ses notifications", async () => {
    expect(await rows(lb, `select * from public.notifications where recipient_id = $1`, [la])).toHaveLength(0);
  });
  it("le destinataire peut marquer comme lu, mais ne peut pas réécrire le contenu", async () => {
    await expect(as(la, () => db.query(`update public.notifications set title = 'Triche'`))).rejects.toThrow(/notification_read_only/);
    const n = await as(la, async () => (await db.query<{ n: number }>(`select public.mark_notifications_read() as n`)).rows[0].n);
    expect(n).toBeGreaterThan(0);
    const unread = await rows(la, `select * from public.notifications where read_at is null`);
    expect(unread).toHaveLength(0);
  });
  it("une inscription en liste d'attente puis promue notifie", async () => {
    const w = await addUser(db, "wait@x.ci");
    await db.query(`insert into public.enrollments (learner_id, course_id, session_id, status) values ($1, $2, $3, 'waitlisted')`, [w, course, session]);
    await db.query(`update public.enrollments set status = 'confirmed' where learner_id = $1`, [w]);
    const r = await rows(w, `select kind from public.notifications`);
    expect(r.map((x) => x.kind)).toEqual(expect.arrayContaining(["enrollment_waitlisted", "waitlist_promoted"]));
  });
});

describe("présences", () => {
  it("le formateur de la session inscrit une présence avec sa trace", async () => {
    await as(ins, () => db.query(`insert into public.attendance_records (session_id, learner_id, status) values ($1, $2, 'present')`, [session, la]));
    const r = await rows(ins, `select recorded_by, updated_by from public.attendance_records where learner_id = $1`, [la]);
    expect(r[0].recorded_by).toBe(ins);
  });
  it("l'apprenant lit sa présence, pas celle des autres", async () => {
    expect(await rows(la, `select status from public.attendance_records`)).toHaveLength(1);
    expect(await rows(lb, `select status from public.attendance_records`)).toHaveLength(0);
  });
  it("un autre formateur ne peut pas saisir ces présences", async () => {
    // RLS filtre la ligne : la mise à jour ne touche rien, sans erreur
    await as(other, () => db.query(`update public.attendance_records set status = 'absent'`));
    expect(await rows(la, `select status from public.attendance_records`)).toEqual([{ status: "present" }]);
  });
  it("on ne peut pas pointer un non-inscrit", async () => {
    await expect(db.query(`insert into public.attendance_records (session_id, learner_id, status) values ($1, $2, 'present')`, [session, other])).rejects.toThrow(/learner_not_in_session/);
  });
});

describe("évaluations", () => {
  beforeAll(async () => {
    evalId = await one(
      `insert into public.evaluations (course_id, title, status, max_attempts, passing_score)
       values ($1, 'Quiz 1', 'draft', 2, 50) returning id`, [course]);
    q1 = await one(
      `insert into public.evaluation_questions (evaluation_id, position, prompt, kind, options, points)
       values ($1, 1, 'Capitale ?', 'single', '[{"id":"a","label":"Abidjan"},{"id":"b","label":"Yamoussoukro"}]', 1) returning id`, [evalId]);
    q2 = await one(
      `insert into public.evaluation_questions (evaluation_id, position, prompt, kind, options, points)
       values ($1, 2, 'Pairs ?', 'multiple', '[{"id":"x","label":"2"},{"id":"y","label":"3"},{"id":"z","label":"4"}]', 1) returning id`, [evalId]);
    await db.query(`insert into public.evaluation_answer_keys (question_id, correct_option_ids) values ($1, '{b}'), ($2, '{x,z}')`, [q1, q2]);
  });

  it("une évaluation en brouillon n'est pas visible de l'apprenant", async () => {
    expect(await rows(la, `select id from public.evaluations`)).toHaveLength(0);
  });

  it("publier l'évaluation notifie les inscrits", async () => {
    await db.query(`update public.evaluations set status = 'published' where id = $1`, [evalId]);
    expect(await rows(la, `select kind from public.notifications where kind = 'evaluation_available'`)).toHaveLength(1);
  });

  it("l'apprenant ne peut pas lire les bonnes réponses", async () => {
    expect(await rows(la, `select * from public.evaluation_answer_keys`)).toHaveLength(0);
  });

  it("un non-inscrit ne peut pas démarrer l'évaluation", async () => {
    await expect(as(lb, () => db.query(`select public.start_evaluation($1)`, [evalId]))).rejects.toThrow(/evaluation_not_available/);
  });

  it("notation : bonne réponse exacte, mauvaise réponse sur la question à choix multiples", async () => {
    const attempt = await as(la, async () => (await db.query<{ id: string }>(`select public.start_evaluation($1) as id`, [evalId])).rows[0].id);
    const again = await as(la, async () => (await db.query<{ id: string }>(`select public.start_evaluation($1) as id`, [evalId])).rows[0].id);
    expect(again).toBe(attempt); // reprise de la tentative en cours

    const res = await as(la, async () => (await db.query<{ r: { score_percent: number; passed: boolean } }>(
      `select public.submit_evaluation($1, $2::jsonb) as r`,
      [attempt, JSON.stringify({ [q1]: ["b"], [q2]: ["x"] })])).rows[0].r);
    expect(res.score_percent).toBe(50);
    expect(res.passed).toBe(true); // seuil 50 %
  });

  it("une tentative soumise ne peut pas être resoumise", async () => {
    const id = (await db.query<{ id: string }>(`select id from public.evaluation_attempts where learner_id = $1`, [la])).rows[0].id;
    await expect(as(la, () => db.query(`select public.submit_evaluation($1, '{}'::jsonb)`, [id]))).rejects.toThrow(/attempt_already_submitted/);
  });

  it("la limite de tentatives est appliquée", async () => {
    const second = await as(la, async () => (await db.query<{ id: string }>(`select public.start_evaluation($1) as id`, [evalId])).rows[0].id);
    await as(la, () => db.query(`select public.submit_evaluation($1, '{}'::jsonb)`, [second]));
    await expect(as(la, () => db.query(`select public.start_evaluation($1)`, [evalId]))).rejects.toThrow(/no_attempt_left/);
  });

  it("une tentative dépassée est close sans notation", async () => {
    await db.query(`update public.evaluations set max_attempts = 5 where id = $1`, [evalId]);
    const t = await as(la, async () => (await db.query<{ id: string }>(`select public.start_evaluation($1) as id`, [evalId])).rows[0].id);
    await db.query(`update public.evaluation_attempts set deadline_at = now() - interval '1 minute' where id = $1`, [t]);
    const res = await as(la, async () => (await db.query<{ r: { status: string } }>(`select public.submit_evaluation($1, '{}'::jsonb) as r`, [t])).rows[0].r);
    expect(res.status).toBe("expired");
  });

  it("un apprenant ne voit pas les tentatives des autres", async () => {
    expect(await rows(lb, `select * from public.evaluation_attempts`)).toHaveLength(0);
  });
});

describe("planification des évaluations", () => {
  it("une évaluation pas encore ouverte est listée, mais ni ouverte, ni ses questions, ni démarrable", async () => {
    const e = await one(
      `insert into public.evaluations (course_id, title, status, available_at)
       values ($1, 'Examen à venir', 'published', now() + interval '3 days') returning id`, [course]);
    await db.query(`insert into public.evaluation_questions (evaluation_id, prompt, options) values ($1, 'Question future ?', '[{"id":"a","label":"A"},{"id":"b","label":"B"}]')`, [e]);

    expect(await rows(la, `select id from public.evaluations where id = $1`, [e])).toHaveLength(1);
    expect(await rows(la, `select id from public.evaluation_questions where evaluation_id = $1`, [e])).toHaveLength(0);
    await expect(as(la, () => db.query(`select public.start_evaluation($1)`, [e]))).rejects.toThrow(/evaluation_not_available/);

    await db.query(`update public.evaluations set available_at = now() - interval '1 minute' where id = $1`, [e]);
    expect(await rows(la, `select id from public.evaluation_questions where evaluation_id = $1`, [e])).toHaveLength(1);
    const attempt = await as(la, async () => (await db.query<{ id: string }>(`select public.start_evaluation($1) as id`, [e])).rows[0].id);
    expect(attempt).toBeTruthy();
  });

  it("une ouverture postérieure à l'échéance est refusée", async () => {
    await expect(db.query(
      `insert into public.evaluations (course_id, title, status, available_at, due_at)
       values ($1, 'Fenêtre inversée', 'draft', now() + interval '5 days', now() + interval '2 days')`, [course])).rejects.toThrow(/evaluations_window/);
  });
});
