import "server-only";
import { cacheLife } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import type { PublicStats } from "./stats-types";

export type { PublicStats } from "./stats-types";

/**
 * Indicateurs publics calculés sur les données réelles (jamais de chiffres écrits en dur).
 * Mis en cache une heure : la page d'accueil ne sollicite pas la base à chaque visite.
 * La clé privilégiée reste côté serveur et seuls des totaux agrégés sont exposés.
 */
export async function getPublicStats(): Promise<PublicStats> {
  "use cache";
  cacheLife("hours");
  const none = { courses: 0, learners: 0, companies: 0 };
  try {
    const db = createAdminClient();
    const [courses, enrollments, companies] = await Promise.all([
      db.from("courses").select("id", { count: "exact", head: true }).eq("status", "published"),
      db.from("enrollments").select("learner_id").in("status", ["confirmed", "completed"]).limit(50000),
      db.from("organizations").select("id", { count: "exact", head: true }).eq("status", "active"),
    ]);
    if (courses.error || enrollments.error || companies.error) return none;
    return {
      courses: courses.count ?? 0,
      learners: new Set((enrollments.data ?? []).map((e) => e.learner_id)).size,
      companies: companies.count ?? 0,
    };
  } catch {
    return none;
  }
}
