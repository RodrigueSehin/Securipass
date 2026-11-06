import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { addUser, asUser, createTestDb, type TestDb } from "./pg-harness";

let db: TestDb;
let ins: string, finished: string, partial: string, stranger: string;
let course: string, lesson1: string, lesson2: string, draftCourse: string;

const one = async (sql: string, p: unknown[] = []) => (await db.query<{ id: string }>(sql, p)).rows[0]?.id;
const as = <T,>(u: string | null, fn: () => Promise<T>) => asUser(db, u, fn);

beforeAll(async () => {
  db = await createTestDb();
  ins = await addUser(db, "ins@x.ci", ["instructor"]);
  finished = await addUser(db, "finished@x.ci");
  partial = await addUser(db, "partial@x.ci");
  stranger = await addUser(db, "stranger@x.ci");

  const insertCourse = (slug: string, status: string) => one(
    `insert into public.courses (instructor_id, category_id, title, slug, status, published_at, duration_minutes)
     values ($1, (select id from public.categories limit 1), $2, $2, $3, now(), 60) returning id`, [ins, slug, status]);
  course = await insertCourse("avis-test", "published");
  draftCourse = await insertCourse("avis-brouillon", "draft");

  const mod = await one(`insert into public.course_modules (course_id, title, position) values ($1, 'Module 1', 1) returning id`, [course]);
  const lesson = (title: string, position: number) => one(
    `insert into public.learning_contents (module_id, title, content_type, body, status, duration_minutes, position)
     values ($1, $2, 'text', 'Texte', 'published', 10, $3) returning id`, [mod, title, position]);
  lesson1 = await lesson("Leçon 1", 1);
  lesson2 = await lesson("Leçon 2", 2);

  for (const u of [finished, partial]) {
    await db.query(`insert into public.enrollments (learner_id, course_id, status) values ($1, $2, 'confirmed')`, [u, course]);
  }
  for (const l of [lesson1, lesson2]) await db.query(`insert into public.content_completions (learner_id, content_id) values ($1, $2)`, [finished, l]);
  await db.query(`insert into public.content_completions (learner_id, content_id) values ($1, $2)`, [partial, lesson1]);
}, 120_000);
afterAll(async () => { await db.close(); });

const review = (user: string, rating: number, comment: string | null = null) =>
  as(user, () => db.query(`insert into public.course_reviews (course_id, learner_id, rating, comment) values ($1, $2, $3, $4)`, [course, user, rating, comment]));

describe("avis sur une formation", () => {
  it("un apprenant ayant terminé toutes les leçons peut donner son avis", async () => {
    await review(finished, 5, "Très bien");
    const r = await as(finished, async () => (await db.query<{ rating: number }>(`select rating from public.course_reviews`)).rows);
    expect(r).toEqual([{ rating: 5 }]);
  });

  it("un apprenant qui n'a pas terminé la formation ne peut pas noter", async () => {
    await expect(review(partial, 4)).rejects.toThrow();
  });

  it("une personne non inscrite ne peut pas noter", async () => {
    await expect(review(stranger, 4)).rejects.toThrow();
  });

  it("une note hors de 1 à 5 est refusée et un seul avis par apprenant est accepté", async () => {
    await expect(review(finished, 6)).rejects.toThrow();
    await expect(review(finished, 3)).rejects.toThrow();
  });

  it("l'apprenant peut modifier son avis, pas celui d'un autre", async () => {
    await as(finished, () => db.query(`update public.course_reviews set rating = 4 where course_id = $1`, [course]));
    const mine = await as(finished, async () => (await db.query<{ rating: number }>(`select rating from public.course_reviews`)).rows);
    expect(mine[0].rating).toBe(4);
    await as(partial, () => db.query(`update public.course_reviews set rating = 1 where course_id = $1`, [course]));
    const after = await as(finished, async () => (await db.query<{ rating: number }>(`select rating from public.course_reviews`)).rows);
    expect(after[0].rating).toBe(4);
  });

  it("les avis ne sont lisibles que par leur auteur, le formateur de la formation et le personnel", async () => {
    expect(await as(partial, async () => (await db.query(`select * from public.course_reviews`)).rows)).toHaveLength(0);
    expect(await as(stranger, async () => (await db.query(`select * from public.course_reviews`)).rows)).toHaveLength(0);
    expect(await as(ins, async () => (await db.query(`select * from public.course_reviews`)).rows)).toHaveLength(1);
  });

  it("la note moyenne est publique pour une formation publiée, jamais pour un brouillon", async () => {
    const stats = await as(null, async () =>
      (await db.query<{ average: string; total: number }>(`select average, total from public.course_rating_stats(array[$1::uuid, $2::uuid])`, [course, draftCourse])).rows);
    expect(stats).toHaveLength(1);
    expect(Number(stats[0].average)).toBe(4);
    expect(stats[0].total).toBe(1);
  });
});
