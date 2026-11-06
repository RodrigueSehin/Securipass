import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { addUser, asUser, createTestDb, type TestDb } from "./pg-harness";

let db: TestDb;
let ins: string, other: string, enrolled: string, stranger: string, admin: string;
let course: string, moduleId: string, resource: string;

const one = async (sql: string, p: unknown[] = []) => (await db.query<{ id: string }>(sql, p)).rows[0]?.id;
const as = <T,>(u: string | null, fn: () => Promise<T>) => asUser(db, u, fn);
const rows = <T = Record<string, unknown>>(u: string | null, sql: string, p: unknown[] = []) => as(u, async () => (await db.query<T>(sql, p)).rows);

beforeAll(async () => {
  db = await createTestDb();
  ins = await addUser(db, "ins@x.ci", ["instructor"]);
  other = await addUser(db, "other@x.ci", ["instructor"]);
  enrolled = await addUser(db, "enrolled@x.ci");
  stranger = await addUser(db, "stranger@x.ci");
  admin = await addUser(db, "admin@x.ci", ["admin"]);
  course = await one(
    `insert into public.courses (instructor_id, title, slug, status, published_at, price_amount)
     values ($1, 'Formation', 'formation', 'published', now(), 0) returning id`, [ins]);
  moduleId = await one(`insert into public.course_modules (course_id, title, position) values ($1, 'Module 1', 1) returning id`, [course]);
  await db.query(`insert into public.enrollments (learner_id, course_id, status) values ($1, $2, 'confirmed')`, [enrolled, course]);
  resource = await one(
    `insert into public.module_resources (module_id, name, file_path, size_bytes, mime_type)
     values ($1, 'Support.pdf', 'u/support.pdf', 2400000, 'application/pdf') returning id`, [moduleId]);
}, 120_000);
afterAll(async () => { await db.close(); });

describe("ressources d'un module", () => {
  it("le formateur de la formation peut ajouter et supprimer une ressource", async () => {
    await as(ins, () => db.query(`insert into public.module_resources (module_id, name, file_path) values ($1, 'Liens.docx', 'u/liens.docx')`, [moduleId]));
    await as(ins, () => db.query(`delete from public.module_resources where name = 'Liens.docx'`));
    expect(await rows(ins, `select id from public.module_resources`)).toHaveLength(1);
  });

  it("un autre formateur ne peut ni ajouter ni supprimer", async () => {
    await expect(as(other, () => db.query(`insert into public.module_resources (module_id, name, file_path) values ($1, 'X', 'o/x')`, [moduleId]))).rejects.toThrow();
    await as(other, () => db.query(`delete from public.module_resources where id = $1`, [resource]));
    expect(await rows(ins, `select id from public.module_resources`)).toHaveLength(1);
  });

  it("un inscrit lit les ressources, pas une personne non inscrite", async () => {
    expect(await rows(enrolled, `select id from public.module_resources`)).toHaveLength(1);
    expect(await rows(stranger, `select id from public.module_resources`)).toHaveLength(0);
    expect(await rows(null, `select id from public.module_resources`)).toHaveLength(0);
  });

  it("le personnel lit les ressources", async () => {
    expect(await rows(admin, `select id from public.module_resources`)).toHaveLength(1);
  });

  it("un inscrit ne peut pas modifier une ressource", async () => {
    await as(enrolled, () => db.query(`update public.module_resources set name = 'Piraté' where id = $1`, [resource]));
    const [r] = await rows<{ name: string }>(ins, `select name from public.module_resources where id = $1`, [resource]);
    expect(r.name).toBe("Support.pdf");
  });

  it("la taille négative est refusée", async () => {
    await expect(db.query(`insert into public.module_resources (module_id, name, file_path, size_bytes) values ($1, 'N', 'n', -1)`, [moduleId])).rejects.toThrow();
  });
});
