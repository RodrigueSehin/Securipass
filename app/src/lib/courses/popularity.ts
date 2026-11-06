import "server-only";
import { cacheLife } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Popularité réelle : nombre d'inscriptions confirmées ou terminées par formation (jamais de note inventée).
 * Mis en cache une heure. Retourne un objet simple (sérialisable) : identifiant de formation → nombre d'inscrits.
 */
export async function getCoursePopularity(): Promise<Record<string, number>> {
  "use cache";
  cacheLife("hours");
  try {
    const db = createAdminClient();
    const { data, error } = await db.from("enrollments").select("course_id").in("status", ["confirmed", "completed"]).limit(100000);
    if (error) return {};
    const counts: Record<string, number> = {};
    for (const row of data ?? []) counts[row.course_id] = (counts[row.course_id] ?? 0) + 1;
    return counts;
  } catch {
    return {};
  }
}
