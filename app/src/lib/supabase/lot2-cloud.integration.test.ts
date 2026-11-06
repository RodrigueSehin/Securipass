// Vérifie sur le projet Supabase configuré que la migration 3 est appliquée et que ses garde-fous tiennent.
// Ignoré tant que la migration 3 n'a pas été exécutée.
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { cleanupTestUsers } from "@/test/cleanup";
import { ADMIN_COURSE_DETAIL_SELECT, ADMIN_COURSE_LIST_SELECT, COURSE_CARD_SELECT, MY_ENROLLMENTS_SELECT, OWN_COURSE_LIST_SELECT, PARTICIPANT_SELECT } from "@/lib/selects";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const configured = Boolean(url && anonKey && serviceKey);
const opts = { auth: { persistSession: false, autoRefreshToken: false } };

const admin = configured ? createClient(url, serviceKey, opts) : null;
const applied = admin ? !(await admin.from("sessions").select("id").limit(1)).error : false;

const run = Date.now();
const PASSWORD = "Test-Passw0rd-" + run;

describe.skipIf(!applied)("Lot 2 sur le cloud", () => {
  const db = admin!;
  const anon = createClient(url, anonKey, opts);
  const userIds: string[] = [];
  let instructor: SupabaseClient, learner: SupabaseClient, other: SupabaseClient, adminUser: SupabaseClient;
  let instructorId: string, learnerId: string;
  let courseId: string, sessionId: string;

  async function makeUser(tag: string, role?: string) {
    const email = `lot2-${tag}-${run}@example.test`;
    const { data, error } = await db.auth.admin.createUser({ email, password: PASSWORD, email_confirm: true, user_metadata: { full_name: `Test ${tag}` } });
    if (error) throw error;
    userIds.push(data.user.id);
    if (role) {
      const { data: r } = await db.from("roles").select("id").eq("code", role).single();
      await db.from("user_roles").insert({ user_id: data.user.id, role_id: r!.id });
    }
    const client = createClient(url, anonKey, opts);
    const { error: e2 } = await client.auth.signInWithPassword({ email, password: PASSWORD });
    if (e2) throw e2;
    return { id: data.user.id, client };
  }

  beforeAll(async () => {
    const i = await makeUser("ins", "instructor");
    const l = await makeUser("learner");
    const o = await makeUser("other");
    const a = await makeUser("adm", "admin");
    instructor = i.client; instructorId = i.id; learner = l.client; learnerId = l.id; other = o.client; adminUser = a.client;

    const { data: course, error } = await db.from("courses").insert({
      instructor_id: instructorId, title: "Cloud Lot2", slug: `lot2-${run}`, status: "published", published_at: new Date().toISOString(), price_amount: 0,
    }).select("id").single();
    if (error) throw error;
    courseId = course.id;
    const start = new Date(Date.now() + 10 * 86400_000);
    const { data: s, error: e2 } = await db.from("sessions").insert({
      course_id: courseId, instructor_id: instructorId, title: "Session cloud", start_at: start.toISOString(),
      end_at: new Date(start.getTime() + 4 * 3600_000).toISOString(), delivery_mode: "online", capacity: 1, waitlist_enabled: true,
    }).select("id").single();
    if (e2) throw e2;
    sessionId = s.id;
    await db.from("session_meeting_links").insert({ session_id: sessionId, url: "https://meet.example.test/secret" });
  });

  afterAll(async () => {
    await cleanupTestUsers(db, userIds);
  });

  it("les catégories de référence sont présentes", async () => {
    const { data } = await anon.from("categories").select("slug");
    expect((data ?? []).map((c) => c.slug)).toEqual(expect.arrayContaining(["securite-privee", "secourisme", "securite-incendie"]));
  });

  it("le détail public n'expose ni lien de visioconférence ni contenu", async () => {
    const { data, error } = await anon.rpc("public_course_detail", { p_slug: `lot2-${run}` });
    expect(error).toBeNull();
    expect(JSON.stringify(data)).not.toContain("secret");
    expect((data as { sessions: unknown[] }).sessions).toHaveLength(1);
  });

  it("le lien de visioconférence n'est lisible que par les inscrits et le formateur", async () => {
    expect((await anon.from("session_meeting_links").select("url")).data ?? []).toEqual([]);
    expect((await other.from("session_meeting_links").select("url")).data ?? []).toEqual([]);
    expect((await instructor.from("session_meeting_links").select("url")).data).toHaveLength(1);
  });

  it("inscription : confirmée, doublon refusé, session pleine -> liste d'attente", async () => {
    const first = await learner.rpc("enroll_self", { p_course: courseId, p_session: sessionId });
    expect(first.error).toBeNull();
    expect((first.data as { status: string }).status).toBe("confirmed");
    const dup = await learner.rpc("enroll_self", { p_course: courseId, p_session: sessionId });
    expect(dup.error?.message).toContain("already_enrolled");
    const full = await other.rpc("enroll_self", { p_course: courseId, p_session: sessionId });
    expect((full.data as { status: string }).status).toBe("waitlisted");
    // lien désormais visible de l'inscrit confirmé, pas de celui en attente
    expect((await learner.from("session_meeting_links").select("url")).data).toHaveLength(1);
    expect((await other.from("session_meeting_links").select("url")).data ?? []).toEqual([]);
  });

  it("l'annulation promeut le premier de la liste d'attente", async () => {
    const { data: e } = await db.from("enrollments").select("id").eq("learner_id", learnerId).eq("course_id", courseId).single();
    const { error } = await learner.rpc("cancel_enrollment", { p_enrollment: e!.id });
    expect(error).toBeNull();
    const { data } = await db.from("enrollments").select("status, learner_id").eq("course_id", courseId);
    expect(data?.find((x) => x.learner_id !== learnerId)?.status).toBe("confirmed");
  });

  it("un visiteur ne peut ni s'inscrire ni modifier une inscription", async () => {
    expect((await anon.rpc("enroll_self", { p_course: courseId, p_session: sessionId })).error).not.toBeNull();
    expect((await anon.from("enrollments").insert({ learner_id: learnerId, course_id: courseId })).error).not.toBeNull();
  });

  it("le formateur ne peut pas publier lui-même une formation", async () => {
    const { data: d } = await instructor.from("courses").insert({ instructor_id: instructorId, title: "Brouillon cloud", slug: `lot2-draft-${run}` }).select("id").single();
    const { error } = await instructor.from("courses").update({ status: "published" }).eq("id", d!.id);
    expect(error).not.toBeNull();
    const { data: after } = await db.from("courses").select("status").eq("id", d!.id).single();
    expect(after?.status).toBe("draft");
  });

  it("les buckets de stockage ont leurs limites de taille et de type", async () => {
    const { data } = await db.storage.listBuckets();
    const covers = data?.find((b) => b.id === "course-covers");
    const files = data?.find((b) => b.id === "course-files");
    expect(covers?.public).toBe(true);
    expect(files?.public).toBe(false);
    expect(files?.file_size_limit).toBe(104857600); // 100 Mo depuis la migration 18
    expect(files?.allowed_mime_types).toContain("application/pdf");
  });

  it("un formateur ne peut écrire que dans son propre dossier de stockage", async () => {
    const png = new Blob([new Uint8Array([137, 80, 78, 71])], { type: "image/png" });
    const mine = await instructor.storage.from("course-files").upload(`${instructorId}/lot2-${run}.png`, png, { contentType: "image/png" });
    expect(mine.error).toBeNull();
    const theirs = await instructor.storage.from("course-files").upload(`${learnerId}/lot2-${run}.png`, png, { contentType: "image/png" });
    expect(theirs.error).not.toBeNull();
    const badType = await instructor.storage.from("course-files").upload(`${instructorId}/lot2-${run}.exe`, new Blob(["x"], { type: "application/x-msdownload" }), { contentType: "application/x-msdownload" });
    expect(badType.error).not.toBeNull();
    await db.storage.from("course-files").remove([`${instructorId}/lot2-${run}.png`]);
  });
  // Une jointure ambiguë échoue côté PostgREST : on exécute ici les requêtes exactes de l'application.
  it("les requêtes avec jointures de l'application s'exécutent sans erreur, avec les bons rôles", async () => {
    await learner.rpc("enroll_self", { p_course: courseId, p_session: sessionId });
    const participants = await instructor.from("enrollments").select(PARTICIPANT_SELECT).eq("session_id", sessionId);
    expect(participants.error).toBeNull();
    expect(participants.data?.length).toBeGreaterThan(0);
    expect((participants.data?.[0] as unknown as { learner: { email: string } }).learner.email).toContain("@example.test");

    const mine = await learner.from("enrollments").select(MY_ENROLLMENTS_SELECT).eq("learner_id", learnerId);
    expect(mine.error).toBeNull();
    expect(mine.data?.length).toBeGreaterThan(0);

    const own = await instructor.from("courses").select(OWN_COURSE_LIST_SELECT).eq("instructor_id", instructorId);
    expect(own.error).toBeNull();

    const card = await anon.from("courses").select(COURSE_CARD_SELECT).eq("status", "published").eq("id", courseId);
    expect(card.error).toBeNull();
    expect(card.data).toHaveLength(1);

    const list = await adminUser.from("courses").select(ADMIN_COURSE_LIST_SELECT).eq("id", courseId);
    expect(list.error).toBeNull();
    expect((list.data?.[0] as unknown as { instructor: { full_name: string } }).instructor.full_name).toContain("Test");

    const detail = await adminUser.from("courses").select(ADMIN_COURSE_DETAIL_SELECT).eq("id", courseId).maybeSingle();
    expect(detail.error).toBeNull();
    expect(detail.data).not.toBeNull();
  });
});
