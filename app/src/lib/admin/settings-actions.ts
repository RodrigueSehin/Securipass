"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { DEFAULT_SETTINGS, parseSettingsForm } from "./settings";

/** Retour vers la page d'où part l'action (adresse interne aux paramètres uniquement). */
function backTo(formData: FormData): string {
  const raw = formData.get("back")?.toString() ?? "";
  return /^\/admin\/parametres(\/[a-z-]+)?$/.test(raw) ? raw : "/admin/parametres";
}
function done(back: string, key: "resultat" | "erreur", value: string): never {
  revalidatePath("/admin/parametres", "layout");
  redirect(`${back}?${key}=${encodeURIComponent(value)}`);
}

async function save(back: string, values: Record<string, string>): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_update_platform_settings", { p_values: values });
  if (error) done(back, "erreur", "L’enregistrement a échoué. Réessayez.");
  done(back, "resultat", "enregistre");
}

/** Enregistre les champs présents dans le formulaire (un champ du crayon, les couleurs ou la page « Général »). */
export async function updatePlatformSettings(formData: FormData): Promise<void> {
  const back = backTo(formData);
  const parsed = parseSettingsForm(Object.fromEntries([...formData.keys()].map((k) => [k, formData.get(k)])));
  if ("error" in parsed) done(back, "erreur", parsed.error);
  await save(back, parsed.values as Record<string, string>);
}

/** Remet les trois couleurs de la plateforme à leurs valeurs d'origine. */
export async function resetPlatformColors(formData: FormData): Promise<void> {
  const { color_primary, color_secondary, color_accent } = DEFAULT_SETTINGS;
  await save(backTo(formData), { color_primary, color_secondary, color_accent });
}
