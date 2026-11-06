// Crée (ou supprime avec --remove) les formations de DÉMONSTRATION. Toutes sont marquées is_demo = true.
// Usage :
//   npm run seed:demo -- --yes        crée / recrée les formations de démonstration
//   npm run seed:demo:remove -- --yes supprime toutes les formations de démonstration et le formateur fictif
// À ne PAS lancer sur une instance de production réelle. Prérequis : migrations 1 à 5 appliquées (7 pour les formateurs fictifs), .env renseigné.
import { randomBytes } from "node:crypto";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { DEMO_COURSES, DEMO_INSTRUCTOR, DEMO_TRAINERS } from "./demo-data.mjs";

const args = new Set(process.argv.slice(2));
const remove = args.has("--remove");
if (!args.has("--yes")) {
  console.error("Ce script écrit dans la base du projet Supabase de .env. Relancez avec --yes pour confirmer (jamais en production réelle).");
  process.exit(1);
}

process.loadEnvFile(resolve(import.meta.dirname, "..", ".env"));
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) { console.error("NEXT_PUBLIC_SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY sont requis dans .env"); process.exit(1); }
const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

const fail = (msg, err) => { console.error(`✗ ${msg}${err ? ` : ${err.message ?? err}` : ""}`); process.exit(1); };

// La colonne is_demo (migration 5) doit exister.
const probe = await db.from("courses").select("is_demo").limit(1);
if (probe.error) fail("La colonne courses.is_demo est absente : appliquez d'abord la migration 20260101000005_demo_flag.sql", probe.error);

async function findInstructor() {
  for (let page = 1; page <= 20; page++) {
    const { data, error } = await db.auth.admin.listUsers({ page, perPage: 200 });
    if (error) fail("Lecture des comptes", error);
    const hit = data.users.find((u) => u.email === DEMO_INSTRUCTOR.email);
    if (hit) return hit;
    if (data.users.length < 200) return null;
  }
  return null;
}

const trainerEmail = (slug) => `formateur.demo.${slug}@securipass.demo`;
// Table de l'annuaire (migration 7) : facultative, les formations de démonstration restent créées sans elle.
const hasTrainerTable = !(await db.from("trainer_profiles").select("user_id").limit(1)).error;
if (!hasTrainerTable) console.warn("! Table trainer_profiles absente : appliquez la migration 20260101000007_trainer_profiles.sql pour créer aussi les formateurs fictifs.");

async function removeDemoTrainers() {
  if (!hasTrainerTable) return 0;
  const { data, error } = await db.from("trainer_profiles").select("user_id").eq("is_demo", true);
  if (error) fail("Lecture des formateurs fictifs", error);
  for (const { user_id } of data ?? []) {
    await db.from("audit_logs").delete().eq("actor_id", user_id);
    const d = await db.auth.admin.deleteUser(user_id); // la suppression du compte supprime profil et fiche formateur en cascade
    if (d.error) console.warn(`! Formateur fictif non supprimé : ${d.error.message}`);
  }
  return (data ?? []).length;
}

async function createDemoTrainers() {
  if (!hasTrainerTable) return;
  const { data: role } = await db.from("roles").select("id").eq("code", "instructor").single();
  for (const t of DEMO_TRAINERS) {
    const { data, error } = await db.auth.admin.createUser({
      email: trainerEmail(t.slug), password: randomBytes(24).toString("base64url"), email_confirm: true, user_metadata: { full_name: t.name },
    });
    if (error) fail(`Compte du formateur fictif « ${t.name} »`, error);
    await db.from("user_roles").upsert({ user_id: data.user.id, role_id: role.id });
    const ins = await db.from("trainer_profiles").insert({
      user_id: data.user.id, slug: t.slug, display_name: t.name, headline: t.headline, bio: t.bio, domain: t.domain, tags: t.tags,
      is_published: true, is_demo: true,
    });
    if (ins.error) fail(`Fiche du formateur « ${t.name} »`, ins.error);
  }
  console.log(`✓ ${DEMO_TRAINERS.length} formateurs fictifs créés (annuaire public)`);
}

async function removeDemo() {
  const { data: courses, error } = await db.from("courses").select("id").eq("is_demo", true);
  if (error) fail("Lecture des formations de démonstration", error);
  const ids = (courses ?? []).map((c) => c.id);
  if (ids.length) {
    // Inscriptions et journal d'audit référencent les formations : à supprimer d'abord (modules, contenus et sessions suivent en cascade).
    const e1 = await db.from("enrollments").delete().in("course_id", ids);
    if (e1.error) fail("Suppression des inscriptions", e1.error);
    const e2 = await db.from("audit_logs").delete().eq("entity_type", "course").in("entity_id", ids);
    if (e2.error) fail("Suppression de l'audit", e2.error);
    const e3 = await db.from("courses").delete().in("id", ids);
    if (e3.error) fail("Suppression des formations", e3.error);
  }
  const instructor = await findInstructor();
  if (instructor) {
    await db.from("audit_logs").delete().eq("actor_id", instructor.id);
    const d = await db.auth.admin.deleteUser(instructor.id);
    if (d.error) console.warn(`! Formateur fictif non supprimé : ${d.error.message}`);
  }
  const trainers = await removeDemoTrainers();
  console.log(`✓ ${ids.length} formation(s) et ${trainers} formateur(s) fictif(s) de démonstration supprimé(s)`);
}

async function createDemo() {
  await removeDemo();

  let instructor = await findInstructor();
  if (!instructor) {
    const { data, error } = await db.auth.admin.createUser({
      email: DEMO_INSTRUCTOR.email,
      password: randomBytes(24).toString("base64url"), // jamais affiché : ce compte fictif n'a pas vocation à se connecter
      email_confirm: true,
      user_metadata: { full_name: DEMO_INSTRUCTOR.fullName },
    });
    if (error) fail("Création du formateur fictif", error);
    instructor = data.user;
  }
  const { data: role } = await db.from("roles").select("id").eq("code", "instructor").single();
  await db.from("user_roles").upsert({ user_id: instructor.id, role_id: role.id });

  const { data: cats, error: catErr } = await db.from("categories").select("id, slug");
  if (catErr) fail("Lecture des catégories", catErr);
  const catId = (slug) => cats.find((c) => c.slug === slug)?.id;

  let modules = 0, lessons = 0, sessions = 0;
  for (const [i, c] of DEMO_COURSES.entries()) {
    const { data: course, error } = await db.from("courses").insert({
      instructor_id: instructor.id, category_id: catId(c.category) ?? null, is_demo: true,
      title: c.title, slug: c.slug, description: c.description, objectives: c.objectives, competencies: c.competencies,
      target_audience: c.targetAudience, prerequisites: c.prerequisites, level: c.level, delivery_mode: c.mode,
      duration_minutes: c.hours * 60, price_amount: c.price, evaluation_modalities: c.evaluationModalities,
      certificate_conditions: c.certificateConditions, certificate_validity_months: c.certificateValidityMonths,
      cancellation_policy: c.cancellationPolicy, accessibility: c.accessibility,
      status: "published", published_at: new Date(Date.now() - i * 36 * 3600_000).toISOString(),
    }).select("id").single();
    if (error) fail(`Formation « ${c.title} »`, error);

    for (const [mi, m] of c.modules.entries()) {
      const mod = await db.from("course_modules").insert({ course_id: course.id, title: m.title, position: mi + 1 }).select("id").single();
      if (mod.error) fail(`Module « ${m.title} »`, mod.error);
      modules++;
      const rows = m.lessons.map((l, li) => ({
        module_id: mod.data.id, title: l.title, content_type: "text", body: "Contenu de démonstration : ce texte illustre une leçon du programme.",
        duration_minutes: l.minutes, position: li + 1, status: "published",
      }));
      const ins = await db.from("learning_contents").insert(rows);
      if (ins.error) fail(`Leçons du module « ${m.title} »`, ins.error);
      lessons += rows.length;
    }

    for (const s of c.sessions) {
      const start = new Date(Date.now() + s.inDays * 86400_000);
      start.setUTCHours(8, 0, 0, 0);
      const ses = await db.from("sessions").insert({
        course_id: course.id, instructor_id: instructor.id,
        title: `Session du ${new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long", timeZone: "UTC" }).format(start)}`,
        start_at: start.toISOString(), end_at: new Date(start.getTime() + 8 * 3600_000).toISOString(),
        delivery_mode: "onsite", location: "Centre de formation, Abidjan (démonstration)", capacity: s.capacity,
        registration_deadline: new Date(start.getTime() - 2 * 86400_000).toISOString(), waitlist_enabled: true,
      });
      if (ses.error) fail(`Session de « ${c.title} »`, ses.error);
      sessions++;
    }
  }
  console.log(`✓ ${DEMO_COURSES.length} formations de démonstration créées (${modules} modules, ${lessons} leçons, ${sessions} sessions)`);
  await createDemoTrainers();
  console.log("  Pour les supprimer : npm run seed:demo:remove -- --yes");
}

if (remove) await removeDemo(); else await createDemo();
