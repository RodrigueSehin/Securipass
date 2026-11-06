import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { addUser, createTestDb, type TestDb } from "./pg-harness";

let db: TestDb;
let ins: string, la: string, course: string, enroll: string;

beforeAll(async () => {
  db = await createTestDb();
  ins = await addUser(db, "ins-n@x.ci", ["instructor"]);
  la = await addUser(db, "la-n@x.ci");
  course = (await db.query<{ id: string }>(
    `insert into public.courses (instructor_id, category_id, title, slug, status, published_at, duration_minutes)
     values ($1, (select id from public.categories limit 1), 'Notif test', 'notif-test', 'published', now(), 10) returning id`, [ins])).rows[0].id;
  enroll = (await db.query<{ id: string }>(
    `insert into public.enrollments (learner_id, course_id, status) values ($1, $2, 'confirmed') returning id`, [la, course])).rows[0].id;
}, 120_000);
afterAll(async () => { await db.close(); });

describe("notifications de certificats", () => {
  it("l'émission notifie l'apprenant, une seule fois (pas à la mise à jour du PDF)", async () => {
    const id = (await db.query<{ id: string }>(
      `insert into public.certificates (certificate_number, verification_token, enrollment_id, learner_id, course_id, content, issued_by)
       values ('SP-2026-000900', repeat('a', 64), $1, $2, $3, '{"course_title":"Notif test"}', $4) returning id`,
      [enroll, la, course, ins])).rows[0].id;
    await db.query(`update public.certificates set pdf_path = 'x.pdf' where id = $1`, [id]);
    const kinds = (await db.query<{ kind: string }>(`select kind from public.notifications where recipient_id = $1 and kind = 'certificate_issued'`, [la])).rows;
    expect(kinds).toHaveLength(1);
  });
  it("la révocation notifie", async () => {
    await db.query(`update public.certificates set status = 'revoked', revoked_at = now(), revocation_reason = 'Erreur de saisie' where certificate_number = 'SP-2026-000900'`);
    const kinds = (await db.query<{ kind: string }>(`select kind from public.notifications where recipient_id = $1 and kind = 'certificate_revoked'`, [la])).rows;
    expect(kinds).toHaveLength(1);
  });
});
