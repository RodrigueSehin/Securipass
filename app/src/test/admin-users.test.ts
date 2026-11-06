import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { addUser, asUser, createTestDb, type TestDb } from "./pg-harness";

let db: TestDb;
let admin: string, ins: string, learner: string, company: string;

type Row = { id: string; email: string; roles: string[]; organization: string | null; status: string; last_sign_in_at: string | null };
type List = { total: number; rows: Row[] };
const as = <T,>(u: string | null, fn: () => Promise<T>) => asUser(db, u, fn);
const list = (u: string | null, args: Record<string, unknown> = {}) => as(u, async () => {
  const a = { q: "", role: "", status: "", period: "", asc: false, limit: 10, offset: 0, ...args };
  return (await db.query<{ r: List }>(`select public.admin_list_users($1,$2,$3,$4,$5,$6,$7) as r`, [a.q, a.role, a.status, a.period, a.asc, a.limit, a.offset])).rows[0].r;
});
const call = (u: string | null, sql: string, p: unknown[] = []) => as(u, async () => (await db.query(sql, p)).rows);

beforeAll(async () => {
  db = await createTestDb();
  admin = await addUser(db, "admin@x.ci", ["admin"], "Claire Yao");
  ins = await addUser(db, "ins@x.ci", ["instructor"], "Aminata Traoré");
  learner = await addUser(db, "jean_koffi@x.ci", [], "Jean Koffi");
  company = await addUser(db, "contact@sodeci.ci", ["company"], "Entreprise SODECI");
  const org = (await db.query<{ id: string }>(`insert into public.organizations (name) values ('SODECI') returning id`)).rows[0].id;
  await db.query(`insert into public.organization_members (organization_id, user_id, role) values ($1, $2, 'owner')`, [org, company]);
  await db.query(`update auth.users set last_sign_in_at = '2026-05-12T14:32:00Z' where id = $1`, [learner]);
  await db.query(`update public.profiles set created_at = now() - interval '200 days' where id = $1`, [ins]);
}, 120_000);
afterAll(async () => { await db.close(); });

describe("liste des utilisateurs", () => {
  it("renvoie rôles triés, organisation et dernière connexion", async () => {
    const r = await list(admin);
    expect(r.total).toBe(4);
    const sodeci = r.rows.find((x) => x.email === "contact@sodeci.ci")!;
    expect(sodeci.organization).toBe("SODECI");
    expect(sodeci.roles).toEqual(["company", "learner"]);
    expect(r.rows.find((x) => x.email === "jean_koffi@x.ci")!.last_sign_in_at).toContain("2026-05-12");
  });

  it("filtre par texte (caractères spéciaux littéraux), rôle, statut et période", async () => {
    expect((await list(admin, { q: "jean_koffi" })).total).toBe(1);
    expect((await list(admin, { q: "%" })).total).toBe(0);
    expect((await list(admin, { q: "traoré" })).rows[0].email).toBe("ins@x.ci");
    expect((await list(admin, { role: "instructor" })).total).toBe(1);
    expect((await list(admin, { role: "company" })).total).toBe(1);
    expect((await list(admin, { period: "90d" })).total).toBe(3);
    expect((await list(admin, { status: "suspended" })).total).toBe(0);
  });

  it("trie par date d'inscription et pagine", async () => {
    const first = await list(admin, { limit: 2, offset: 0, asc: true });
    expect(first.rows).toHaveLength(2);
    expect(first.rows[0].email).toBe("ins@x.ci");
    const second = await list(admin, { limit: 2, offset: 2, asc: true });
    expect(second.rows.map((x) => x.id)).not.toContain(first.rows[0].id);
    expect((await list(admin, { limit: 2, offset: 100 })).rows).toHaveLength(0);
  });

  it("est réservée aux administrateurs", async () => {
    await expect(list(ins)).rejects.toThrow(/forbidden/);
    await expect(list(learner)).rejects.toThrow(/forbidden/);
    await expect(list(null)).rejects.toThrow();
  });
});

describe("indicateurs", () => {
  it("comptent les comptes par profil, avec le mois courant", async () => {
    const [{ s }] = (await call(admin, `select public.admin_users_stats() as s`)) as { s: Record<string, { count: number; month: number }> }[];
    expect(s.total.count).toBe(4);
    expect(s.learner.count).toBe(4);
    expect(s.instructor.count).toBe(1);
    expect(s.admin.count).toBe(1);
    expect(s.total.month).toBe(3);
  });
});

describe("rôles et statut", () => {
  it("remplace les rôles et trace l'action", async () => {
    await call(admin, `select public.admin_set_user_roles($1, $2)`, [learner, ["learner", "instructor"]]);
    const roles = (await db.query<{ code: string }>(`select r.code from public.user_roles ur join public.roles r on r.id = ur.role_id where ur.user_id = $1 order by 1`, [learner])).rows.map((x) => x.code);
    expect(roles).toEqual(["instructor", "learner"]);
    await call(admin, `select public.admin_set_user_roles($1, $2)`, [learner, ["learner"]]);
    const logs = await db.query(`select 1 from public.audit_logs where action = 'user.roles' and entity_id = $1`, [learner]);
    expect(logs.rows).toHaveLength(2);
  });

  it("refuse les rôles inconnus, vides, et le retrait de son propre rôle d'administrateur", async () => {
    await expect(call(admin, `select public.admin_set_user_roles($1, $2)`, [learner, ["superman"]])).rejects.toThrow(/role_unknown/);
    await expect(call(admin, `select public.admin_set_user_roles($1, $2)`, [learner, []])).rejects.toThrow(/roles_required/);
    await expect(call(admin, `select public.admin_set_user_roles($1, $2)`, [admin, ["learner"]])).rejects.toThrow(/cannot_demote_self/);
  });

  it("suspend et réactive, sans pouvoir se suspendre soi-même", async () => {
    await call(admin, `select public.admin_set_user_status($1, 'suspended')`, [learner]);
    expect((await list(admin, { status: "suspended" })).rows.map((x) => x.id)).toEqual([learner]);
    await call(admin, `select public.admin_set_user_status($1, 'active')`, [learner]);
    expect((await list(admin, { status: "suspended" })).total).toBe(0);
    await expect(call(admin, `select public.admin_set_user_status($1, 'suspended')`, [admin])).rejects.toThrow(/cannot_suspend_self/);
    await expect(call(admin, `select public.admin_set_user_status($1, 'banni')`, [learner])).rejects.toThrow(/status_invalid/);
  });

  it("est interdit aux autres profils", async () => {
    await expect(call(ins, `select public.admin_set_user_roles($1, $2)`, [learner, ["admin"]])).rejects.toThrow(/forbidden/);
    await expect(call(learner, `select public.admin_set_user_status($1, 'suspended')`, [ins])).rejects.toThrow(/forbidden/);
  });
});
