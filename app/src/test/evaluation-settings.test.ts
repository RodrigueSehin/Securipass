import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { addUser, asUser, createTestDb, type TestDb } from "./pg-harness";

let db: TestDb;
let ins: string, other: string, la: string, lb: string, lc: string;
let course: string, content: string, quiz: string, devoir: string, enrollA: string, enrollB: string, enrollC: string;

const one = async (sql: string, p: unknown[] = []) => (await db.query<{ id: string }>(sql, p)).rows[0]?.id;
const as = <T,>(u: string | null, fn: () => Promise<T>) => asUser(db, u, fn);
const rows = <T = Record<string, unknown>>(u: string | null, sql: string, p: unknown[] = []) => as(u, async () => (await db.query<T>(sql, p)).rows);
const eligibility = async (enrollment: string) =>
  (await rows<{ r: { eligible: boolean; reasons: string[] } }>(ins, `select public.certificate_eligibility($1) as r`, [enrollment]))[0].r;

const setAttempt = (learner: string, evaluation: string, score: number) =>
  db.query(
    `insert into public.evaluation_attempts (evaluation_id, learner_id, submitted_at, score_percent, passed)
     values ($1, $2, now(), $3, $3 >= (select passing_score from public.evaluations where id = $1))`, [evaluation, learner, score]);

beforeAll(async () => {
  db = await createTestDb();
  ins = await addUser(db, "ins@x.ci", ["instructor"]);
  other = await addUser(db, "other@x.ci", ["instructor"]);
  la = await addUser(db, "la@x.ci");
  lb = await addUser(db, "lb@x.ci");
  lc = await addUser(db, "lc@x.ci");
  course = await one(
    `insert into public.courses (instructor_id, category_id, title, slug, status, published_at, duration_minutes, pass_mark_percent)
     values ($1, (select id from public.categories limit 1), 'Évaluation test', 'eval-test', 'published', now(), 30, 70) returning id`, [ins]);
  const mod = await one(`insert into public.course_modules (course_id, title, position) values ($1, 'Module', 1) returning id`, [course]);
  content = await one(
    `insert into public.learning_contents (module_id, title, content_type, body, status, duration_minutes, position)
     values ($1, 'Leçon', 'text', 'Texte', 'published', 10, 1) returning id`, [mod]);
  // Quiz (60 %) à 50 % minimum et devoir noté par le formateur (40 %) à 50 % minimum
  quiz = await one(
    `insert into public.evaluations (course_id, title, kind, weight_percent, passing_score, max_attempts, status)
     values ($1, 'Quiz', 'quiz', 60, 50, 1, 'published') returning id`, [course]);
  devoir = await one(
    `insert into public.evaluations (course_id, title, kind, weight_percent, passing_score, max_attempts, status)
     values ($1, 'Devoir', 'assignment', 40, 50, 1, 'published') returning id`, [course]);
  enrollA = await one(`insert into public.enrollments (learner_id, course_id, status) values ($1, $2, 'confirmed') returning id`, [la, course]);
  enrollB = await one(`insert into public.enrollments (learner_id, course_id, status) values ($1, $2, 'confirmed') returning id`, [lb, course]);
  enrollC = await one(`insert into public.enrollments (learner_id, course_id, status) values ($1, $2, 'confirmed') returning id`, [lc, course]);
  for (const l of [la, lb, lc]) await db.query(`insert into public.content_completions (learner_id, content_id) values ($1, $2)`, [l, content]);
}, 120_000);
afterAll(async () => { await db.close(); });

describe("notes saisies par le formateur", () => {
  it("le formateur de la formation note un inscrit, un autre formateur non", async () => {
    await as(ins, () => db.query(`insert into public.evaluation_grades (evaluation_id, learner_id, score_percent) values ($1, $2, 80)`, [devoir, la]));
    await expect(as(other, () => db.query(`insert into public.evaluation_grades (evaluation_id, learner_id, score_percent) values ($1, $2, 90)`, [devoir, lb]))).rejects.toThrow();
  });

  it("un quiz ne peut pas être noté à la main", async () => {
    await expect(as(ins, () => db.query(`insert into public.evaluation_grades (evaluation_id, learner_id, score_percent) values ($1, $2, 90)`, [quiz, la]))).rejects.toThrow();
  });

  it("une personne non inscrite ne peut pas être notée", async () => {
    const stranger = await addUser(db, "stranger@x.ci");
    await expect(as(ins, () => db.query(`insert into public.evaluation_grades (evaluation_id, learner_id, score_percent) values ($1, $2, 90)`, [devoir, stranger]))).rejects.toThrow();
  });

  it("l'apprenant voit sa note et est notifié, pas celle des autres ; il ne peut pas se noter", async () => {
    expect(await rows(la, `select score_percent from public.evaluation_grades`)).toEqual([{ score_percent: 80 }]);
    expect(await rows(lb, `select * from public.evaluation_grades`)).toHaveLength(0);
    await expect(as(la, () => db.query(`update public.evaluation_grades set score_percent = 100 where learner_id = $1`, [la]))).resolves.toBeDefined();
    expect(await rows(la, `select score_percent from public.evaluation_grades`)).toEqual([{ score_percent: 80 }]);
    const kinds = (await rows<{ kind: string }>(la, `select kind from public.notifications`)).map((n) => n.kind);
    expect(kinds).toContain("evaluation_result");
  });
});

describe("éligibilité : activités notées et note minimale", () => {
  it("il faut réussir chaque activité (quiz et devoir)", async () => {
    expect((await eligibility(enrollA)).reasons).toContain("evaluations_not_passed");
    await setAttempt(la, quiz, 90);
    const r = await eligibility(enrollA);
    expect(r.reasons).not.toContain("evaluations_not_passed");
    expect(r.eligible).toBe(true); // moyenne pondérée : 0,6 × 90 + 0,4 × 80 = 86 ≥ 70
  });

  it("chaque activité est réussie mais la moyenne pondérée reste sous la note minimale", async () => {
    await setAttempt(lb, quiz, 55);
    await as(ins, () => db.query(`insert into public.evaluation_grades (evaluation_id, learner_id, score_percent) values ($1, $2, 55)`, [devoir, lb]));
    const r = await eligibility(enrollB);
    expect(r.reasons).toEqual(["pass_mark_not_reached"]); // 55 < 70
    expect(r.eligible).toBe(false);
  });

  it("une activité sans note compte pour zéro dans la moyenne", async () => {
    await setAttempt(lc, quiz, 100);
    const r = await eligibility(enrollC);
    expect(r.reasons).toContain("evaluations_not_passed");
    expect(r.reasons).toContain("pass_mark_not_reached"); // 0,6 × 100 = 60 < 70
  });

  it("sans pondération, seule la réussite de chaque activité compte", async () => {
    await db.query(`update public.evaluations set weight_percent = 0 where course_id = $1`, [course]);
    expect((await eligibility(enrollB)).reasons).toEqual([]);
    await db.query(`update public.evaluations set weight_percent = case kind when 'quiz' then 60 else 40 end where course_id = $1`, [course]);
  });
});

describe("réglages de la formation", () => {
  it("désactiver l'évaluation ignore les activités et les masque aux apprenants", async () => {
    await db.query(`update public.courses set evaluation_enabled = false where id = $1`, [course]);
    expect((await eligibility(enrollC)).reasons).toEqual([]);
    expect(await rows(lc, `select id from public.evaluations`)).toHaveLength(0);
    await db.query(`update public.courses set evaluation_enabled = true where id = $1`, [course]);
    expect(await rows(lc, `select id from public.evaluations`)).toHaveLength(2);
  });

  it("désactiver le certificat bloque l'éligibilité", async () => {
    await db.query(`update public.courses set certificate_enabled = false where id = $1`, [course]);
    expect((await eligibility(enrollA)).reasons).toContain("certificates_disabled");
    await db.query(`update public.courses set certificate_enabled = true where id = $1`, [course]);
  });

  it("le rattrapage ajoute une tentative", async () => {
    const q = await one(
      `insert into public.evaluations (course_id, title, kind, max_attempts, passing_score, status)
       values ($1, 'Quiz court', 'quiz', 1, 50, 'published') returning id`, [course]);
    const question = await one(
      `insert into public.evaluation_questions (evaluation_id, prompt, options) values ($1, 'Question ?', '[{"id":"a","label":"A"},{"id":"b","label":"B"}]') returning id`, [q]);
    await db.query(`insert into public.evaluation_answer_keys (question_id, correct_option_ids) values ($1, '{a}')`, [question]);
    const attempt = (await rows<{ start_evaluation: string }>(la, `select public.start_evaluation($1)`, [q]))[0].start_evaluation;
    await rows(la, `select public.submit_evaluation($1, '{}'::jsonb)`, [attempt]);
    await expect(rows(la, `select public.start_evaluation($1)`, [q])).rejects.toThrow(/no_attempt_left/);
    await db.query(`update public.courses set allow_retake = true where id = $1`, [course]);
    await expect(rows(la, `select public.start_evaluation($1)`, [q])).resolves.toHaveLength(1);
    const second = (await rows<{ start_evaluation: string }>(la, `select public.start_evaluation($1)`, [q]))[0].start_evaluation;
    await rows(la, `select public.submit_evaluation($1, '{}'::jsonb)`, [second]);
    await expect(rows(la, `select public.start_evaluation($1)`, [q])).rejects.toThrow(/no_attempt_left/);
  });

  it("un devoir n'est pas un quiz : il n'a ni questions ni tentatives", async () => {
    await expect(rows(la, `select public.start_evaluation($1)`, [devoir])).rejects.toThrow(/evaluation_not_available/);
  });
});

describe("certificat : intitulé, description et éléments imprimés", () => {
  it("l'intitulé et la description de la formation servent de valeurs par défaut", async () => {
    const template = await one(`select id from public.certificate_templates where layout = 'classic'`);
    await db.query(`update public.courses set certificate_title = 'Certificat de réussite – {{formation}}', certificate_description = 'Atteste que {{apprenant}} a réussi.', certificate_display = array['holder_name','qr'] where id = $1`, [course]);
    await db.query(`update public.evaluations set status = 'archived' where course_id = $1 and title <> 'Quiz court'`, [course]);
    await db.query(`update public.evaluations set status = 'archived' where title = 'Quiz court'`);
    const r = await rows<{ r: { id: string } }>(ins, `select public.issue_certificate($1, $2, '{}'::jsonb) as r`, [enrollA, template]);
    const [cert] = await rows<{ content: { title: string; body: string; display: string[] } }>(ins, `select content from public.certificates where id = $1`, [r[0].r.id]);
    expect(cert.content.title).toBe("Certificat de réussite – Évaluation test");
    expect(cert.content.body).toBe("Atteste que la a réussi."); // « la » : nom du profil de test
    expect(cert.content.display).toEqual(["holder_name", "qr"]);
  });
});
