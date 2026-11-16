import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { addUser, asUser, createTestDb, type TestDb } from "./pg-harness";

let db: TestDb;
let admin: string, ins: string, ins2: string, learner: string;
let course: string, course2: string;

type Row = { instructor_id: string; course_id: string; session_id: string | null; revenue: number; amount: number; rate: number; status: string; pending_amount: number };
type List = { total: number; rows: Row[] };
const as = <T,>(u: string | null, fn: () => Promise<T>) => asUser(db, u, fn);
const list = (u: string | null, args: Record<string, unknown> = {}) => as(u, async () => {
  const a = { q: "", month: "", status: "", instructor: null, limit: 10, offset: 0, ...args };
  return (await db.query<{ r: List }>(`select public.admin_list_commissions($1,$2,$3,$4,$5,$6) as r`, [a.q, a.month, a.status, a.instructor, a.limit, a.offset])).rows[0].r;
});
const stats = (u: string | null) => as(u, async () => (await db.query<{ r: Record<string, number | { month: string; amount: number }[]> }>(`select public.admin_commissions_stats() as r`)).rows[0].r);
const pay = (u: string | null, i: string, c: string, s: string | null) => as(u, async () => (await db.query(`select public.admin_pay_commissions($1,$2,$3,null)`, [i, c, s])).rows);
const newCourse = async (instructor: string, title: string) =>
  (await db.query<{ id: string }>(`insert into public.courses (instructor_id, title, slug) values ($1, $2, $3) returning id`, [instructor, title, title.toLowerCase().replace(/\W+/g, "-")])).rows[0].id;
const payment = async (courseId: string, amount: number, status = "confirmed") =>
  (await db.query<{ id: string }>(`insert into public.payments (kind, learner_id, course_id, amount, method, status) values ('course', $1, $2, $3, 'cash', $4) returning id`, [learner, courseId, amount, status])).rows[0].id;

beforeAll(async () => {
  db = await createTestDb();
  admin = await addUser(db, "admin@x.ci", ["admin"], "Claire Yao");
  ins = await addUser(db, "ins@x.ci", ["instructor"], "Koffi Jean");
  ins2 = await addUser(db, "ins2@x.ci", ["instructor"], "Aminata Traoré");
  learner = await addUser(db, "l@x.ci", [], "Jean Apprenant");
  course = await newCourse(ins, "SST Secourisme");
  course2 = await newCourse(ins2, "Sécurité incendie");
}, 120_000);
afterAll(async () => { await db.close(); });

describe("création des commissions", () => {
  it("suit les paiements confirmés au taux de 15 %", async () => {
    const p1 = await payment(course, 1_000_000);
    await payment(course, 200_000);
    await payment(course2, 800_000);
    await payment(course2, 500_000, "pending");
    const r = await list(admin);
    expect(r.total).toBe(2);
    const sst = r.rows.find((x) => x.course_id === course)!;
    expect(sst).toMatchObject({ revenue: 1_200_000, amount: 180_000, rate: 15, status: "pending", pending_amount: 180_000 });
    expect(r.rows.find((x) => x.course_id === course2)!.amount).toBe(120_000);
    // la confirmation d'un paiement en attente crée sa commission
    await db.query(`update public.payments set status = 'confirmed' where course_id = $1 and status = 'pending'`, [course2]);
    expect((await list(admin, { instructor: ins2 })).rows[0].amount).toBe(195_000);
    // un paiement annulé retire sa commission en attente
    await db.query(`update public.payments set status = 'cancelled' where id = $1`, [p1]);
    expect((await list(admin, { instructor: ins })).rows[0].amount).toBe(30_000);
  });

  it("ignore les paiements sans formation", async () => {
    await db.query(`insert into public.payments (kind, learner_id, amount, method, status) values ('other', $1, 50000, 'cash', 'confirmed')`, [learner]);
    expect((await list(admin)).total).toBe(2);
  });
});

describe("filtres et indicateurs", () => {
  it("filtre par texte, formateur, mois et statut", async () => {
    expect((await list(admin, { q: "incendie" })).total).toBe(1);
    expect((await list(admin, { q: "traoré" })).rows[0].course_id).toBe(course2);
    expect((await list(admin, { q: "%" })).total).toBe(0);
    expect((await list(admin, { instructor: ins })).total).toBe(1);
    expect((await list(admin, { month: "1999-01" })).total).toBe(0);
    expect((await list(admin, { status: "paid" })).total).toBe(0);
    expect((await list(admin, { status: "pending" })).total).toBe(2);
    expect((await list(admin, { limit: 1, offset: 1 })).rows).toHaveLength(1);
  });

  it("calcule revenus, commissions, solde et évolution mensuelle", async () => {
    const s = await stats(admin);
    expect(s.rate).toBe(15);
    expect(s.revenue).toBe(200_000 + 1_300_000);
    expect(s.commission).toBe(30_000 + 195_000);
    expect(s.pending).toBe(225_000);
    expect(s.paid).toBe(0);
    expect(s.months as unknown[]).toHaveLength(6);
  });
});

describe("versements", () => {
  it("verse un groupe, solde ses commissions et trace le versement", async () => {
    await pay(admin, ins2, course2, null);
    const r = await list(admin, { instructor: ins2 });
    expect(r.rows[0]).toMatchObject({ status: "paid", pending_amount: 0 });
    const s = await stats(admin);
    expect(s.paid).toBe(195_000);
    expect(s.pending).toBe(30_000);
    const payouts = await as(admin, async () => (await db.query<{ r: { total: number; rows: { amount: number; reference: string; commissions: number }[] } }>(`select public.admin_list_payouts(10,0) as r`)).rows[0].r);
    expect(payouts.total).toBe(1);
    expect(payouts.rows[0]).toMatchObject({ amount: 195_000, commissions: 2 });
    expect(payouts.rows[0].reference).toMatch(/^VER-\d{4}-0001$/);
    const audit = await db.query(`select 1 from public.audit_logs where action = 'payout.create'`);
    expect(audit.rows).toHaveLength(1);
    const recent = await as(admin, async () => (await db.query<{ r: { amount: number }[] }>(`select public.admin_recent_payouts(3) as r`)).rows[0].r);
    expect(recent[0].amount).toBe(195_000);
  });

  it("refuse de verser deux fois ou sans commission", async () => {
    await expect(pay(admin, ins2, course2, null)).rejects.toThrow(/nothing_to_pay/);
    await expect(pay(admin, ins, course2, null)).rejects.toThrow(/nothing_to_pay/);
  });

  it("conserve une commission déjà versée si le paiement change ensuite", async () => {
    await db.query(`update public.payments set amount = 1 where course_id = $1`, [course2]);
    expect((await list(admin, { instructor: ins2 })).rows[0].amount).toBe(195_000);
  });
});

describe("taux de commission", () => {
  it("ne change que les commissions à venir", async () => {
    await as(admin, async () => db.query(`select public.admin_set_commission_rate(20)`));
    const p = await payment(course, 100_000);
    expect((await list(admin, { instructor: ins })).rows[0]).toMatchObject({ amount: 50_000, revenue: 300_000 });
    expect(p).toBeTruthy();
    await expect(as(admin, async () => db.query(`select public.admin_set_commission_rate(120)`))).rejects.toThrow(/rate_invalid/);
  });
});

describe("accès", () => {
  it("est réservé aux administrateurs", async () => {
    await expect(list(ins)).rejects.toThrow(/forbidden/);
    await expect(stats(learner)).rejects.toThrow(/forbidden/);
    await expect(pay(ins, ins, course, null)).rejects.toThrow(/forbidden/);
  });

  it("laisse un formateur lire seulement ses commissions", async () => {
    const rows = await as(ins, async () => (await db.query<{ instructor_id: string }>(`select instructor_id from public.commissions`)).rows);
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.every((r) => r.instructor_id === ins)).toBe(true);
  });
});

describe("versement détaillé", () => {
  type Group = { course_id: string; amount: number; ids: string[] };
  type Inst = { id: string; name: string; groups: Group[] };
  const options = () => as(admin, async () => (await db.query<{ r: { instructors: Inst[] } }>(`select public.admin_payout_options() as r`)).rows[0].r.instructors);
  const create = (u: string | null, i: string, ids: string[], fees = 0, method = "bank_transfer", paidAt = "now()") => as(u, async () =>
    (await db.query<{ r: { id: string; reference: string } }>(`select public.admin_create_payout($1,$2::uuid[],$3,(${paidAt})::timestamptz,$4,'Koffi Jean','SIB','CI93','Motif',null) as r`, [i, ids, method, fees])).rows[0].r);

  it("liste les formateurs avec leurs lignes à verser", async () => {
    await payment(course2, 100_000);
    const o = await options();
    expect(o.map((x) => x.id).sort()).toEqual([ins, ins2].sort());
    const k = o.find((x) => x.id === ins)!;
    expect(k.groups[0].amount).toBeGreaterThan(0);
    expect(k.groups[0].ids.length).toBeGreaterThan(0);
  });

  it("verse les commissions choisies avec frais, coordonnées et audit", async () => {
    const k = (await options()).find((x) => x.id === ins)!;
    const ids = k.groups.flatMap((g) => g.ids);
    const total = k.groups.reduce((n, g) => n + g.amount, 0);
    const r = await create(admin, ins, ids, 1_000);
    expect(r.reference).toMatch(/^VER-\d{4}-\d{4}$/);
    const p = (await db.query<{ amount: number; fees_amount: number; account_holder: string; bank_name: string; method: string }>(`select amount, fees_amount, account_holder, bank_name, method from public.payouts where id = $1`, [r.id])).rows[0];
    expect(Number(p.amount)).toBe(total);
    expect(p).toMatchObject({ fees_amount: 1000, account_holder: "Koffi Jean", bank_name: "SIB", method: "bank_transfer" });
    expect((await options()).some((x) => x.id === ins)).toBe(false);
    const audit = await db.query(`select 1 from public.audit_logs where action = 'payout.create' and entity_id = $1`, [r.id]);
    expect(audit.rows).toHaveLength(1);
  });

  it("refuse les commissions déjà versées, d'un autre formateur, les frais excessifs et les dates futures", async () => {
    const k2 = (await options()).find((x) => x.id === ins2)!;
    const ids2 = k2.groups.flatMap((g) => g.ids);
    await expect(create(admin, ins, ids2)).rejects.toThrow(/commissions_invalid/);
    await expect(create(admin, ins2, ids2, 999_999_999)).rejects.toThrow(/fees_invalid/);
    await expect(create(admin, ins2, ids2, 0, "bank_transfer", "now() + interval '2 days'")).rejects.toThrow(/date_invalid/);
    await expect(create(admin, ins2, [])).rejects.toThrow(/commissions_required/);
    await expect(create(admin, ins2, ids2, 0, "troc")).rejects.toThrow(/method_invalid/);
    await create(admin, ins2, ids2, 0, "cash");
    await expect(create(admin, ins2, ids2)).rejects.toThrow(/commissions_invalid/);
  });

  it("est réservé aux administrateurs", async () => {
    await expect(as(ins, async () => db.query(`select public.admin_payout_options()`))).rejects.toThrow(/forbidden/);
    await expect(create(ins, ins, [])).rejects.toThrow(/forbidden/);
  });
});
