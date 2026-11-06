import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { addUser, asUser, createTestDb, type TestDb } from "./pg-harness";

let db: TestDb;
let ins: string, other: string, admin: string, la: string, lb: string;
let course: string, content: string, template: string, session: string, enrollA: string, enrollB: string;

const one = async (sql: string, p: unknown[] = []) => (await db.query<{ id: string }>(sql, p)).rows[0]?.id;
const as = <T,>(u: string | null, fn: () => Promise<T>) => asUser(db, u, fn);
const rows = async <T = Record<string, unknown>>(u: string | null, sql: string, p: unknown[] = []) =>
  as(u, async () => (await db.query<T>(sql, p)).rows);
const issue = (u: string, enroll: string, params: Record<string, unknown> = {}) =>
  as(u, async () => (await db.query<{ r: { id: string; certificate_number: string; verification_token: string } }>(
    `select public.issue_certificate($1, $2, $3::jsonb) as r`, [enroll, template, JSON.stringify(params)])).rows[0].r);
const verify = (code: string) => as(null, async () => (await db.query<{ r: Record<string, unknown> }>(
  `select public.verify_certificate($1) as r`, [code])).rows[0].r);

beforeAll(async () => {
  db = await createTestDb();
  ins = await addUser(db, "ins5@x.ci", ["instructor"]);
  other = await addUser(db, "other5@x.ci", ["instructor"]);
  admin = await addUser(db, "adm5@x.ci", ["admin"]);
  la = await addUser(db, "la5@x.ci", [], "Awa Koné");
  lb = await addUser(db, "lb5@x.ci", [], "Yao Kouadio");

  course = await one(
    `insert into public.courses (instructor_id, category_id, title, slug, status, published_at, duration_minutes)
     values ($1, (select id from public.categories limit 1), 'Certif test', 'certif-test', 'published', now(), 30) returning id`, [ins]);
  const mod = await one(`insert into public.course_modules (course_id, title, position) values ($1, 'Module', 1) returning id`, [course]);
  content = await one(
    `insert into public.learning_contents (module_id, title, content_type, body, status, duration_minutes, position)
     values ($1, 'Leçon', 'text', 'Texte', 'published', 10, 1) returning id`, [mod]);
  template = await one(`select id from public.certificate_templates where layout = 'classic'`);

  session = await one(
    `insert into public.sessions (course_id, instructor_id, title, start_at, end_at, delivery_mode, location, capacity)
     values ($1, $2, 'Session certif', now() - interval '20 days', now() - interval '19 days', 'onsite', 'Abidjan', 10) returning id`, [course, ins]);
  enrollA = await one(
    `insert into public.enrollments (learner_id, course_id, status) values ($1, $2, 'confirmed') returning id`, [la, course]);
  enrollB = await one(
    `insert into public.enrollments (learner_id, course_id, session_id, status) values ($1, $2, $3, 'confirmed') returning id`, [lb, course, session]);
}, 120_000);
afterAll(async () => { await db.close(); });

describe("éligibilité", () => {
  it("refuse l'émission tant que les leçons ne sont pas terminées", async () => {
    await expect(as(ins, () => db.query(`select public.issue_certificate($1, $2, '{}'::jsonb)`, [enrollA, template]))).rejects.toThrow(/not_eligible/);
    const r = await rows<{ r: { eligible: boolean; reasons: string[] } }>(ins, `select public.certificate_eligibility($1) as r`, [enrollA]);
    expect(r[0].r.eligible).toBe(false);
    expect(r[0].r.reasons).toContain("contents_incomplete");
  });

  it("une présence insuffisante bloque l'émission, même si les leçons sont faites", async () => {
    await db.query(`insert into public.content_completions (learner_id, content_id) values ($1, $2)`, [lb, content]);
    await db.query(`insert into public.attendance_records (session_id, learner_id, status) values ($1, $2, 'absent')`, [session, lb]);
    const r = await rows<{ r: { reasons: string[] } }>(ins, `select public.certificate_eligibility($1) as r`, [enrollB]);
    expect(r[0].r.reasons).toEqual(["attendance_insufficient"]);
    await expect(issue(ins, enrollB)).rejects.toThrow(/not_eligible/);
  });
});

describe("émission", () => {
  it("un élève ne peut pas émettre son propre certificat", async () => {
    await db.query(`insert into public.content_completions (learner_id, content_id) values ($1, $2) on conflict do nothing`, [la, content]);
    await expect(as(la, () => db.query(`select public.issue_certificate($1, $2, '{}'::jsonb)`, [enrollA, template]))).rejects.toThrow(/forbidden/);
  });

  it("un autre formateur ne peut pas émettre pour une formation qui n'est pas la sienne", async () => {
    await expect(issue(other, enrollA)).rejects.toThrow(/forbidden/);
  });

  it("le formateur émet : numéro unique, jeton, contenu figé avec le nom et le texte rendu", async () => {
    const c = await issue(ins, enrollA, { signatory_name: "Dr Traoré", signatory_role: "Responsable pédagogique" });
    expect(c.certificate_number).toMatch(/^SP-\d{4}-\d{6}$/);
    expect(c.verification_token).toMatch(/^[0-9a-f]{64}$/);
    const row = (await db.query<{ content: Record<string, string>; pdf_path: string }>(
      `select content, pdf_path from public.certificates where id = $1`, [c.id])).rows[0];
    expect(row.content.holder_name).toBe("Awa Koné");
    expect(row.content.body).toContain("Awa Koné");
    expect(row.content.body).not.toContain("{{");
    expect(row.content.signatory_name).toBe("Dr Traoré");
    expect(row.pdf_path).toBe(`${c.id}.pdf`);
  });

  it("empêche un second certificat actif pour la même inscription", async () => {
    await expect(issue(ins, enrollA)).rejects.toThrow(/certificates_one_active|duplicate key/);
  });

  it("l'apprenant voit son certificat, un autre apprenant non", async () => {
    expect(await rows(la, `select id from public.certificates`)).toHaveLength(1);
    expect(await rows(lb, `select id from public.certificates`)).toHaveLength(0);
  });
});

describe("vérification publique", () => {
  it("renvoie le statut réel, avec prénom et initiale seulement", async () => {
    const [{ certificate_number, verification_token }] = await rows<{ certificate_number: string; verification_token: string }>(
      ins, `select certificate_number, verification_token from public.certificates where learner_id = $1`, [la]);
    const byNumber = await verify(certificate_number);
    expect(byNumber).toMatchObject({ found: true, status: "valid", holder_name: "Awa K.", issuer: "SECURIPASS" });
    expect(JSON.stringify(byNumber)).not.toContain("Koné");
    expect((await verify(verification_token)).found).toBe(true);
  });

  it("un code inconnu ne révèle rien", async () => {
    expect(await verify("SP-0000-999999")).toEqual({ found: false });
    expect(await verify("x")).toEqual({ found: false });
  });

  it("chaque vérification est tracée", async () => {
    const n = (await db.query<{ n: number }>(`select count(*)::int as n from public.certificate_verifications`)).rows[0].n;
    expect(n).toBeGreaterThan(0);
  });
});

describe("suspension, révocation, réémission", () => {
  let certId: string;
  beforeAll(async () => {
    certId = await one(`select id from public.certificates where learner_id = $1`, [la]);
  });

  it("la suspension est visible à la vérification, puis levée", async () => {
    await as(ins, () => db.query(`select public.change_certificate_status($1, 'suspend', 'Vérification en cours')`, [certId]));
    const code = (await db.query<{ certificate_number: string }>(`select certificate_number from public.certificates where id=$1`, [certId])).rows[0].certificate_number;
    expect((await verify(code)).status).toBe("suspended");
    await as(ins, () => db.query(`select public.change_certificate_status($1, 'reinstate')`, [certId]));
    expect((await verify(code)).status).toBe("valid");
  });

  it("une révocation exige un motif", async () => {
    await expect(as(ins, () => db.query(`select public.change_certificate_status($1, 'revoke')`, [certId]))).rejects.toThrow(/reason_required/);
  });

  it("la réémission révoque l'ancien, émet le nouveau et les relie", async () => {
    const r = await as(ins, async () => (await db.query<{ r: { id: string; certificate_number: string } }>(
      `select public.reissue_certificate($1, $2, '{}'::jsonb, 'Erreur sur le nom du titulaire') as r`, [certId, template])).rows[0].r);
    const old = (await db.query<{ status: string; revocation_reason: string; code: string }>(
      `select status, revocation_reason, certificate_number as code from public.certificates where id = $1`, [certId])).rows[0];
    expect(old.status).toBe("revoked");
    expect(old.revocation_reason).toBe("Erreur sur le nom du titulaire");
    expect(await verify(old.code)).toMatchObject({ status: "revoked" });

    const fresh = (await db.query<{ replaces_id: string; status: string }>(`select replaces_id, status from public.certificates where id = $1`, [r.id])).rows[0];
    expect(fresh).toMatchObject({ replaces_id: certId, status: "valid" });
    expect(await verify(r.certificate_number)).toMatchObject({ status: "valid" });
  });

  it("la trace des événements est conservée", async () => {
    const ev = await rows<{ event_type: string }>(la, `select event_type from public.certificate_events where certificate_id = $1 order by created_at`, [certId]);
    expect(ev.map((e) => e.event_type)).toEqual(expect.arrayContaining(["issued", "suspended", "reinstated", "revoked", "reissued"]));
  });
});

describe("expiration et modèles", () => {
  it("un certificat dont la validité est dépassée est vérifié comme expiré", async () => {
    const c = await issue(admin, enrollB).catch(() => null);
    expect(c).toBeNull(); // Yao n'est pas éligible : l'administrateur ne contourne pas les conditions
    await db.query(`insert into public.content_completions (learner_id, content_id) values ($1, $2) on conflict do nothing`, [lb, content]);
    await db.query(`update public.attendance_records set status = 'present' where learner_id = $1`, [lb]);
    const issued = await issue(ins, enrollB, { validity_months: 12 });
    await db.query(`update public.certificates set issued_at = now() - interval '2 years', valid_until = now() - interval '1 day' where id = $1`, [issued.id]);
    expect(await verify(issued.certificate_number)).toMatchObject({ status: "expired" });
  });

  it("un modèle non publié ne peut pas servir", async () => {
    const draft = await one(`insert into public.certificate_templates (name, layout, title, body) values ('Brouillon', 'modern', 'Titre', 'Texte') returning id`);
    await expect(as(ins, () => db.query(`select public.issue_certificate($1, $2, '{}'::jsonb)`, [enrollB, draft]))).rejects.toThrow(/template_not_available/);
  });

  it("le formateur ne peut pas gérer les modèles", async () => {
    await expect(as(ins, () => db.query(`insert into public.certificate_templates (name, layout, title, body) values ('X', 'modern', 'T', 'Texte')`))).rejects.toThrow(/row-level security/);
  });
});
