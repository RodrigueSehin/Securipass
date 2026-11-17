"use server";

import { redirect } from "next/navigation";
import { revalidatePath, updateTag } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { parseAnnouncementForm } from "./announcements";
import { ANNOUNCEMENTS_TAG } from "./announcements-queries";

const BACK = "/admin/parametres/bande-info";
const FAIL = "L’opération a échoué. Réessayez.";
function done(key: "resultat" | "erreur", value: string): never {
  revalidatePath("/", "layout");
  redirect(`${BACK}?${key}=${encodeURIComponent(value)}`);
}

/** Crée (sans identifiant) ou modifie un message de la bande d'information. */
export async function saveAnnouncement(formData: FormData): Promise<void> {
  const parsed = parseAnnouncementForm(formData);
  if (!parsed.success) done("erreur", parsed.error.issues[0]?.message ?? "Données invalides.");
  const d = parsed.data;
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_save_announcement", { p_id: d.id, p_message: d.message, p_link: d.link || null, p_active: d.active });
  if (error) done("erreur", FAIL);
  updateTag(ANNOUNCEMENTS_TAG);
  done("resultat", d.id ? "modifie" : "ajoute");
}

export async function deleteAnnouncement(formData: FormData): Promise<void> {
  const id = z.string().uuid().safeParse(formData.get("id"));
  if (!id.success) done("erreur", "Demande invalide.");
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_delete_announcement", { p_id: id.data });
  if (error) done("erreur", FAIL);
  updateTag(ANNOUNCEMENTS_TAG);
  done("resultat", "supprime");
}

export async function moveAnnouncement(formData: FormData): Promise<void> {
  const id = z.string().uuid().safeParse(formData.get("id"));
  const dir = z.enum(["up", "down"]).safeParse(formData.get("dir"));
  if (!id.success || !dir.success) done("erreur", "Demande invalide.");
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_move_announcement", { p_id: id.data, p_dir: dir.data === "up" ? -1 : 1 });
  if (error) done("erreur", FAIL);
  updateTag(ANNOUNCEMENTS_TAG);
  done("resultat", "deplace");
}
