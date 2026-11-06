import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { addUser, asUser, createTestDb, type TestDb } from "./pg-harness";

let db: TestDb;
let ins: string, other: string, existing: string;
let course: string, s1: string, s2: string, full: string, foreign: string;

const one = async (sql: string, p: unknown[] = []) => (await db.query<{ id: string }>(sql, p)).rows[0]?.id;
const as = <T,>(u: string | null, fn: () => Promise<T>) => asUser(db, u, fn);
const rpc = <T = unknown>(u: string | null, sql: string, p: unknown[] = []) => as(u, async () => (await db.query<T>(sql, p)).rows);

const register = (instructor: string, email: string, sessions: string[]) => one(
  `insert into public.learner_registrations (instructor_id, first_name, last_name, email, phone, company, job_title, session_ids)
   values ($1, 'Jean', 'Kouassi', $2, '+225 07 01 02 03 04', 'SOGELOG', 'Responsable logistique', $3) returning id`,
  [instructor, email, sessions]);

const session = (c: string, owner: string, title: string, capacity: number) => one(
  `insert into public.sessions (course_id, instructor_id, title, start_at, end_at, delivery_mode, location, capacity)
   values ($1, $2, $3, now() + ($5 || ' days')::interval, now() + ($5 || ' days')::interval + interval '3 hours', 'onsite', 'Abidjan', $4) returning id`,
  [c, owner, title, capacity, String(10 + Math.floor(Math.random() * 200))]);

beforeAll(async () => {
  db = await createTestDb();
  ins = await addUser(db, "ins@x.ci", ["instructor"]);
  other = await addUser(db, "other@x.ci", ["instructor"]);
  existing = await addUser(db, "deja@x.ci");
  course = await one(`insert into public.courses (instructor_id, title, slug, status, published_at, price_amount) values ($1, 'Incendie', 'incendie', 'published', now(), 0) returning id`, [ins]);
  const course2 = await one(`insert into public.courses (instructor_id, title, slug, status, published_at, price_amount) values ($1, 'Autre', 'autre', 'published', now(), 0) returning id`, [other]);
  s1 = await session(course, ins, "Session A", 10);
  s2 = await session(course, ins, "Session B", 10);
  full = await session(course, ins, "Session pleine", 1);
  foreign = await session(course2, other, "Session d'un autre", 10);
  // Session pleine : une place, déjà prise
  const taken = await addUser(db, "pris@x.ci");
  await db.query(`insert into public.enrollments (learner_id, course_id, session_id, status) values ($1, $2, $3, 'confirmed')`, [taken, course, full]);
}, 120_000);
afterAll(async () => { await db.close(); });

describe("fiche apprenant (assistant « Ajouter un apprenant »)", () => {
  it("n'est lisible que du formateur qui l'a créée", async () => {
    const id = await register(ins, "lecture@x.ci", [s1]);
    expect(await rpc(ins, `select id from public.learner_registrations where id = $1`, [id])).toHaveLength(1);
    expect(await rpc(other, `select id from public.learner_registrations where id = $1`, [id])).toHaveLength(0);
  });

  it("refuse une adresse e-mail invalide et plus de 20 sessions", async () => {
    await expect(register(ins, "pas-un-email", [s1])).rejects.toThrow();
    await expect(register(ins, "x@x.ci", Array.from({ length: 21 }, () => s1))).rejects.toThrow();
  });
});

describe("confirmation", () => {
  it("inscrit tout de suite un apprenant qui a déjà un compte", async () => {
    const id = await register(ins, "deja@x.ci", [s1, s2]);
    const [r] = await rpc<{ confirm_learner_registration: { status: string; enrolled: number; failed: unknown[] } }>(ins, `select public.confirm_learner_registration($1)`, [id]);
    expect(r.confirm_learner_registration).toMatchObject({ status: "enrolled", enrolled: 1 });
    // Une seule inscription active par formation : la seconde session est refusée sans bloquer la première
    expect(r.confirm_learner_registration.failed).toHaveLength(1);
    const e = await db.query(`select session_id from public.enrollments where learner_id = $1 and course_id = $2`, [existing, course]);
    expect(e.rows).toHaveLength(1);
    expect((await db.query<{ status: string }>(`select status from public.learner_registrations where id = $1`, [id])).rows[0].status).toBe("enrolled");
  });

  it("une session complète est signalée sans empêcher les autres", async () => {
    const u = await addUser(db, "plein@x.ci");
    const id = await register(ins, "plein@x.ci", [full]);
    const [r] = await rpc<{ confirm_learner_registration: { enrolled: number; failed: { error: string }[] } }>(ins, `select public.confirm_learner_registration($1)`, [id]);
    expect(r.confirm_learner_registration.enrolled).toBe(0);
    expect(r.confirm_learner_registration.failed[0].error).toMatch(/session_full/);
    expect(u).toBeTruthy();
  });

  it("met la fiche en attente quand la personne n'a pas de compte", async () => {
    const id = await register(ins, "nouveau@x.ci", [s1]);
    const [r] = await rpc<{ confirm_learner_registration: { status: string } }>(ins, `select public.confirm_learner_registration($1)`, [id]);
    expect(r.confirm_learner_registration.status).toBe("pending");
  });

  it("refuse sans session, pour un autre formateur, ou avec la session d'un autre formateur", async () => {
    const empty = await register(ins, "vide@x.ci", []);
    await expect(rpc(ins, `select public.confirm_learner_registration($1)`, [empty])).rejects.toThrow(/sessions_required/);
    const mine = await register(ins, "autre@x.ci", [s1]);
    await expect(rpc(other, `select public.confirm_learner_registration($1)`, [mine])).rejects.toThrow(/registration_not_found/);
    const stolen = await register(ins, "vol@x.ci", [foreign]);
    await expect(rpc(ins, `select public.confirm_learner_registration($1)`, [stolen])).rejects.toThrow(/forbidden/);
  });

  it("ne se confirme qu'une fois", async () => {
    const id = await register(ins, "une-fois@x.ci", [s2]);
    await rpc(ins, `select public.confirm_learner_registration($1)`, [id]);
    await expect(rpc(ins, `select public.confirm_learner_registration($1)`, [id])).rejects.toThrow(/registration_not_found/);
  });

  it("un apprenant ne peut pas confirmer de fiche", async () => {
    const id = await register(ins, "interdit@x.ci", [s1]);
    await expect(rpc(existing, `select public.confirm_learner_registration($1)`, [id])).rejects.toThrow();
  });
});

describe("création du compte après la fiche", () => {
  it("inscrit automatiquement aux sessions et complète le profil", async () => {
    const id = await register(ins, "Futur@X.ci", [s2]);
    await rpc(ins, `select public.confirm_learner_registration($1)`, [id]);
    const u = await one(`insert into auth.users (email, raw_user_meta_data) values ('futur@x.ci', '{}'::jsonb) returning id`);
    const e = await db.query<{ status: string; session_id: string }>(`select status, session_id from public.enrollments where learner_id = $1`, [u]);
    expect(e.rows).toEqual([{ status: "confirmed", session_id: s2 }]);
    const p = await db.query<{ phone: string; employer: string; profession: string; full_name: string }>(`select phone, employer, profession, full_name from public.profiles where id = $1`, [u]);
    expect(p.rows[0]).toMatchObject({ phone: "+225 07 01 02 03 04", employer: "SOGELOG", profession: "Responsable logistique", full_name: "Jean Kouassi" });
    expect((await db.query<{ status: string }>(`select status from public.learner_registrations where id = $1`, [id])).rows[0].status).toBe("enrolled");
  });

  it("n'écrase pas ce que la personne a saisi et n'empêche jamais l'inscription du compte", async () => {
    const id = await register(ins, "garde@x.ci", [s1]);
    await rpc(ins, `select public.confirm_learner_registration($1)`, [id]);
    const u = await one(`insert into auth.users (email, raw_user_meta_data) values ('garde@x.ci', $1) returning id`, [JSON.stringify({ full_name: "Nom choisi", phone: "+225 05 05 05 05" })]);
    const p = await db.query<{ phone: string; full_name: string }>(`select phone, full_name from public.profiles where id = $1`, [u]);
    expect(p.rows[0]).toMatchObject({ phone: "+225 05 05 05 05", full_name: "Nom choisi" });

    // Session supprimée entre-temps : le compte est quand même créé
    const gone = await session(course, ins, "Éphémère", 5);
    const id2 = await register(ins, "orphelin@x.ci", [gone]);
    await rpc(ins, `select public.confirm_learner_registration($1)`, [id2]);
    await db.query(`delete from public.sessions where id = $1`, [gone]);
    const u2 = await one(`insert into auth.users (email, raw_user_meta_data) values ('orphelin@x.ci', '{}'::jsonb) returning id`);
    expect(u2).toBeTruthy();
    expect((await db.query(`select id from public.profiles where id = $1`, [u2])).rows).toHaveLength(1);
  });
});
