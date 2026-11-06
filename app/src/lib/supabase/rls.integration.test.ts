// Test d'intégration de la RLS contre le projet Supabase configuré dans .env.
// Crée des comptes jetables (domaine example.test) et les supprime à la fin.
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { cleanupTestUsers } from "@/test/cleanup";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const enabled = Boolean(url && anonKey && serviceKey);

const run = Date.now();
const PASSWORD = "Test-Passw0rd-" + run;
const opts = { auth: { persistSession: false, autoRefreshToken: false } };

type TestUser = { id: string; email: string; client: SupabaseClient };

describe.skipIf(!enabled)("RLS Supabase", () => {
  const admin = createClient(url, serviceKey, opts);
  const anon = createClient(url, anonKey, opts);
  const createdUsers: string[] = [];
  let learner: TestUser, other: TestUser, instructor: TestUser;
  let publishedId: string, draftId: string;

  async function makeUser(tag: string): Promise<TestUser> {
    const email = `rls-${tag}-${run}@example.test`;
    const { data, error } = await admin.auth.admin.createUser({
      email,
      password: PASSWORD,
      email_confirm: true,
      user_metadata: { full_name: `Test ${tag}`, role: "admin" }, // tentative d'élévation : doit être ignorée
    });
    if (error) throw error;
    createdUsers.push(data.user.id);
    const client = createClient(url, anonKey, opts);
    const { error: e2 } = await client.auth.signInWithPassword({ email, password: PASSWORD });
    if (e2) throw e2;
    return { id: data.user.id, email, client };
  }

  async function grant(userId: string, code: string) {
    const { data: role } = await admin.from("roles").select("id").eq("code", code).single();
    const { error } = await admin.from("user_roles").insert({ user_id: userId, role_id: role!.id });
    if (error) throw error;
  }

  beforeAll(async () => {
    learner = await makeUser("learner");
    other = await makeUser("other");
    instructor = await makeUser("instructor");
    await grant(instructor.id, "instructor");
    // Le client de l'instructeur doit être reconnecté pour refléter son état (RLS lit la base, pas le JWT)

    const base = { instructor_id: instructor.id, level: "beginner", delivery_mode: "online", price_amount: 1000 };
    const pub = await admin.from("courses").insert({ ...base, title: "RLS publiée", slug: `rls-pub-${run}`, status: "published", published_at: new Date().toISOString() }).select("id").single();
    const dr = await admin.from("courses").insert({ ...base, title: "RLS brouillon", slug: `rls-draft-${run}`, status: "draft" }).select("id").single();
    if (pub.error || dr.error) throw pub.error ?? dr.error;
    publishedId = pub.data!.id;
    draftId = dr.data!.id;
  });

  afterAll(async () => {
    await cleanupTestUsers(admin, createdUsers);
  });

  it("crée automatiquement un profil et uniquement le rôle apprenant (métadonnée role=admin ignorée)", async () => {
    const { data: profile } = await learner.client.from("profiles").select("email, full_name").eq("id", learner.id).single();
    expect(profile?.email).toBe(learner.email);
    const { data: roles } = await learner.client.from("user_roles").select("roles(code)").eq("user_id", learner.id);
    const codes = (roles ?? []).map((r) => (r.roles as unknown as { code: string }).code);
    expect(codes).toEqual(["learner"]);
  });

  it("l'apprenant ne peut pas lire le profil d'un autre utilisateur", async () => {
    const { data } = await learner.client.from("profiles").select("id").eq("id", other.id);
    expect(data).toEqual([]);
  });

  it("l'apprenant ne peut pas s'attribuer le rôle admin", async () => {
    const { data: role } = await admin.from("roles").select("id").eq("code", "admin").single();
    const { error } = await learner.client.from("user_roles").insert({ user_id: learner.id, role_id: role!.id });
    expect(error).not.toBeNull();
    const { data } = await admin.from("user_roles").select("role_id").eq("user_id", learner.id);
    expect(data).toHaveLength(1);
  });

  it("l'apprenant ne peut pas modifier son statut de compte", async () => {
    await learner.client.from("profiles").update({ status: "suspended" }).eq("id", learner.id);
    const { data } = await admin.from("profiles").select("status").eq("id", learner.id).single();
    expect(data?.status).toBe("active");
  });

  it("l'apprenant peut modifier son propre nom", async () => {
    const { error } = await learner.client.from("profiles").update({ full_name: "Nouveau Nom" }).eq("id", learner.id);
    expect(error).toBeNull();
    const { data } = await admin.from("profiles").select("full_name").eq("id", learner.id).single();
    expect(data?.full_name).toBe("Nouveau Nom");
  });

  it("le public ne voit que les formations publiées", async () => {
    const { data } = await anon.from("courses").select("id, status").in("id", [publishedId, draftId]);
    expect(data).toEqual([{ id: publishedId, status: "published" }]);
  });

  it("un utilisateur non formateur ne peut pas créer de formation", async () => {
    const { error } = await learner.client.from("courses").insert({ instructor_id: learner.id, title: "x", slug: `rls-x-${run}` });
    expect(error).not.toBeNull();
  });

  it("le formateur voit son brouillon, pas les autres utilisateurs", async () => {
    const mine = await instructor.client.from("courses").select("id").eq("id", draftId);
    expect(mine.data).toHaveLength(1);
    const theirs = await other.client.from("courses").select("id").eq("id", draftId);
    expect(theirs.data).toEqual([]);
  });

  it("le formateur crée un brouillon mais ne peut pas créer une formation déjà publiée", async () => {
    const ok = await instructor.client.from("courses").insert({ instructor_id: instructor.id, title: "ok", slug: `rls-ok-${run}`, status: "draft" });
    expect(ok.error).toBeNull();
    const ko = await instructor.client.from("courses").insert({ instructor_id: instructor.id, title: "ko", slug: `rls-ko-${run}`, status: "published" });
    expect(ko.error).not.toBeNull();
  });

  it("le formateur ne peut pas publier lui-même sa formation", async () => {
    await instructor.client.from("courses").update({ status: "published" }).eq("id", draftId);
    const { data } = await admin.from("courses").select("status").eq("id", draftId).single();
    expect(data?.status).toBe("draft");
  });

  it("le formateur peut soumettre sa formation en révision", async () => {
    const { error } = await instructor.client.from("courses").update({ status: "in_review" }).eq("id", draftId);
    expect(error).toBeNull();
    const { data } = await admin.from("courses").select("status").eq("id", draftId).single();
    expect(data?.status).toBe("in_review");
  });

  it("le journal d'audit est illisible pour un non-admin", async () => {
    await admin.from("audit_logs").insert({ action: "rls.test", entity_type: "test", entity_id: String(run) });
    const { data } = await learner.client.from("audit_logs").select("id").eq("entity_type", "test");
    expect(data).toEqual([]);
    await admin.from("audit_logs").delete().eq("entity_id", String(run));
  });

  it("isole les organisations entre elles", async () => {
    const { data: org } = await admin.from("organizations").insert({ name: `RLS Org ${run}` }).select("id").single();
    await admin.from("organization_members").insert({ organization_id: org!.id, user_id: learner.id, role: "owner" });
    try {
      const mine = await learner.client.from("organizations").select("id").eq("id", org!.id);
      expect(mine.data).toHaveLength(1);
      const foreign = await other.client.from("organizations").select("id").eq("id", org!.id);
      expect(foreign.data).toEqual([]);
      const members = await other.client.from("organization_members").select("id").eq("organization_id", org!.id);
      expect(members.data).toEqual([]);
    } finally {
      await admin.from("organizations").delete().eq("id", org!.id);
    }
  });
});
