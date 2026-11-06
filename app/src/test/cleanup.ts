import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Supprime des comptes de test et tout ce qui les référence, dans l'ordre imposé par les clés étrangères :
 * inscriptions, journal d'audit, formations (avec sessions et programme en cascade), puis comptes.
 * Lève une erreur si quelque chose subsiste : un nettoyage incomplet pollue le projet Supabase.
 */
export async function cleanupTestUsers(db: SupabaseClient, userIds: string[]): Promise<void> {
  if (userIds.length === 0) return;
  const failures: string[] = [];
  const check = (label: string, error: { message: string } | null) => {
    if (error) failures.push(`${label}: ${error.message}`);
  };

  const { data: courses } = await db.from("courses").select("id").in("instructor_id", userIds);
  const courseIds = (courses ?? []).map((c) => c.id);
  if (courseIds.length) check("inscriptions (formations)", (await db.from("enrollments").delete().in("course_id", courseIds)).error);
  check("inscriptions (apprenants)", (await db.from("enrollments").delete().in("learner_id", userIds)).error);
  check("audit", (await db.from("audit_logs").delete().in("actor_id", userIds)).error);
  if (courseIds.length) {
    check("audit (formations)", (await db.from("audit_logs").delete().in("entity_id", courseIds)).error);
    check("formations", (await db.from("courses").delete().in("id", courseIds)).error);
  }
  for (const id of userIds) check(`compte ${id}`, (await db.auth.admin.deleteUser(id)).error);

  if (failures.length) throw new Error(`Nettoyage incomplet :\n${failures.join("\n")}`);
}
