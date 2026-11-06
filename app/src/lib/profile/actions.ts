"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { FormState } from "@/lib/auth/actions";
import { PHOTO_MAX_BYTES, PHOTO_TYPES, passwordSchema, personalSchema, preferencesSchema, professionalSchema } from "./schemas";

const SAVED: FormState = { message: "Vos informations ont été enregistrées." };
const SESSION: FormState = { error: "Session expirée. Reconnectez-vous." };
const SAVE_ERROR: FormState = { error: "Impossible d’enregistrer vos informations. Réessayez." };

async function currentUser() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return { supabase, user };
}

/** Informations personnelles (nom, téléphone, fuseau, nationalité, localisation, adresse, genre). */
export async function updatePersonal(_prev: FormState, formData: FormData): Promise<FormState> {
  const { supabase, user } = await currentUser();
  if (!user) return SESSION;
  const parsed = personalSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { fieldErrors: parsed.error.flatten().fieldErrors };
  const d = parsed.data;
  // La RLS limite la mise à jour à son propre profil ; le statut n'est pas modifiable.
  const { error } = await supabase.from("profiles").update({
    full_name: d.fullName,
    phone: d.phone ?? null,
    timezone: d.timezone,
    gender: d.gender ?? null,
    nationality: d.nationality ?? null,
    locality: d.locality ?? null,
    address: d.address ?? null,
  }).eq("id", user.id);
  if (error) return SAVE_ERROR;
  revalidatePath("/app/profil");
  return SAVED;
}

/** Informations professionnelles et formation. */
export async function updateProfessional(_prev: FormState, formData: FormData): Promise<FormState> {
  const { supabase, user } = await currentUser();
  if (!user) return SESSION;
  const parsed = professionalSchema.safeParse({ ...Object.fromEntries(formData), languages: formData.getAll("languages").map(String) });
  if (!parsed.success) return { fieldErrors: parsed.error.flatten().fieldErrors };
  const d = parsed.data;
  const { error } = await supabase.from("profiles").update({
    profession: d.profession ?? null,
    employer: d.employer ?? null,
    experience_band: d.experienceBand ?? null,
    education_level: d.educationLevel ?? null,
    languages: d.languages,
    availability: d.availability ?? null,
    training_goal: d.trainingGoal ?? null,
  }).eq("id", user.id);
  if (error) return SAVE_ERROR;
  revalidatePath("/app/profil");
  return SAVED;
}

/** Préférences de communication (e-mail, SMS). */
export async function updatePreferences(_prev: FormState, formData: FormData): Promise<FormState> {
  const { supabase, user } = await currentUser();
  if (!user) return SESSION;
  const parsed = preferencesSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { fieldErrors: parsed.error.flatten().fieldErrors };
  const { data: current } = await supabase.from("profiles").select("preferences").eq("id", user.id).single<{ preferences: Record<string, unknown> }>();
  const { error } = await supabase.from("profiles").update({
    preferences: { ...(current?.preferences ?? {}), notify_email: parsed.data.notifyEmail, notify_sms: parsed.data.notifySms },
  }).eq("id", user.id);
  if (error) return SAVE_ERROR;
  revalidatePath("/app/profil");
  return SAVED;
}

/** Photo de profil : fichier unique et privé dans le dossier de l'utilisateur. */
export async function uploadPhoto(_prev: FormState, formData: FormData): Promise<FormState> {
  const { supabase, user } = await currentUser();
  if (!user) return SESSION;
  const file = formData.get("photo");
  if (!(file instanceof File) || file.size === 0) return { fieldErrors: { photo: ["Choisissez une image."] } };
  if (!(PHOTO_TYPES as readonly string[]).includes(file.type)) return { fieldErrors: { photo: ["Format accepté : JPG ou PNG."] } };
  if (file.size > PHOTO_MAX_BYTES) return { fieldErrors: { photo: ["L’image doit peser moins de 2 Mo."] } };

  const path = `${user.id}/photo`;
  const { error: uploadError } = await supabase.storage.from("profile-photos").upload(path, file, { contentType: file.type, upsert: true });
  if (uploadError) return { error: "La photo n’a pas pu être envoyée. Réessayez." };
  const { error } = await supabase.from("profiles").update({ photo_path: path }).eq("id", user.id);
  if (error) return SAVE_ERROR;
  revalidatePath("/app/profil");
  return { message: "Votre photo a été mise à jour." };
}

export async function removePhoto(): Promise<void> {
  const { supabase, user } = await currentUser();
  if (!user) return;
  await supabase.storage.from("profile-photos").remove([`${user.id}/photo`]);
  await supabase.from("profiles").update({ photo_path: null }).eq("id", user.id);
  revalidatePath("/app/profil");
}

export async function changePassword(_prev: FormState, formData: FormData): Promise<FormState> {
  const { supabase, user } = await currentUser();
  if (!user?.email) return SESSION;

  const parsed = passwordSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { fieldErrors: parsed.error.flatten().fieldErrors };

  // Vérifie l'ancien mot de passe avant de le remplacer.
  const check = await supabase.auth.signInWithPassword({ email: user.email, password: parsed.data.currentPassword });
  if (check.error) return { fieldErrors: { currentPassword: ["Mot de passe actuel incorrect"] } };

  const { error } = await supabase.auth.updateUser({ password: parsed.data.newPassword });
  if (error) return { error: "Impossible de modifier le mot de passe. Réessayez." };
  return { message: "Votre mot de passe a été modifié." };
}
