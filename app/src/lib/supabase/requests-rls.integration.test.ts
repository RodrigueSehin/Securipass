// RLS de public_requests (migration 2). Ignoré tant que la table n'existe pas sur le projet configuré.
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const configured = Boolean(url && anonKey && serviceKey);
const opts = { auth: { persistSession: false, autoRefreshToken: false } };

const admin = configured ? createClient(url, serviceKey, opts) : null;
const tableExists = admin ? !(await admin.from("public_requests").select("id").limit(1)).error : false;

const run = Date.now();
const PASSWORD = "Test-Passw0rd-" + run;

describe.skipIf(!tableExists)("RLS public_requests", () => {
  const db = admin!;
  const anon = createClient(url, anonKey, opts);
  const userIds: string[] = [];
  let learner: SupabaseClient, support: SupabaseClient;
  let requestId: string;

  async function makeClient(tag: string, role?: string) {
    const email = `req-${tag}-${run}@example.test`;
    const { data, error } = await db.auth.admin.createUser({ email, password: PASSWORD, email_confirm: true });
    if (error) throw error;
    userIds.push(data.user.id);
    if (role) {
      const { data: r } = await db.from("roles").select("id").eq("code", role).single();
      await db.from("user_roles").insert({ user_id: data.user.id, role_id: r!.id });
    }
    const client = createClient(url, anonKey, opts);
    const { error: e2 } = await client.auth.signInWithPassword({ email, password: PASSWORD });
    if (e2) throw e2;
    return client;
  }

  beforeAll(async () => {
    learner = await makeClient("learner");
    support = await makeClient("support", "support");
    const { data, error } = await db
      .from("public_requests")
      .insert({ kind: "contact", full_name: "Test RLS", email: `rls-${run}@example.test`, message: "Message de test RLS." })
      .select("id")
      .single();
    if (error) throw error;
    requestId = data.id;
  });

  afterAll(async () => {
    await db.from("public_requests").delete().like("email", `%-${run}@example.test`);
    for (const id of userIds) await db.auth.admin.deleteUser(id);
  });

  it("un visiteur ne peut pas insérer directement une demande", async () => {
    const { error } = await anon.from("public_requests").insert({ kind: "contact", full_name: "Bot", email: `bot-${run}@example.test`, message: "Insertion directe." });
    expect(error).not.toBeNull();
  });

  it("un visiteur et un apprenant ne peuvent pas lire les demandes", async () => {
    expect((await anon.from("public_requests").select("id").eq("id", requestId)).data ?? []).toEqual([]);
    expect((await learner.from("public_requests").select("id").eq("id", requestId)).data ?? []).toEqual([]);
  });

  it("le support peut lire et traiter les demandes", async () => {
    const read = await support.from("public_requests").select("id").eq("id", requestId);
    expect(read.data).toHaveLength(1);
    const upd = await support.from("public_requests").update({ status: "in_progress" }).eq("id", requestId).select("status");
    expect(upd.data?.[0]?.status).toBe("in_progress");
  });

  it("un apprenant ne peut pas modifier une demande", async () => {
    await learner.from("public_requests").update({ status: "done" }).eq("id", requestId);
    const { data } = await db.from("public_requests").select("status").eq("id", requestId).single();
    expect(data?.status).not.toBe("done");
  });

  it("refuse un type de demande ou un statut invalide (contraintes)", async () => {
    const bad = await db.from("public_requests").insert({ kind: "autre", full_name: "X Y", email: `bad-${run}@example.test`, message: "Message suffisamment long." });
    expect(bad.error).not.toBeNull();
  });
});
