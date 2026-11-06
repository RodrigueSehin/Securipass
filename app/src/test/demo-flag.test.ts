import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { addUser, asUser, createTestDb, type TestDb } from "./pg-harness";

let db: TestDb;
let ins: string, admin: string;
beforeAll(async () => {
  db = await createTestDb();
  ins = await addUser(db, "ins@x.ci", ["instructor"]);
  admin = await addUser(db, "adm@x.ci", ["admin"]);
}, 120_000);
afterAll(async () => { await db.close(); });

const as = <T,>(u: string, fn: () => Promise<T>) => asUser(db, u, fn);
const isDemo = async (slug: string) => (await db.query<{ is_demo: boolean }>(`select is_demo from public.courses where slug=$1`, [slug])).rows[0].is_demo;

describe("marqueur is_demo", () => {
  it("vaut false par défaut", async () => {
    await db.query(`insert into public.courses (instructor_id, title, slug) values ($1,'Normale','normale')`, [ins]);
    expect(await isDemo("normale")).toBe(false);
  });
  it("le script (service role) peut marquer une formation", async () => {
    await db.query(`insert into public.courses (instructor_id, title, slug, is_demo) values ($1,'Démo','demo-1', true)`, [ins]);
    expect(await isDemo("demo-1")).toBe(true);
  });
  it("un formateur ne peut pas se déclarer « démo » à la création", async () => {
    await as(ins, () => db.query(`insert into public.courses (instructor_id, title, slug, is_demo) values ($1,'Triche','triche', true)`, [ins]));
    expect(await isDemo("triche")).toBe(false);
  });
  it("un formateur ne peut ni poser ni retirer le marqueur sur ses formations", async () => {
    await as(ins, () => db.query(`update public.courses set is_demo = true, title = 'Normale 2' where slug='normale'`));
    expect(await isDemo("normale")).toBe(false);
    await as(ins, () => db.query(`update public.courses set is_demo = false where slug='demo-1'`));
    expect(await isDemo("demo-1")).toBe(true);
  });
  it("le personnel pédagogique peut le modifier", async () => {
    await as(admin, () => db.query(`update public.courses set is_demo = false where slug='demo-1'`));
    expect(await isDemo("demo-1")).toBe(false);
  });
});
