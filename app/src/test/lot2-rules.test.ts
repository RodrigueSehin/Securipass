import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { addUser, asUser, createTestDb, type TestDb } from "./pg-harness";

let db: TestDb;
let admin: string, pedagogy: string, ins1: string, ins2: string, la: string, lb: string, lc: string, ld: string;
let freeCourse: string, paidCourse: string, session: string, catSecours: string;

const ids = async (sql: string, p: unknown[] = []) => (await db.query<{ id: string }>(sql, p)).rows.map((r) => r.id);
const one = async (sql: string, p: unknown[] = []) => (await ids(sql, p))[0];
const as = <T,>(u: string | null, fn: () => Promise<T>) => asUser(db, u, fn);
const rpc = <T = unknown>(u: string | null, sql: string, p: unknown[] = []) =>
  as(u, async () => (await db.query<T>(sql, p)).rows);

async function newSession(instructor: string, course: string, opts: { capacity?: number; waitlist?: boolean; startDays?: number; deadlineDays?: number | null } = {}) {
  const { capacity = 2, waitlist = false, startDays = 10, deadlineDays = 5 } = opts;
  return one(
    `insert into public.sessions (course_id, instructor_id, title, start_at, end_at, delivery_mode, location, capacity, waitlist_enabled, registration_deadline)
     values ($1, $2, 'Session test', now() + ($3 || ' days')::interval, now() + ($3 || ' days')::interval + interval '4 hours',
             'onsite', 'Abidjan', $4, $5, case when $6::int is null then null else now() + ($6 || ' days')::interval end)
     returning id`,
    [course, instructor, String(startDays), capacity, waitlist, deadlineDays],
  );
}

beforeAll(async () => {
  db = await createTestDb();
  admin = await addUser(db, "admin@x.ci", ["admin"]);
  pedagogy = await addUser(db, "ped@x.ci", ["pedagogy_manager"]);
  ins1 = await addUser(db, "ins1@x.ci", ["instructor"]);
  ins2 = await addUser(db, "ins2@x.ci", ["instructor"]);
  la = await addUser(db, "la@x.ci");
  lb = await addUser(db, "lb@x.ci");
  lc = await addUser(db, "lc@x.ci");
  ld = await addUser(db, "ld@x.ci");
  catSecours = await one(`select id from public.categories where slug = 'secourisme'`);
  freeCourse = await one(
    `insert into public.courses (instructor_id, category_id, title, slug, description, status, published_at, price_amount)
     values ($1, $2, 'Gestes de premiers secours', 'premiers-secours', 'Description', 'published', now(), 0) returning id`,
    [ins1, catSecours],
  );
  paidCourse = await one(
    `insert into public.courses (instructor_id, title, slug, status, published_at, price_amount)
     values ($1, 'Agent de sécurité', 'agent-securite', 'published', now(), 49000) returning id`,
    [ins1],
  );
  session = await newSession(ins1, freeCourse, { capacity: 2, waitlist: true });
}, 120_000);

afterAll(async () => { await db.close(); });

describe("cycle de vie d'une formation", () => {
  it("le formateur crée un brouillon mais pas une formation déjà publiée", async () => {
    const ok = await rpc(ins2, `insert into public.courses (instructor_id, title, slug) values ($1,'Brouillon','brouillon-1') returning id`, [ins2]);
    expect(ok).toHaveLength(1);
    await expect(rpc(ins2, `insert into public.courses (instructor_id, title, slug, status) values ($1,'X','x-pub','published')`, [ins2])).rejects.toThrow();
  });

  it("le formateur ne peut pas publier lui-même, ni usurper un autre formateur", async () => {
    const id = await one(`select id from public.courses where slug='brouillon-1'`);
    await expect(rpc(ins2, `update public.courses set status='published' where id=$1`, [id])).rejects.toThrow(/Transition/);
    await expect(rpc(ins2, `insert into public.courses (instructor_id, title, slug) values ($1,'Vol','vol-1')`, [ins1])).rejects.toThrow();
  });

  it("brouillon -> révision -> publication par la pédagogie, avec audit", async () => {
    const id = await one(`select id from public.courses where slug='brouillon-1'`);
    await rpc(ins2, `update public.courses set status='in_review' where id=$1`, [id]);
    await rpc(pedagogy, `update public.courses set status='published' where id=$1`, [id]);
    const [c] = await rpc<{ status: string; reviewed_by: string; published_at: string }>(ins2, `select status, reviewed_by, published_at from public.courses where id=$1`, [id]);
    expect(c.status).toBe("published");
    expect(c.reviewed_by).toBe(pedagogy);
    expect(c.published_at).toBeTruthy();
    const audit = await db.query(`select 1 from public.audit_logs where entity_id=$1 and action='course.status_changed' and metadata->>'to'='published'`, [id]);
    expect(audit.rows).toHaveLength(1);
  });

  it("un refus doit être motivé", async () => {
    const id = await one(`insert into public.courses (instructor_id, title, slug, status) values ($1,'À refuser','a-refuser','in_review') returning id`, [ins2]);
    await expect(rpc(admin, `update public.courses set status='rejected' where id=$1`, [id])).rejects.toThrow(/motivé/);
    await rpc(admin, `update public.courses set status='rejected', rejection_reason='Programme incomplet' where id=$1`, [id]);
    const [c] = await rpc<{ status: string; rejection_reason: string }>(ins2, `select status, rejection_reason from public.courses where id=$1`, [id]);
    expect(c).toEqual({ status: "rejected", rejection_reason: "Programme incomplet" });
  });

  it("modifier une formation publiée la renvoie en validation ; un détail mineur non", async () => {
    const id = await one(`select id from public.courses where slug='brouillon-1'`);
    await rpc(ins2, `update public.courses set cancellation_policy='Annulation 48h avant' where id=$1`, [id]);
    expect((await rpc<{ status: string }>(ins2, `select status from public.courses where id=$1`, [id]))[0].status).toBe("published");
    await rpc(ins2, `update public.courses set title='Nouveau titre' where id=$1`, [id]);
    expect((await rpc<{ status: string }>(ins2, `select status from public.courses where id=$1`, [id]))[0].status).toBe("in_review");
  });

  it("ajouter un module à une formation publiée la renvoie en validation", async () => {
    await rpc(ins1, `insert into public.course_modules (course_id, title) values ($1,'Module ajouté')`, [paidCourse]);
    expect((await rpc<{ status: string }>(ins1, `select status from public.courses where id=$1`, [paidCourse]))[0].status).toBe("in_review");
    await rpc(pedagogy, `update public.courses set status='published' where id=$1`, [paidCourse]); // republié
  });

  it("l'instructeur ne peut pas modifier la formation d'un autre ni les champs de validation", async () => {
    const r = await rpc(ins2, `update public.courses set title='Piraté' where id=$1 returning id`, [freeCourse]);
    expect(r).toHaveLength(0);
    await rpc(ins1, `update public.courses set reviewed_by=$2, rejection_reason='x' where id=$1`, [freeCourse, ins1]);
    const [c] = await rpc<{ reviewed_by: string | null }>(ins1, `select reviewed_by from public.courses where id=$1`, [freeCourse]);
    expect(c.reviewed_by).toBeNull();
  });

  it("le public ne voit que les formations publiées", async () => {
    const rows = await rpc<{ slug: string; status: string }>(null, `select slug, status from public.courses`);
    expect(rows.every((r) => r.status === "published")).toBe(true);
  });
});

describe("sessions", () => {
  it("refuse deux sessions simultanées pour un même formateur", async () => {
    await expect(newSession(ins1, freeCourse, { startDays: 10 })).rejects.toThrow(/conflicting|exclusion/i);
  });
  it("un autre formateur ou un apprenant ne peut pas créer de session sur cette formation", async () => {
    const q = `insert into public.sessions (course_id, instructor_id, title, start_at, end_at, delivery_mode, location, capacity)
               values ($1,$2,'Intrus', now()+interval '30 days', now()+interval '30 days 2 hours','onsite','X',5)`;
    await expect(rpc(ins2, q, [freeCourse, ins2])).rejects.toThrow();
    await expect(rpc(la, q, [freeCourse, la])).rejects.toThrow();
  });
  it("une session en ligne ou hybride sans lieu est refusée, une session en ligne sans lieu est acceptée", async () => {
    const mk = (mode: string, loc: string | null) =>
      db.query(
        `insert into public.sessions (course_id, instructor_id, title, start_at, end_at, delivery_mode, location, capacity)
         values ($1,$2,'Mode', now()+interval '60 days', now()+interval '60 days 1 hour',$3,$4,5)`,
        [freeCourse, ins1, mode, loc],
      );
    await expect(mk("onsite", null)).rejects.toThrow();
    await mk("online", null);
    await db.query(`delete from public.sessions where title='Mode'`);
  });
});

describe("inscription", () => {
  it("une formation avec sessions exige le choix d'une session", async () => {
    await expect(rpc(la, `select public.enroll_self($1)`, [freeCourse])).rejects.toThrow(/session_required/);
  });
  it("un visiteur non connecté ne peut pas s'inscrire", async () => {
    await expect(rpc(null, `select public.enroll_self($1,$2)`, [freeCourse, session])).rejects.toThrow();
  });
  it("inscrit un apprenant, puis refuse le doublon", async () => {
    const [r] = await rpc<{ enroll_self: { status: string } }>(la, `select public.enroll_self($1,$2)`, [freeCourse, session]);
    expect(r.enroll_self.status).toBe("confirmed");
    await expect(rpc(la, `select public.enroll_self($1,$2)`, [freeCourse, session])).rejects.toThrow(/already_enrolled/);
  });
  it("remplit la session, puis place en liste d'attente", async () => {
    await rpc(lb, `select public.enroll_self($1,$2)`, [freeCourse, session]);
    const [r] = await rpc<{ enroll_self: { status: string } }>(lc, `select public.enroll_self($1,$2)`, [freeCourse, session]);
    expect(r.enroll_self.status).toBe("waitlisted");
    expect((await db.query<{ n: number }>(`select public.session_seats_taken($1) as n`, [session])).rows[0].n).toBe(2);
  });
  it("une annulation promeut le premier de la liste d'attente", async () => {
    const eid = await one(`select id from public.enrollments where learner_id=$1 and course_id=$2`, [la, freeCourse]);
    await rpc(la, `select public.cancel_enrollment($1)`, [eid]);
    const [c] = await rpc<{ status: string }>(null, `select status from public.enrollments where learner_id=$1 and course_id=$2`, [lc, freeCourse]).catch(() => [{ status: "?" }]);
    void c;
    const st = (await db.query<{ status: string }>(`select status from public.enrollments where learner_id=$1 and course_id=$2`, [lc, freeCourse])).rows[0].status;
    expect(st).toBe("confirmed");
  });
  it("une session complète sans liste d'attente refuse l'inscription", async () => {
    const s2 = await newSession(ins1, paidCourse, { capacity: 1, waitlist: false, startDays: 20 });
    await db.query(`update public.courses set price_amount=0 where id=$1`, [paidCourse]);
    await rpc(ld, `select public.enroll_self($1,$2)`, [paidCourse, s2]);
    await expect(rpc(la, `select public.enroll_self($1,$2)`, [paidCourse, s2])).rejects.toThrow(/session_full/);
    await db.query(`update public.courses set price_amount=49000 where id=$1`, [paidCourse]);
  });
  it("refuse l'auto-inscription à une formation payante (paiement requis)", async () => {
    await expect(rpc(la, `select public.enroll_self($1,$2)`, [paidCourse, null])).rejects.toThrow(/payment_required/);
  });
  it("refuse une inscription après la date limite", async () => {
    const s3 = await newSession(ins1, freeCourse, { startDays: 40, deadlineDays: -1 }).catch(() => null);
    // deadline négative < start : acceptée par le schéma ; l'inscription doit être fermée
    expect(s3).toBeTruthy();
    await expect(rpc(la, `select public.enroll_self($1,$2)`, [freeCourse, s3])).rejects.toThrow(/registration_closed/);
  });
  it("applique le prérequis (formation terminée requise)", async () => {
    const pre = await one(`insert into public.courses (instructor_id, title, slug, status, published_at, price_amount, prerequisite_course_id)
      values ($1,'Avancé','avance','published', now(), 0, $2) returning id`, [ins1, freeCourse]);
    await expect(rpc(ld, `select public.enroll_self($1)`, [pre])).rejects.toThrow(/prerequisite_missing/);
    await db.query(`update public.enrollments set status='completed' where learner_id=$1 and course_id=$2`, [lc, freeCourse]);
    const [r] = await rpc<{ enroll_self: { status: string } }>(lc, `select public.enroll_self($1)`, [pre]);
    expect(r.enroll_self.status).toBe("confirmed");
    await db.query(`update public.enrollments set status='confirmed' where learner_id=$1 and course_id=$2`, [lc, freeCourse]);
  });
  it("une formation brouillon n'est pas inscriptible", async () => {
    const dr = await one(`insert into public.courses (instructor_id, title, slug) values ($1,'Brouillon 2','brouillon-2') returning id`, [ins1]);
    await expect(rpc(la, `select public.enroll_self($1)`, [dr])).rejects.toThrow(/course_not_available/);
  });
  it("l'apprenant ne peut ni insérer ni modifier directement une inscription", async () => {
    await expect(rpc(la, `insert into public.enrollments (learner_id, course_id) values ($1,$2)`, [la, freeCourse])).rejects.toThrow();
    const eid = await one(`select id from public.enrollments where learner_id=$1 and course_id=$2`, [lb, freeCourse]);
    const r = await rpc(lb, `update public.enrollments set status='completed' where id=$1 returning id`, [eid]);
    expect(r).toHaveLength(0);
  });
  it("un apprenant ne voit que ses inscriptions ; le formateur voit celles de ses formations", async () => {
    expect((await rpc<{ learner_id: string }>(lb, `select learner_id from public.enrollments`)).every((e) => e.learner_id === lb)).toBe(true);
    expect((await rpc(ins1, `select 1 from public.enrollments`)).length).toBeGreaterThan(0);
    expect(await rpc(ins2, `select 1 from public.enrollments`)).toHaveLength(0);
  });
  it("on ne peut pas annuler l'inscription d'un autre", async () => {
    const eid = await one(`select id from public.enrollments where learner_id=$1 and course_id=$2`, [lb, freeCourse]);
    await expect(rpc(ld, `select public.cancel_enrollment($1)`, [eid])).rejects.toThrow(/forbidden/);
  });
});

describe("contenus et accès", () => {
  let moduleId: string, published: string;
  beforeAll(async () => {
    moduleId = await one(`insert into public.course_modules (course_id, title, position) values ($1,'Module 1',1) returning id`, [freeCourse]);
    published = await one(`insert into public.learning_contents (module_id,title,content_type,file_path,status,position) values ($1,'Leçon PDF','pdf','u/file.pdf','published',1) returning id`, [moduleId]);
    await one(`insert into public.learning_contents (module_id,title,content_type,external_url,status,position) values ($1,'Brouillon','link','https://x.ci','draft',2) returning id`, [moduleId]);
  });
  it("seul un inscrit confirmé voit les contenus publiés", async () => {
    expect((await rpc<{ id: string }>(lb, `select id from public.learning_contents`)).map((r) => r.id)).toEqual([published]);
    expect(await rpc(ld, `select id from public.learning_contents`)).toHaveLength(0);
    expect(await rpc(null, `select id from public.learning_contents`)).toHaveLength(0);
  });
  it("le formateur propriétaire voit tout, pas un autre formateur", async () => {
    expect(await rpc(ins1, `select id from public.learning_contents`)).toHaveLength(2);
    expect(await rpc(ins2, `select id from public.learning_contents`)).toHaveLength(0);
  });
  it("un apprenant en liste d'attente ou annulé n'a pas accès", async () => {
    await db.query(`update public.enrollments set status='waitlisted' where learner_id=$1 and course_id=$2`, [lb, freeCourse]);
    expect(await rpc(lb, `select id from public.learning_contents`)).toHaveLength(0);
    await db.query(`update public.enrollments set status='confirmed' where learner_id=$1 and course_id=$2`, [lb, freeCourse]);
  });
  it("seuls les liens https sont acceptés ; un contenu texte exige un corps", async () => {
    await expect(db.query(`insert into public.learning_contents (module_id,title,content_type,external_url) values ($1,'Lien','link','http://x.ci')`, [moduleId])).rejects.toThrow();
    await expect(db.query(`insert into public.learning_contents (module_id,title,content_type) values ($1,'Texte','text')`, [moduleId])).rejects.toThrow();
  });
  it("le lien de visioconférence n'est visible que des inscrits, du formateur et du personnel", async () => {
    await db.query(`insert into public.session_meeting_links (session_id, url) values ($1,'https://meet.x.ci/abc')`, [session]);
    expect(await rpc(lb, `select url from public.session_meeting_links`)).toHaveLength(1);
    expect(await rpc(ins1, `select url from public.session_meeting_links`)).toHaveLength(1);
    expect(await rpc(ld, `select url from public.session_meeting_links`)).toHaveLength(0);
    expect(await rpc(null, `select url from public.session_meeting_links`)).toHaveLength(0);
    expect(await rpc(ins2, `select url from public.session_meeting_links`)).toHaveLength(0);
  });
});

describe("détail public d'une formation", () => {
  it("n'expose ni contenus brouillons, ni liens, ni fichiers", async () => {
    const [r] = await rpc<{ d: Record<string, unknown> | null }>(null, `select public.public_course_detail('premiers-secours') as d`);
    const d = r.d as { modules: { contents: { title: string }[] }[]; sessions: { seats_taken: number }[]; instructor_name: string };
    expect(d.modules[0].contents.map((c) => c.title)).toEqual(["Leçon PDF"]);
    expect(d.sessions[0].seats_taken).toBeGreaterThan(0);
    const json = JSON.stringify(d);
    expect(json).not.toContain("meet.x.ci");
    expect(json).not.toContain("file.pdf");
    expect(json).not.toContain("https://x.ci");
  });
  it("retourne null pour un brouillon ou un slug inconnu", async () => {
    expect((await rpc<{ d: unknown }>(null, `select public.public_course_detail('brouillon-2') as d`))[0].d).toBeNull();
    expect((await rpc<{ d: unknown }>(null, `select public.public_course_detail('inconnu') as d`))[0].d).toBeNull();
  });
  it("liste uniquement les formations ayant des places disponibles", async () => {
    // À ce stade toutes les sessions existantes sont pleines ou closes
    expect(await rpc(null, `select * from public.courses_with_open_sessions()`)).toHaveLength(0);
    await newSession(ins1, freeCourse, { startDays: 70, capacity: 3 });
    const rows = await rpc<{ courses_with_open_sessions: string }>(null, `select * from public.courses_with_open_sessions()`);
    expect(rows.map((r) => r.courses_with_open_sessions)).toEqual([freeCourse]);
  });
});

describe("inscription manuelle, annulation et duplication", () => {
  it("le formateur propriétaire inscrit un apprenant existant ; trace d'audit", async () => {
    const s = await newSession(ins1, freeCourse, { startDays: 50, capacity: 5 });
    const [r] = await rpc<{ instructor_enroll_learner: { status: string } }>(ins1, `select public.instructor_enroll_learner($1,'LD@x.ci')`, [s]);
    expect(r.instructor_enroll_learner.status).toBe("confirmed");
    expect((await db.query(`select 1 from public.audit_logs where action='enrollment.manual'`)).rows).toHaveLength(1);
  });
  it("refuse un autre formateur, un apprenant et un e-mail inconnu", async () => {
    const s = await one(`select id from public.sessions where title='Session test' order by start_at desc limit 1`);
    await expect(rpc(ins2, `select public.instructor_enroll_learner($1,'la@x.ci')`, [s])).rejects.toThrow(/forbidden/);
    await expect(rpc(la, `select public.instructor_enroll_learner($1,'la@x.ci')`, [s])).rejects.toThrow(/forbidden/);
    await expect(rpc(ins1, `select public.instructor_enroll_learner($1,'inconnu@x.ci')`, [s])).rejects.toThrow(/learner_not_found/);
  });
  it("le formateur voit le profil de ses apprenants, pas des autres", async () => {
    expect((await rpc<{ email: string }>(ins1, `select email from public.profiles where id=$1`, [lb])).length).toBe(1);
    expect(await rpc(ins2, `select email from public.profiles where id=$1`, [lb])).toHaveLength(0);
  });
  it("la capacité ne peut pas descendre sous les inscrits", async () => {
    await expect(rpc(ins1, `update public.sessions set capacity=1 where id=$1`, [session])).rejects.toThrow(/capacity_below_enrolled/);
  });
  it("annuler une session annule ses inscriptions", async () => {
    await rpc(ins1, `update public.sessions set status='cancelled' where id=$1`, [session]);
    const active = await db.query(`select 1 from public.enrollments where session_id=$1 and status in ('confirmed','waitlisted')`, [session]);
    expect(active.rows).toHaveLength(0);
  });
  it("duplique une formation en brouillon avec ses modules, sans accès pour un tiers", async () => {
    const [r] = await rpc<{ duplicate_course: string }>(ins1, `select public.duplicate_course($1)`, [freeCourse]);
    const copy = r.duplicate_course;
    const [c] = await rpc<{ status: string; title: string }>(ins1, `select status, title from public.courses where id=$1`, [copy]);
    expect(c.status).toBe("draft");
    expect(c.title).toMatch(/\(copie\)$/);
    expect((await rpc(ins1, `select id from public.course_modules where course_id=$1`, [copy])).length).toBe(1);
    await expect(rpc(ins2, `select public.duplicate_course($1)`, [freeCourse])).rejects.toThrow(/forbidden/);
  });
});
