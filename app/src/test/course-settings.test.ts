import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { addUser, asUser, createTestDb, type TestDb } from "./pg-harness";

let db: TestDb;
let ins: string, other: string, la: string, lb: string, lc: string;
let course: string, scheduled: string, content: string, template: string;

const one = async (sql: string, p: unknown[] = []) => (await db.query<{ id: string }>(sql, p)).rows[0]?.id;
const as = <T,>(u: string | null, fn: () => Promise<T>) => asUser(db, u, fn);
const rows = <T = Record<string, unknown>>(u: string | null, sql: string, p: unknown[] = []) => as(u, async () => (await db.query<T>(sql, p)).rows);

beforeAll(async () => {
  db = await createTestDb();
  ins = await addUser(db, "ins@x.ci", ["instructor"]);
  other = await addUser(db, "other@x.ci", ["instructor"]);
  la = await addUser(db, "la@x.ci");
  lb = await addUser(db, "lb@x.ci");
  lc = await addUser(db, "lc@x.ci");
  template = await one(`select id from public.certificate_templates where layout = 'classic'`);
  course = await one(
    `insert into public.courses (instructor_id, category_id, title, slug, status, published_at, duration_minutes, price_amount, certificate_template_id)
     values ($1, (select id from public.categories limit 1), 'Formation réglages', 'reglages', 'published', now(), 60, 0, $2) returning id`, [ins, template]);
  scheduled = await one(
    `insert into public.courses (instructor_id, title, slug, status, published_at, publication_mode, publish_at, price_amount)
     values ($1, 'Formation planifiée', 'planifiee', 'published', now(), 'scheduled', now() + interval '10 days', 0) returning id`, [ins]);
  const mod = await one(`insert into public.course_modules (course_id, title, position) values ($1, 'Module', 1) returning id`, [course]);
  content = await one(
    `insert into public.learning_contents (module_id, title, content_type, body, status, duration_minutes, position)
     values ($1, 'Leçon', 'text', 'Texte', 'published', 10, 1) returning id`, [mod]);
  await db.query(`insert into public.enrollments (learner_id, course_id, status) values ($1, $2, 'confirmed')`, [la, course]);
}, 120_000);
afterAll(async () => { await db.close(); });

describe("publication planifiée", () => {
  it("une planification exige une date", async () => {
    await expect(db.query(`update public.courses set publication_mode = 'scheduled', publish_at = null where id = $1`, [course])).rejects.toThrow();
  });

  it("avant la date, la formation validée est invisible du public et des apprenants, mais pas de son formateur", async () => {
    expect(await rows(null, `select id from public.courses where id = $1`, [scheduled])).toHaveLength(0);
    expect(await rows(lb, `select id from public.courses where id = $1`, [scheduled])).toHaveLength(0);
    expect(await rows(ins, `select id from public.courses where id = $1`, [scheduled])).toHaveLength(1);
    const [d] = await rows<{ d: unknown }>(null, `select public.public_course_detail('planifiee') as d`);
    expect(d.d).toBeNull();
  });

  it("l'inscription est refusée avant la date", async () => {
    await expect(rows(lb, `select public.enroll_self($1)`, [scheduled])).rejects.toThrow(/course_not_available/);
  });

  it("à la date prévue, la formation devient visible et ouverte aux inscriptions", async () => {
    await db.query(`update public.courses set publish_at = now() - interval '1 minute' where id = $1`, [scheduled]);
    expect(await rows(null, `select id from public.courses where id = $1`, [scheduled])).toHaveLength(1);
    const [d] = await rows<{ d: { slug: string } | null }>(null, `select public.public_course_detail('planifiee') as d`);
    expect(d.d?.slug).toBe("planifiee");
    await expect(rows(lb, `select public.enroll_self($1)`, [scheduled])).resolves.toHaveLength(1);
  });
});

describe("notification du formateur", () => {
  it("le formateur est averti d'une nouvelle inscription quand l'option est active", async () => {
    const kinds = (await rows<{ kind: string }>(ins, `select kind from public.notifications`)).map((n) => n.kind);
    expect(kinds).toContain("enrollment_new");
  });

  it("aucune notification quand l'option est désactivée", async () => {
    await db.query(`update public.courses set notify_instructor = false where id = $1`, [course]);
    const before = (await rows(ins, `select id from public.notifications where kind = 'enrollment_new'`)).length;
    await rows(lc, `select public.enroll_self($1)`, [course]);
    expect(await rows(ins, `select id from public.notifications where kind = 'enrollment_new'`)).toHaveLength(before);
    await db.query(`update public.courses set notify_instructor = true where id = $1`, [course]);
  });
});

describe("forum de questions", () => {
  let thread: string;

  it("un inscrit pose une question, le formateur est notifié", async () => {
    thread = (await rows<{ id: string }>(la, `select public.create_forum_thread($1, 'Comment faire ?', 'Ma question détaillée') as id`, [course]))[0].id;
    const kinds = (await rows<{ kind: string }>(ins, `select kind from public.notifications`)).map((n) => n.kind);
    expect(kinds).toContain("forum_question");
  });

  it("une personne non inscrite ne peut ni lire ni poser de question", async () => {
    const stranger = await addUser(db, "stranger@x.ci");
    await expect(rows(stranger, `select public.create_forum_thread($1, 'Titre', 'Corps')`, [course])).rejects.toThrow(/forbidden/);
    expect(await rows(stranger, `select id from public.forum_threads`)).toHaveLength(0);
    expect(await rows(null, `select id from public.forum_threads`)).toHaveLength(0);
  });

  it("un autre formateur n'accède pas au forum", async () => {
    expect(await rows(other, `select id from public.forum_threads`)).toHaveLength(0);
    await expect(rows(other, `select public.reply_forum_thread($1, 'Intrus')`, [thread])).rejects.toThrow(/forbidden|discussions/);
  });

  it("le formateur répond, l'auteur de la question est notifié", async () => {
    await rows(ins, `select public.reply_forum_thread($1, 'Voici la réponse')`, [thread]);
    const kinds = (await rows<{ kind: string }>(la, `select kind from public.notifications`)).map((n) => n.kind);
    expect(kinds).toContain("forum_reply");
    expect(await rows(la, `select id from public.forum_posts where thread_id = $1`, [thread])).toHaveLength(2);
  });

  it("les discussions entre apprenants peuvent être désactivées : on répond encore à sa propre question", async () => {
    await db.query(`insert into public.enrollments (learner_id, course_id, status) values ($1, $2, 'confirmed') on conflict do nothing`, [lc, course]);
    await db.query(`update public.courses set allow_discussions = false where id = $1`, [course]);
    await expect(rows(lc, `select public.reply_forum_thread($1, 'Moi aussi')`, [thread])).rejects.toThrow(/discussions_disabled/);
    await expect(rows(la, `select public.reply_forum_thread($1, 'Merci')`, [thread])).resolves.toHaveLength(1);
    await db.query(`update public.courses set allow_discussions = true where id = $1`, [course]);
    await expect(rows(lc, `select public.reply_forum_thread($1, 'Moi aussi')`, [thread])).resolves.toHaveLength(1);
  });

  it("le forum désactivé est fermé aux apprenants mais pas au formateur", async () => {
    await db.query(`update public.courses set forum_enabled = false where id = $1`, [course]);
    expect(await rows(la, `select id from public.forum_threads`)).toHaveLength(0);
    await expect(rows(la, `select public.create_forum_thread($1, 'Titre', 'Corps')`, [course])).rejects.toThrow(/forum_disabled/);
    expect(await rows(ins, `select id from public.forum_threads`)).toHaveLength(1);
    await db.query(`update public.courses set forum_enabled = true where id = $1`, [course]);
  });

  it("seuls le formateur et le personnel suppriment une question", async () => {
    await as(la, () => db.query(`delete from public.forum_threads where id = $1`, [thread]));
    expect(await rows(ins, `select id from public.forum_threads`)).toHaveLength(1);
    await as(ins, () => db.query(`delete from public.forum_threads where id = $1`, [thread]));
    expect(await rows(ins, `select id from public.forum_threads`)).toHaveLength(0);
  });

  it("un message vide ou trop long est refusé", async () => {
    await expect(rows(la, `select public.create_forum_thread($1, 'Titre', '   ')`, [course])).rejects.toThrow(/invalid_post/);
    await expect(rows(la, `select public.create_forum_thread($1, 'ab', 'Corps')`, [course])).rejects.toThrow(/invalid_post/);
  });
});

describe("certificat délivré automatiquement", () => {
  const certificates = (learner: string) => rows<{ status: string }>(ins, `select status from public.certificates where learner_id = $1`, [learner]);

  it("rien n'est émis tant que l'option est désactivée", async () => {
    await as(la, () => db.query(`select set_content_completed($1, true)`, [content]));
    expect(await certificates(la)).toHaveLength(0);
  });

  it("le certificat est émis dès que l'inscription devient éligible", async () => {
    await as(la, () => db.query(`select set_content_completed($1, false)`, [content]));
    await db.query(`update public.courses set auto_certificate = true where id = $1`, [course]);
    await as(la, () => db.query(`select set_content_completed($1, true)`, [content]));
    expect(await certificates(la)).toEqual([{ status: "valid" }]);
    const kinds = (await rows<{ kind: string }>(la, `select kind from public.notifications`)).map((n) => n.kind);
    expect(kinds).toContain("certificate_issued");
  });

  it("jamais de doublon", async () => {
    await as(la, () => db.query(`select set_content_completed($1, false)`, [content]));
    await as(la, () => db.query(`select set_content_completed($1, true)`, [content]));
    expect(await certificates(la)).toHaveLength(1);
  });

  it("un apprenant non éligible n'obtient rien, et l'action qui déclenche le contrôle n'échoue jamais", async () => {
    const lessonB = await one(
      `insert into public.learning_contents (module_id, title, content_type, body, status, duration_minutes, position)
       values ((select id from public.course_modules where course_id = $1), 'Leçon 2', 'text', 'Texte', 'published', 10, 2) returning id`, [course]);
    await as(lc, () => db.query(`select set_content_completed($1, true)`, [content]));
    expect(await certificates(lc)).toHaveLength(0); // la leçon 2 n'est pas terminée
    expect(lessonB).toBeTruthy();
  });
});

describe("copie d'une formation", () => {
  it("reprend les réglages d'évaluation, de certification et de paramètres", async () => {
    await db.query(`update public.courses set pass_mark_percent = 55, forum_enabled = false, payment_methods = array['card'], allow_downloads = false where id = $1`, [course]);
    const copy = (await rows<{ id: string }>(ins, `select public.duplicate_course($1) as id`, [course]))[0].id;
    const [c] = await rows<{ pass_mark_percent: number; forum_enabled: boolean; payment_methods: string[]; allow_downloads: boolean; status: string }>(
      ins, `select pass_mark_percent, forum_enabled, payment_methods, allow_downloads, status from public.courses where id = $1`, [copy]);
    expect(c).toEqual({ pass_mark_percent: 55, forum_enabled: false, payment_methods: ["card"], allow_downloads: false, status: "draft" });
  });
});

describe("auteurs du forum", () => {
  it("n'expose que prénom et initiale, seulement à ceux qui peuvent lire le forum", async () => {
    await db.query(`update public.courses set forum_enabled = true where id = $1`, [course]); // réactivé après le test de copie
    const author = await addUser(db, "forum-author@x.ci", [], "Awa Koné");
    await db.query(`insert into public.enrollments (learner_id, course_id, status) values ($1, $2, 'confirmed')`, [author, course]);
    await rows(author, `select public.create_forum_thread($1, 'Ma question', 'Bonjour')`, [course]);
    const names = (await rows<{ display_name: string }>(la, `select display_name from public.forum_authors($1)`, [course])).map((n) => n.display_name);
    expect(names).toContain("Awa K.");
    expect(names.join(" ")).not.toContain("Koné");
    const stranger = await addUser(db, "forum-stranger@x.ci");
    expect(await rows(stranger, `select * from public.forum_authors($1)`, [course])).toHaveLength(0);
    const flags = await rows<{ is_instructor: boolean }>(ins, `select is_instructor from public.forum_authors($1)`, [course]);
    expect(flags.some((f) => f.is_instructor)).toBe(false);
  });
});

describe("téléchargement des supports", () => {
  it("désactivé : les inscrits ne lisent plus les ressources, le formateur oui", async () => {
    const mod = await one(`select id from public.course_modules where course_id = $1 limit 1`, [course]);
    await db.query(`insert into public.module_resources (module_id, name, file_path) values ($1, 'Support.pdf', 'u/support.pdf')`, [mod]);
    await db.query(`update public.courses set allow_downloads = true where id = $1`, [course]);
    expect(await rows(la, `select id from public.module_resources`)).toHaveLength(1);
    await db.query(`update public.courses set allow_downloads = false where id = $1`, [course]);
    expect(await rows(la, `select id from public.module_resources`)).toHaveLength(0);
    expect(await rows(ins, `select id from public.module_resources`)).toHaveLength(1);
    await db.query(`update public.courses set allow_downloads = true where id = $1`, [course]);
  });
});

describe("inscriptions ouvertes ou fermées, mise en avant", () => {
  it("fermées : l'inscription en ligne est refusée, l'inscription par le formateur reste possible", async () => {
    const open = await one(
      `insert into public.courses (instructor_id, title, slug, status, published_at, price_amount, registrations_open)
       values ($1, 'Formation fermée', 'fermee', 'published', now(), 0, false) returning id`, [ins]);
    await expect(rows(lb, `select public.enroll_self($1)`, [open])).rejects.toThrow(/registrations_closed_course/);
    const session = await one(
      `insert into public.sessions (course_id, instructor_id, title, start_at, end_at, delivery_mode, location, capacity)
       values ($1, $2, 'Session fermée', now() + interval '30 days', now() + interval '30 days 4 hours', 'onsite', 'Abidjan', 5) returning id`, [open, ins]);
    const manual = await rows<{ r: { status: string } }>(ins, `select public.instructor_enroll_learner($1, 'lb@x.ci') as r`, [session]);
    expect(manual[0].r.status).toBe("confirmed");
    const [d] = await rows<{ d: { registrations_open: boolean } }>(null, `select public.public_course_detail('fermee') as d`);
    expect(d.d.registrations_open).toBe(false);
  });

  it("la mise en avant est désactivée par défaut", async () => {
    const [c] = await rows<{ featured: boolean }>(ins, `select featured from public.courses where id = $1`, [course]);
    expect(c.featured).toBe(false);
  });
});
