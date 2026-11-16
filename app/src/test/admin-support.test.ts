import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { addUser, asUser, createTestDb, type TestDb } from "./pg-harness";

let db: TestDb;
let admin: string, admin2: string, ins: string, aicha: string, moussa: string;

type Row = { id: string; reference: string; subject: string; category: string; priority: string; status: string; requester_name: string; requester_code: string | null; assignee_name: string | null };
type List = { total: number; rows: Row[] };
type Stats = {
  total: number; total_month: number; new: number; in_progress: number; waiting: number; resolved: number; archived: number;
  tabs: Record<string, number>; avg_seconds: number | null; sla: number | null; categories: { category: string; count: number }[];
};
const as = <T,>(u: string | null, fn: () => Promise<T>) => asUser(db, u, fn);
const list = (u: string | null, a: Partial<{ tab: string; q: string; category: string; status: string; priority: string; limit: number; offset: number }> = {}) => as(u, async () => {
  const x = { tab: "all", q: "", category: "", status: "", priority: "", limit: 10, offset: 0, ...a };
  return (await db.query<{ r: List }>(`select public.admin_list_support_tickets($1,$2,$3,$4,$5,$6,$7) as r`, [x.tab, x.q, x.category, x.status, x.priority, x.limit, x.offset])).rows[0].r;
});
const stats = (u: string | null) => as(u, async () => (await db.query<{ r: Stats }>(`select public.admin_support_stats() as r`)).rows[0].r);
const create = (u: string | null, requester: string, subject: string, category = "formations", priority = "medium") => as(u, async () =>
  (await db.query<{ r: { id: string; reference: string } }>(`select public.admin_create_support_ticket($1,$2,'Détail',$3,$4) as r`, [requester, subject, category, priority])).rows[0].r);
const call = (u: string | null, sql: string, p: unknown[] = []) => as(u, async () => (await db.query(sql, p)).rows);
const status = async (id: string) => (await db.query<{ status: string; resolved_at: string | null; archived_at: string | null; assigned_to: string | null }>(`select status, resolved_at, archived_at, assigned_to from public.support_tickets where id = $1`, [id])).rows[0];

let t1: string, t2: string, t3: string;
beforeAll(async () => {
  db = await createTestDb();
  admin = await addUser(db, "admin@x.ci", ["admin"], "Claire Yao");
  admin2 = await addUser(db, "admin2@x.ci", ["admin"], "Paul Kouassi");
  ins = await addUser(db, "ins@x.ci", ["instructor"], "Koffi Jean");
  aicha = await addUser(db, "aicha@x.ci", [], "Kouadio Aïcha");
  moussa = await addUser(db, "moussa@x.ci", [], "Traoré Moussa");
  await db.query(`update public.profiles set learner_code = 'APP-00125' where id = $1`, [aicha]);
  t1 = (await create(admin, aicha, "Impossible d’accéder à ma formation", "formations", "high")).id;
  t2 = (await create(admin, moussa, "Problème de paiement de l’inscription", "paiements", "high")).id;
  t3 = (await create(admin, ins, "Ajouter un apprenant à ma formation", "utilisateurs", "low")).id;
}, 120_000);
afterAll(async () => { await db.close(); });

describe("création", () => {
  it("attribue des références SUP-NNNN successives et le statut « nouveau »", async () => {
    const rows = (await list(admin)).rows;
    expect(rows.map((r) => r.reference).sort()).toEqual(["SUP-0001", "SUP-0002", "SUP-0003"]);
    expect(rows.every((r) => r.status === "new" && r.assignee_name === null)).toBe(true);
    expect((await db.query(`select 1 from public.audit_logs where action = 'support.create'`)).rows).toHaveLength(3);
  });
  it("refuse un sujet trop court, une catégorie inconnue et un demandeur inexistant", async () => {
    await expect(create(admin, aicha, "ab")).rejects.toThrow();
    await expect(create(admin, aicha, "Sujet valide", "inconnue")).rejects.toThrow();
    await expect(create(admin, "00000000-0000-0000-0000-000000000000", "Sujet valide")).rejects.toThrow(/requester_not_found/);
  });
});

describe("liste et filtres", () => {
  it("donne le code du demandeur (matricule ou rôle)", async () => {
    const rows = (await list(admin)).rows;
    expect(rows.find((r) => r.requester_name === "Kouadio Aïcha")!.requester_code).toBe("APP-00125");
    expect(rows.find((r) => r.requester_name === "Koffi Jean")!.requester_code).toBeTruthy();
  });
  it("filtre par texte (référence, sujet, demandeur, matricule), catégorie, priorité et statut", async () => {
    expect((await list(admin, { q: "SUP-0002" })).total).toBe(1);
    expect((await list(admin, { q: "paiement" })).rows[0].reference).toBe("SUP-0002");
    expect((await list(admin, { q: "aïcha" })).total).toBe(1);
    expect((await list(admin, { q: "APP-00125" })).total).toBe(1);
    expect((await list(admin, { q: "%" })).total).toBe(0);
    expect((await list(admin, { category: "utilisateurs" })).total).toBe(1);
    expect((await list(admin, { priority: "high" })).total).toBe(2);
    expect((await list(admin, { status: "waiting" })).total).toBe(0);
  });
  it("pagine", async () => {
    const p1 = await list(admin, { limit: 2, offset: 0 });
    const p2 = await list(admin, { limit: 2, offset: 2 });
    expect(p1.total).toBe(3);
    expect(p1.rows).toHaveLength(2);
    expect(p2.rows).toHaveLength(1);
    expect(p2.rows[0].id).not.toBe(p1.rows[0].id);
  });
});

describe("assignation et statuts", () => {
  it("prend en charge un ticket : assigné et en cours, visible dans « mes tickets »", async () => {
    await call(admin, `select public.admin_assign_support_ticket($1, true)`, [t1]);
    expect(await status(t1)).toMatchObject({ status: "in_progress", assigned_to: admin });
    expect((await list(admin, { tab: "mine" })).rows.map((r) => r.id)).toEqual([t1]);
    expect((await list(admin2, { tab: "mine" })).total).toBe(0);
    expect((await list(admin, { tab: "unassigned" })).total).toBe(2);
    expect((await list(admin)).rows.find((r) => r.id === t1)!.assignee_name).toBe("Claire Yao");
    await call(admin, `select public.admin_assign_support_ticket($1, false)`, [t1]);
    expect((await status(t1)).assigned_to).toBeNull();
    await call(admin, `select public.admin_assign_support_ticket($1, true)`, [t1]);
  });

  it("résout puis archive ; rouvrir efface les dates", async () => {
    await call(admin, `select public.admin_set_support_status($1, 'waiting')`, [t2]);
    expect((await status(t2)).status).toBe("waiting");
    await expect(call(admin, `select public.admin_set_support_status($1, 'archived')`, [t2])).rejects.toThrow(/archive_requires_resolved/);
    await call(admin, `select public.admin_set_support_status($1, 'resolved')`, [t2]);
    const resolved = await status(t2);
    expect(resolved.status).toBe("resolved");
    expect(resolved.resolved_at).not.toBeNull();
    expect((await list(admin, { tab: "resolved" })).rows.map((r) => r.id)).toEqual([t2]);
    await call(admin, `select public.admin_set_support_status($1, 'archived')`, [t2]);
    expect(await status(t2)).toMatchObject({ status: "archived" });
    expect((await status(t2)).archived_at).not.toBeNull();
    expect((await list(admin, { tab: "archived" })).total).toBe(1);
    await call(admin, `select public.admin_set_support_status($1, 'in_progress')`, [t2]);
    expect(await status(t2)).toMatchObject({ status: "in_progress", resolved_at: null, archived_at: null });
    await expect(call(admin, `select public.admin_assign_support_ticket($1, true)`, [t2])).resolves.toBeDefined();
    await call(admin, `select public.admin_set_support_status($1, 'resolved')`, [t2]);
    await expect(call(admin, `select public.admin_assign_support_ticket($1, true)`, [t2])).rejects.toThrow(/ticket_closed/);
  });

  it("refuse un statut, une priorité ou un ticket inconnus", async () => {
    await expect(call(admin, `select public.admin_set_support_status($1, 'zzz')`, [t3])).rejects.toThrow(/status_invalid/);
    await expect(call(admin, `select public.admin_set_support_priority($1, 'urgent')`, [t3])).rejects.toThrow(/priority_invalid/);
    await expect(call(admin, `select public.admin_set_support_status('00000000-0000-0000-0000-000000000000', 'waiting')`)).rejects.toThrow(/ticket_not_found/);
  });

  it("change la priorité et trace les actions", async () => {
    await call(admin, `select public.admin_set_support_priority($1, 'low')`, [t1]);
    expect((await list(admin, { priority: "low" })).total).toBe(2);
    const actions = (await db.query<{ action: string }>(`select distinct action from public.audit_logs where action like 'support.%'`)).rows.map((r) => r.action);
    expect(actions).toEqual(expect.arrayContaining(["support.create", "support.assign", "support.unassign", "support.status", "support.priority"]));
  });
});

describe("indicateurs", () => {
  it("compte les tickets par statut et par onglet, la répartition par catégorie et le respect du délai", async () => {
    const s = await stats(admin);
    expect(s).toMatchObject({ total: 3, total_month: 3, new: 1, in_progress: 1, resolved: 1, archived: 0, waiting: 0 });
    expect(s.tabs).toMatchObject({ all: 3, mine: 1, unassigned: 1, resolved: 1, archived: 0 });
    expect(s.categories.map((c) => c.category).sort()).toEqual(["formations", "paiements", "utilisateurs"]);
    expect(s.avg_seconds).not.toBeNull();
    expect(s.sla).toBe(100); // résolu en quelques secondes : dans le délai
  });
  it("hors délai : un ticket résolu après plus de 24 h (priorité moyenne) fait baisser le taux", async () => {
    const t4 = (await create(admin, aicha, "Certificat introuvable", "certifications", "medium")).id;
    await db.query(`update public.support_tickets set created_at = now() - interval '3 days' where id = $1`, [t4]);
    await call(admin, `select public.admin_set_support_status($1, 'resolved')`, [t4]);
    expect((await stats(admin)).sla).toBe(50);
    expect((await stats(admin)).avg_seconds).toBeGreaterThan(3600);
  });
});

describe("accès", () => {
  it("est réservé aux administrateurs", async () => {
    await expect(list(ins)).rejects.toThrow(/forbidden/);
    await expect(stats(aicha)).rejects.toThrow(/forbidden/);
    await expect(create(ins, aicha, "Sujet valide")).rejects.toThrow(/forbidden/);
    await expect(call(aicha, `select public.admin_set_support_status($1, 'resolved')`, [t3])).rejects.toThrow(/forbidden/);
    await expect(call(ins, `select public.admin_support_requesters()`)).rejects.toThrow(/forbidden/);
  });
  it("laisse le demandeur lire ses propres tickets seulement", async () => {
    const own = await as(aicha, async () => (await db.query<{ requester_id: string }>(`select requester_id from public.support_tickets`)).rows);
    expect(own.length).toBeGreaterThan(0);
    expect(own.every((r) => r.requester_id === aicha)).toBe(true);
    expect(await as(ins, async () => (await db.query(`select 1 from public.support_tickets where requester_id <> $1`, [ins])).rows)).toHaveLength(0);
  });
  it("liste les demandeurs possibles", async () => {
    const r = await as(admin, async () => (await db.query<{ r: { id: string; name: string }[] }>(`select public.admin_support_requesters() as r`)).rows[0].r);
    expect(r.map((x) => x.id)).toEqual(expect.arrayContaining([aicha, moussa, ins]));
  });
});

describe("détail d'un ticket", () => {
  type Detail = {
    ticket: { id: string; reference: string; status: string; assigned_to: string | null; category: string; course_title: string | null };
    requester: { name: string; email: string; code: string | null };
    messages: { author_name: string; internal: boolean; body: string; is_requester: boolean }[];
    files: { id: string; name: string; size: number }[];
  };
  const detail = (u: string | null, id: string) => as(u, async () => (await db.query<{ r: Detail }>(`select public.admin_get_support_ticket($1) as r`, [id])).rows[0].r);
  const post = (u: string | null, id: string, body: string, internal = false) => call(u, `select public.admin_post_support_message($1, $2, $3)`, [id, body, internal]);
  let tk: string;
  let course: string;

  beforeAll(async () => {
    course = (await db.query<{ id: string }>(`insert into public.courses (instructor_id, title, slug) values ($1, 'SST – Secourisme au travail', 'sst') returning id`, [ins])).rows[0].id;
    const r = await as(admin, async () => (await db.query<{ r: { id: string } }>(`select public.admin_create_support_ticket($1, 'Impossible d’accéder à ma formation', 'Bonjour', 'formations', 'high', $2) as r`, [aicha, course])).rows[0].r);
    tk = r.id;
  });

  it("renvoie le ticket, le demandeur et la formation concernée", async () => {
    const d = await detail(admin, tk);
    expect(d.ticket).toMatchObject({ status: "new", category: "formations", course_title: "SST – Secourisme au travail" });
    expect(d.requester).toMatchObject({ name: "Kouadio Aïcha", email: "aicha@x.ci", code: "APP-00125" });
    expect(d.messages).toEqual([]);
    await expect(detail(admin, "00000000-0000-0000-0000-000000000000")).rejects.toThrow(/ticket_not_found/);
    await expect(as(admin, async () => db.query(`select public.admin_create_support_ticket($1, 'Sujet valide', null, 'compte', 'low', '00000000-0000-0000-0000-000000000000')`, [aicha]))).rejects.toThrow(/course_not_found/);
  });

  it("une réponse fait passer un ticket nouveau en cours et l'assigne à son auteur", async () => {
    await post(admin, tk, "Merci pour votre message, nous vérifions.");
    const d = await detail(admin, tk);
    expect(d.ticket).toMatchObject({ status: "in_progress", assigned_to: admin });
    expect(d.messages).toHaveLength(1);
    expect(d.messages[0]).toMatchObject({ author_name: "Claire Yao", internal: false, is_requester: false });
  });

  it("une note interne ne change ni le statut ni le responsable et reste cachée au demandeur", async () => {
    await post(admin2, tk, "Vérifier les droits d'accès côté inscription.", true);
    const d = await detail(admin, tk);
    expect(d.ticket).toMatchObject({ status: "in_progress", assigned_to: admin });
    expect(d.messages.at(-1)).toMatchObject({ internal: true, author_name: "Paul Kouassi" });
    const seen = await as(aicha, async () => (await db.query<{ internal: boolean }>(`select internal from public.support_messages where ticket_id = $1`, [tk])).rows);
    expect(seen.map((m) => m.internal)).toEqual([false]);
  });

  it("refuse un message vide, trop long ou sur un ticket archivé", async () => {
    await expect(post(admin, tk, "   ")).rejects.toThrow(/body_invalid/);
    await expect(post(admin, tk, "x".repeat(5001))).rejects.toThrow(/body_invalid/);
    const closed = (await create(admin, aicha, "Ticket à archiver")).id;
    await call(admin, `select public.admin_set_support_status($1, 'resolved')`, [closed]);
    await call(admin, `select public.admin_set_support_status($1, 'archived')`, [closed]);
    await expect(post(admin, closed, "Bonjour")).rejects.toThrow(/ticket_closed/);
  });

  it("ajoute et retire des pièces jointes dans le dossier de l'administrateur seulement", async () => {
    const add = (u: string, path: string) => call(admin, `select public.admin_add_support_file($1, $2, 'Capture.pdf', 516096, 'application/pdf')`, [tk, path.replace("{u}", u)]);
    await add(admin, "{u}/abc-Capture.pdf");
    await expect(add(admin2, "{u}/abc-Capture.pdf")).rejects.toThrow(/path_invalid/);
    await expect(add(admin, "{u}/../x.pdf")).rejects.toThrow(/path_invalid/);
    const d = await detail(admin, tk);
    expect(d.files).toHaveLength(1);
    expect(d.files[0]).toMatchObject({ name: "Capture.pdf", size: 516096 });
    const path = (await call(admin, `select public.admin_remove_support_file($1) as p`, [d.files[0].id]))[0] as { p: string };
    expect(path.p).toBe(`${admin}/abc-Capture.pdf`);
    expect((await detail(admin, tk)).files).toEqual([]);
    await expect(call(admin, `select public.admin_remove_support_file($1)`, [d.files[0].id])).rejects.toThrow(/file_not_found/);
  });

  it("réassigne à un administrateur ou au support, pas à un utilisateur ordinaire", async () => {
    await call(admin, `select public.admin_reassign_support_ticket($1, $2)`, [tk, admin2]);
    expect((await detail(admin, tk)).ticket.assigned_to).toBe(admin2);
    await expect(call(admin, `select public.admin_reassign_support_ticket($1, $2)`, [tk, aicha])).rejects.toThrow(/assignee_invalid/);
    await call(admin, `select public.admin_reassign_support_ticket($1, null)`, [tk]);
    expect((await detail(admin, tk)).ticket.assigned_to).toBeNull();
    const staff = await as(admin, async () => (await db.query<{ r: { id: string }[] }>(`select public.admin_support_staff() as r`)).rows[0].r);
    expect(staff.map((s) => s.id).sort()).toEqual([admin, admin2].sort());
  });

  it("change la catégorie et duplique le ticket sans messages ni responsable", async () => {
    await call(admin, `select public.admin_set_support_category($1, 'documents')`, [tk]);
    expect((await detail(admin, tk)).ticket.category).toBe("documents");
    await expect(call(admin, `select public.admin_set_support_category($1, 'zzz')`, [tk])).rejects.toThrow(/category_invalid/);
    const copy = (await call(admin, `select public.admin_duplicate_support_ticket($1) as r`, [tk]))[0] as { r: { id: string; reference: string } };
    const d = await detail(admin, copy.r.id);
    expect(d.ticket).toMatchObject({ status: "new", assigned_to: null, category: "documents", course_title: "SST – Secourisme au travail" });
    expect(d.messages).toEqual([]);
    expect(copy.r.reference).not.toBe((await detail(admin, tk)).ticket.reference);
  });

  it("est réservé aux administrateurs et trace chaque action", async () => {
    await expect(detail(ins, tk)).rejects.toThrow(/forbidden/);
    await expect(post(aicha, tk, "Bonjour")).rejects.toThrow(/forbidden/);
    await expect(call(ins, `select public.admin_duplicate_support_ticket($1)`, [tk])).rejects.toThrow(/forbidden/);
    await expect(call(ins, `select public.admin_support_staff()`)).rejects.toThrow(/forbidden/);
    const actions = (await db.query<{ action: string }>(`select distinct action from public.audit_logs where action like 'support.%'`)).rows.map((r) => r.action);
    expect(actions).toEqual(expect.arrayContaining(["support.reply", "support.note", "support.file.add", "support.file.remove", "support.reassign", "support.category", "support.duplicate"]));
  });
});

describe("historique d'un ticket", () => {
  type Ev = { action: string; actor_name: string | null; actor_is_requester: boolean; from_name: string | null; to_name: string | null; excerpt: string | null; metadata: Record<string, unknown>; occurred_at: string };
  const history = (u: string | null, id: string) => as(u, async () => (await db.query<{ r: Ev[] }>(`select public.admin_support_history($1) as r`, [id])).rows[0].r);
  let h: string;

  beforeAll(async () => {
    h = (await create(admin, aicha, "Certificat introuvable", "certifications", "medium")).id;
    await call(admin, `select public.admin_set_support_priority($1, 'high')`, [h]);
    await call(admin, `select public.admin_post_support_message($1, 'Nous prenons en charge votre demande.', false)`, [h]);
    await call(admin, `select public.admin_reassign_support_ticket($1, $2)`, [h, admin2]);
    await call(admin2, `select public.admin_set_support_status($1, 'waiting')`, [h]);
    await call(admin2, `select public.admin_post_support_message($1, $2, true)`, [h, `Vérifier les droits d'accès ${"x".repeat(200)}`]);
    await call(admin2, `select public.admin_set_support_category($1, 'documents')`, [h]);
    await call(admin2, `select public.admin_set_support_status($1, 'resolved')`, [h]);
  });

  it("liste les événements du plus récent au plus ancien, avec leur auteur", async () => {
    const e = await history(admin, h);
    expect(e.map((x) => x.action)).toEqual(["support.status", "support.category", "support.note", "support.status", "support.reassign", "support.reply", "support.priority", "support.create"]);
    expect(e[0].actor_name).toBe("Paul Kouassi");
    expect(e.at(-1)!.actor_name).toBe("Claire Yao");
    expect(e.every((x) => x.actor_is_requester === false)).toBe(true);
    const times = e.map((x) => x.occurred_at);
    expect([...times].sort().reverse()).toEqual(times);
  });

  it("donne les valeurs avant et après, les noms de responsables et un extrait des messages", async () => {
    const e = await history(admin, h);
    expect(e[0].metadata).toMatchObject({ from: "waiting", to: "resolved" });
    expect(e.find((x) => x.action === "support.priority")!.metadata).toMatchObject({ from: "medium", to: "high" });
    expect(e.find((x) => x.action === "support.reassign")).toMatchObject({ to_name: "Paul Kouassi", from_name: "Claire Yao" });
    const note = e.find((x) => x.action === "support.note")!;
    expect(note.excerpt).toHaveLength(140);
    expect(note.excerpt!.startsWith("Vérifier les droits d'accès")).toBe(true);
    expect(e.find((x) => x.action === "support.reply")!.excerpt).toBe("Nous prenons en charge votre demande.");
  });

  it("n'affiche que les événements du ticket demandé et refuse un ticket inconnu ou un non-administrateur", async () => {
    const other = (await create(admin, moussa, "Autre ticket")).id;
    expect((await history(admin, other)).map((x) => x.action)).toEqual(["support.create"]);
    await expect(history(admin, "00000000-0000-0000-0000-000000000000")).rejects.toThrow(/ticket_not_found/);
    await expect(history(ins, h)).rejects.toThrow(/forbidden/);
    await expect(history(aicha, h)).rejects.toThrow(/forbidden/);
  });
});
