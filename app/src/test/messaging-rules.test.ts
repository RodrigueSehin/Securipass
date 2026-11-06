import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { addUser, asUser, createTestDb, type TestDb } from "./pg-harness";

let db: TestDb;
let ins: string, other: string, support: string, la: string, lb: string;
let course: string, convCourse: string, convSupport: string;

const one = async (sql: string, p: unknown[] = []) => (await db.query<{ id: string }>(sql, p)).rows[0]?.id;
const as = <T,>(u: string | null, fn: () => Promise<T>) => asUser(db, u, fn);
const rows = async <T = Record<string, unknown>>(u: string | null, sql: string, p: unknown[] = []) =>
  as(u, async () => (await db.query<T>(sql, p)).rows);
const send = (u: string, conv: string, body: string) =>
  as(u, async () => (await db.query<{ id: string }>(`select public.send_message($1, $2) as id`, [conv, body])).rows[0].id);

beforeAll(async () => {
  db = await createTestDb();
  ins = await addUser(db, "ins-m@x.ci", ["instructor"]);
  other = await addUser(db, "other-m@x.ci", ["instructor"]);
  support = await addUser(db, "support-m@x.ci", ["support"]);
  la = await addUser(db, "la-m@x.ci");
  lb = await addUser(db, "lb-m@x.ci");

  course = await one(
    `insert into public.courses (instructor_id, category_id, title, slug, status, published_at, duration_minutes)
     values ($1, (select id from public.categories limit 1), 'Messagerie test', 'msg-test', 'published', now(), 30) returning id`, [ins]);
  await db.query(`insert into public.enrollments (learner_id, course_id, status) values ($1, $2, 'confirmed')`, [la, course]);
}, 120_000);
afterAll(async () => { await db.close(); });

describe("ouverture des conversations", () => {
  it("un non-inscrit ne peut pas ouvrir de conversation de cours", async () => {
    await expect(as(lb, () => db.query(`select public.open_course_conversation($1)`, [course]))).rejects.toThrow(/not_enrolled/);
  });
  it("l'inscrit ouvre une conversation avec le formateur, et la retrouve sans doublon", async () => {
    convCourse = (await as(la, async () => (await db.query<{ id: string }>(`select public.open_course_conversation($1) as id`, [course])).rows[0].id));
    const again = await as(la, async () => (await db.query<{ id: string }>(`select public.open_course_conversation($1) as id`, [course])).rows[0].id);
    expect(again).toBe(convCourse);
  });
  it("l'équipe support a une conversation par apprenant", async () => {
    convSupport = await as(la, async () => (await db.query<{ id: string }>(`select public.open_support_conversation() as id`)).rows[0].id);
    expect(await as(la, async () => (await db.query<{ id: string }>(`select public.open_support_conversation() as id`)).rows[0].id)).toBe(convSupport);
  });
});

describe("participants", () => {
  it("l'apprenant et le formateur de la formation voient la conversation de cours, pas les autres", async () => {
    expect(await rows(la, `select id from public.conversations`)).toHaveLength(2);
    expect(await rows(ins, `select id from public.conversations where id = $1`, [convCourse])).toHaveLength(1);
    expect(await rows(other, `select id from public.conversations where id = $1`, [convCourse])).toHaveLength(0);
    expect(await rows(lb, `select id from public.conversations`)).toHaveLength(0);
  });
  it("le support voit les conversations du support, pas les conversations de cours d'un formateur", async () => {
    expect(await rows(support, `select id from public.conversations where id = $1`, [convSupport])).toHaveLength(1);
    expect(await rows(support, `select id from public.conversations where id = $1`, [convCourse])).toHaveLength(0);
  });
});

describe("messages et lecture", () => {
  it("un message vide, sans pièce jointe, est refusé", async () => {
    await expect(as(la, () => db.query(`select public.send_message($1, '   ')`, [convCourse]))).rejects.toThrow(/empty_message/);
  });
  it("un tiers ne peut pas écrire dans la conversation", async () => {
    await expect(as(lb, () => db.query(`select public.send_message($1, 'Intrus')`, [convCourse]))).rejects.toThrow(/forbidden/);
  });
  it("l'envoi notifie le formateur, et sa réponse notifie l'apprenant", async () => {
    await send(la, convCourse, "Bonjour, une question sur l'exercice 2 ?");
    expect(await rows(ins, `select kind from public.notifications where kind = 'message_received'`)).toHaveLength(1);
    await send(ins, convCourse, "Bien sûr, je vous réponds.");
    expect(await rows(la, `select kind from public.notifications where kind = 'message_received'`)).toHaveLength(1);
  });
  it("le formateur voit un message non lu, puis le lit", async () => {
    await db.query(`delete from public.conversation_reads where conversation_id = $1`, [convCourse]);
    await send(la, convCourse, "Encore une question");
    const unread = async () => (await rows<{ n: number }>(ins,
      `select count(*)::int as n from public.messages m where m.conversation_id = $1 and m.sender_id <> auth.uid()
         and m.created_at > coalesce((select read_at from public.conversation_reads r where r.conversation_id = m.conversation_id and r.profile_id = auth.uid()), '-infinity')`,
      [convCourse]))[0].n;
    expect(await unread()).toBeGreaterThan(0);
    await as(ins, () => db.query(`select public.mark_conversation_read($1)`, [convCourse]));
    expect(await unread()).toBe(0);
  });
});

describe("pièces jointes", () => {
  const pdf = "application/pdf";
  it("un fichier dans le dossier de la conversation, de type autorisé, est accepté", async () => {
    const path = `${convCourse}/${crypto.randomUUID()}/cours.pdf`;
    await as(la, () => db.query(`select public.send_message($1, 'Voici mon travail', $2, 'cours.pdf', 1200, $3)`, [convCourse, path, pdf]));
    const r = await rows(ins, `select attachment_name from public.messages where attachment_path = $1`, [path]);
    expect(r).toHaveLength(1);
  });
  it("un fichier rangé dans le dossier d'une autre conversation est refusé", async () => {
    await expect(as(la, () => db.query(`select public.send_message($1, '', $2, 'x.pdf', 10, $3)`, [convCourse, `${convSupport}/x.pdf`, pdf])))
      .rejects.toThrow(/attachment_invalid/);
  });
  it("un type non autorisé ou un fichier trop lourd est refusé", async () => {
    await expect(as(la, () => db.query(`select public.send_message($1, '', $2, 'x.exe', 10, 'application/x-msdownload')`, [convCourse, `${convCourse}/a/x.exe`])))
      .rejects.toThrow(/attachment_type_not_allowed/);
    await expect(as(la, () => db.query(`select public.send_message($1, '', $2, 'x.pdf', 20000000, $3)`, [convCourse, `${convCourse}/a/x.pdf`, pdf])))
      .rejects.toThrow(/attachment_too_large/);
  });
});

describe("archivage et notifications", () => {
  it("seul l'apprenant archive sa conversation", async () => {
    await as(la, () => db.query(`select public.set_conversation_archived($1, true)`, [convCourse]));
    expect(await rows(la, `select id from public.conversations where archived_by_learner`)).toHaveLength(1);
    await expect(as(ins, () => db.query(`select public.set_conversation_archived($1, true)`, [convCourse]))).rejects.toThrow(/forbidden/);
  });
  it("une réponse du formateur ressort la conversation archivée", async () => {
    await send(ins, convCourse, "Je reviens vers vous.");
    expect(await rows(la, `select id from public.conversations where id = $1 and archived_by_learner`, [convCourse])).toHaveLength(0);
  });
  it("un formateur qui n'est pas celui de la formation ne peut pas lire les notifications de l'apprenant", async () => {
    expect(await rows(other, `select id from public.notifications where recipient_id = $1`, [la])).toHaveLength(0);
  });
});
