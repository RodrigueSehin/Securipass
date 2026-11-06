import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { addUser, asUser, createTestDb, type TestDb } from "./pg-harness";

let db: TestDb;
let ins: string, other: string, la: string, stranger: string;
let course: string, moduleId: string, quizEval: string;

const one = async (sql: string, p: unknown[] = []) => (await db.query<{ id: string }>(sql, p)).rows[0]?.id;
const as = <T,>(u: string | null, fn: () => Promise<T>) => asUser(db, u, fn);
const rows = <T = Record<string, unknown>>(u: string | null, sql: string, p: unknown[] = []) => as(u, async () => (await db.query<T>(sql, p)).rows);

let n = 0;
const content = (over: Record<string, unknown> = {}) => {
  const v: Record<string, unknown> = { type: "document", status: "draft", file: null, url: null, body: null, description: null, ...over };
  return one(
    `insert into public.learning_contents (module_id, title, content_type, status, file_path, external_url, body, description, duration_minutes, position,
        is_required, is_visible, publish_at, available_until, evaluation_id, prerequisite_content_id, allow_download, notify_learners)
     values ($1, $2, $3, $4, $5, $6, $7, $8, 10, $9, $10, $11, $12, $13, $14, $15, $16, $17) returning id`,
    [moduleId, `Contenu ${++n}`, v.type, v.status, v.file, v.url, v.body, v.description, n, v.required ?? true, v.visible ?? true,
      v.publishAt ?? null, v.until ?? null, v.evaluation ?? null, v.prerequisite ?? null, v.download ?? true, v.notify ?? false],
  );
};

beforeAll(async () => {
  db = await createTestDb();
  ins = await addUser(db, "ins@x.ci", ["instructor"]);
  other = await addUser(db, "other@x.ci", ["instructor"]);
  la = await addUser(db, "la@x.ci");
  stranger = await addUser(db, "stranger@x.ci");
  course = await one(
    `insert into public.courses (instructor_id, category_id, title, slug, status, published_at, duration_minutes, price_amount)
     values ($1, (select id from public.categories limit 1), 'Formation contenus', 'contenus', 'published', now(), 60, 0) returning id`, [ins]);
  moduleId = await one(`insert into public.course_modules (course_id, title, position) values ($1, 'Module', 1) returning id`, [course]);
  quizEval = await one(`insert into public.evaluations (course_id, title, kind, status) values ($1, 'Quiz', 'quiz', 'draft') returning id`, [course]);
  await db.query(`insert into public.enrollments (learner_id, course_id, status) values ($1, $2, 'confirmed')`, [la, course]);
}, 120_000);
afterAll(async () => { await db.close(); });

describe("brouillon et publication", () => {
  it("un brouillon peut être créé sans fichier", async () => {
    await expect(content({ type: "document" })).resolves.toBeTruthy();
    await expect(content({ type: "quiz" })).resolves.toBeTruthy();
  });

  it("la publication exige un fichier ou un lien pour un document ou une vidéo", async () => {
    await expect(content({ type: "document", status: "published" })).rejects.toThrow(/content_media_required/);
    await expect(content({ type: "video", status: "published" })).rejects.toThrow(/content_media_required/);
    await expect(content({ type: "video", status: "published", url: "https://youtu.be/abc" })).resolves.toBeTruthy();
    await expect(content({ type: "document", status: "published", file: "u/doc.pdf" })).resolves.toBeTruthy();
  });

  it("un quiz publié doit être lié à une activité d'évaluation", async () => {
    await expect(content({ type: "quiz", status: "published" })).rejects.toThrow(/content_quiz_required/);
    await expect(content({ type: "quiz", status: "published", evaluation: quizEval })).resolves.toBeTruthy();
  });

  it("une étude de cas ou une activité publiée doit avoir un énoncé", async () => {
    await expect(content({ type: "case_study", status: "published" })).rejects.toThrow(/content_text_required/);
    await expect(content({ type: "case_study", status: "published", description: "Énoncé de la situation" })).resolves.toBeTruthy();
    await expect(content({ type: "practice", status: "published", body: "Consigne" })).resolves.toBeTruthy();
  });
});

describe("visibilité pour les apprenants", () => {
  it("masqué, pas encore publié ou échu : invisible de l'inscrit, visible du formateur", async () => {
    const hidden = await content({ status: "published", file: "u/a.pdf", visible: false });
    const future = await content({ status: "published", file: "u/b.pdf", publishAt: new Date(Date.now() + 5 * 86_400_000).toISOString() });
    const expired = await content({ status: "published", file: "u/c.pdf", publishAt: new Date(Date.now() - 9 * 86_400_000).toISOString(), until: new Date(Date.now() - 86_400_000).toISOString() });
    const visible = await content({ status: "published", file: "u/d.pdf" });
    const seen = (await rows<{ id: string }>(la, `select id from public.learning_contents`)).map((r) => r.id);
    expect(seen).toContain(visible);
    for (const id of [hidden, future, expired]) expect(seen).not.toContain(id);
    const owner = (await rows<{ id: string }>(ins, `select id from public.learning_contents`)).map((r) => r.id);
    for (const id of [hidden, future, expired, visible]) expect(owner).toContain(id);
  });

  it("une personne non inscrite ne voit aucun contenu", async () => {
    expect(await rows(stranger, `select id from public.learning_contents`)).toHaveLength(0);
  });
});

describe("prérequis et progression", () => {
  it("un contenu ne peut être terminé qu'après son prérequis", async () => {
    const first = await content({ status: "published", file: "u/e.pdf" });
    const second = await content({ status: "published", file: "u/f.pdf", prerequisite: first });
    await expect(rows(la, `select set_content_completed($1, true)`, [second])).rejects.toThrow(/prerequisite_content_missing/);
    await rows(la, `select set_content_completed($1, true)`, [first]);
    await expect(rows(la, `select set_content_completed($1, true)`, [second])).resolves.toHaveLength(1);
  });

  it("un contenu masqué ne peut pas être terminé", async () => {
    const hidden = await content({ status: "published", file: "u/g.pdf", visible: false });
    await expect(rows(la, `select set_content_completed($1, true)`, [hidden])).rejects.toThrow(/content_not_available/);
  });

  it("seuls les contenus obligatoires et visibles comptent pour le certificat", async () => {
    const course2 = await one(
      `insert into public.courses (instructor_id, title, slug, status, published_at, price_amount) values ($1, 'Autre', 'autre', 'published', now(), 0) returning id`, [ins]);
    const mod2 = await one(`insert into public.course_modules (course_id, title, position) values ($1, 'Module bis', 1) returning id`, [course2]);
    const add = (required: boolean, visible: boolean, pos: number) => one(
      `insert into public.learning_contents (module_id, title, content_type, body, status, duration_minutes, position, is_required, is_visible)
       values ($1, 'Leçon test', 'text', 'Texte', 'published', 5, $2, $3, $4) returning id`, [mod2, pos, required, visible]);
    const mustDo = await add(true, true, 1);
    await add(false, true, 2);   // facultatif
    await add(true, false, 3);   // masqué
    const enroll = await one(`insert into public.enrollments (learner_id, course_id, status) values ($1, $2, 'confirmed') returning id`, [la, course2]);
    const elig = async () => (await rows<{ r: { reasons: string[] } }>(ins, `select public.certificate_eligibility($1) as r`, [enroll]))[0].r.reasons;
    expect(await elig()).toContain("contents_incomplete");
    await db.query(`insert into public.content_completions (learner_id, content_id) values ($1, $2)`, [la, mustDo]);
    expect(await elig()).not.toContain("contents_incomplete");
  });
});

describe("fichiers et liens complémentaires", () => {
  let target: string;
  const add = (user: string, kind: "file" | "link", extra: Record<string, string>) =>
    as(user, () => db.query(
      `insert into public.content_attachments (content_id, kind, name, file_path, url, size_bytes) values ($1, $2, 'Pièce', $3, $4, 1000)`,
      [target, kind, extra.file ?? null, extra.url ?? null]));

  it("le formateur du contenu ajoute fichiers et liens, un autre formateur non", async () => {
    target = await content({ status: "published", file: "u/h.pdf" });
    await add(ins, "file", { file: "u/h-extra.docx" });
    await add(ins, "link", { url: "https://exemple.ci/ressource" });
    await expect(add(other, "link", { url: "https://exemple.ci/x" })).rejects.toThrow();
  });

  it("un fichier doit avoir un chemin et un lien une adresse https", async () => {
    await expect(add(ins, "file", {})).rejects.toThrow();
    await expect(add(ins, "link", { url: "http://non-securise.ci" })).rejects.toThrow();
  });

  it("l'inscrit voit les liens et les fichiers autorisés, pas les fichiers quand le téléchargement est désactivé", async () => {
    expect(await rows(la, `select id from public.content_attachments where content_id = $1`, [target])).toHaveLength(2);
    await db.query(`update public.learning_contents set allow_download = false where id = $1`, [target]);
    const kinds = (await rows<{ kind: string }>(la, `select kind from public.content_attachments where content_id = $1`, [target])).map((r) => r.kind);
    expect(kinds).toEqual(["link"]);
    expect(await rows(stranger, `select id from public.content_attachments`)).toHaveLength(0);
  });
});

describe("notification des apprenants", () => {
  const notifications = async () => (await rows<{ kind: string }>(la, `select kind from public.notifications where kind = 'content_published'`)).length;

  it("notifie les inscrits à la publication quand l'option est active", async () => {
    const before = await notifications();
    const id = await content({ status: "draft", file: "u/n.pdf", notify: true });
    await db.query(`update public.learning_contents set status = 'published' where id = $1`, [id]);
    expect(await notifications()).toBe(before + 1);
  });

  it("ne notifie pas sans l'option, ni pour une publication future", async () => {
    const before = await notifications();
    await content({ status: "published", file: "u/o.pdf", notify: false });
    await content({ status: "published", file: "u/p.pdf", notify: true, publishAt: new Date(Date.now() + 86_400_000).toISOString() });
    expect(await notifications()).toBe(before);
  });
});
