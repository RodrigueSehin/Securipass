import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { Announcement } from "./announcements";

export const ANNOUNCEMENTS_TAG = "announcements";

/** Tous les messages, actifs ou non (administration) ; null si la lecture échoue. */
export async function loadAnnouncements(): Promise<Announcement[] | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("site_announcements").select("id, message, link_url, active, position").order("position").order("created_at");
  return error ? null : (data as Announcement[]);
}

/** Messages actifs de la page d'accueil, mis en cache quelques minutes (invalidés à chaque modification). */
export async function getPublicAnnouncements(): Promise<Pick<Announcement, "id" | "message" | "link_url">[]> {
  "use cache";
  cacheLife("minutes");
  cacheTag(ANNOUNCEMENTS_TAG);
  try {
    const { data, error } = await createAdminClient().from("site_announcements").select("id, message, link_url").eq("active", true).order("position").order("created_at").limit(20);
    return error ? [] : (data ?? []);
  } catch {
    return [];
  }
}
