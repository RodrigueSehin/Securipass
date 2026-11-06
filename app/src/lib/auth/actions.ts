"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { homeForRoles } from "./permissions";
import { buildSignupMetadata, formDataToRecord, loginSchema, registerSchema, safeRedirect } from "./schemas";
import { signupErrorMessage } from "./signup-errors";

export type FormState = {
  error?: string;
  fieldErrors?: Record<string, string[]>;
  message?: string;
  /** Valeurs non sensibles à ré-afficher (React 19 vide le formulaire après une action). */
  values?: Record<string, string>;
  /** Liste de points à corriger (ex. éléments manquants avant soumission). */
  list?: string[];
};

/** Champs texte à conserver après erreur ; jamais les mots de passe. */
function keepValues(formData: FormData, names: string[]): Record<string, string> {
  return Object.fromEntries(names.map((n) => [n, formData.get(n)?.toString() ?? ""]));
}

export async function login(_prev: FormState, formData: FormData): Promise<FormState> {
  const values = keepValues(formData, ["email"]);
  const parsed = loginSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { fieldErrors: parsed.error.flatten().fieldErrors, values };

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword(parsed.data);
  // Message volontairement générique : pas d'énumération des comptes.
  if (error || !data.user) return { error: "E-mail ou mot de passe incorrect.", values };

  const { data: rows } = await supabase
    .from("user_roles")
    .select("roles(code)")
    .eq("user_id", data.user.id);
  const roles = (rows ?? []).flatMap((r) => {
    const rel = r.roles as unknown as { code: string } | { code: string }[] | null;
    return Array.isArray(rel) ? rel.map((x) => x.code) : rel ? [rel.code] : [];
  });
  redirect(safeRedirect(formData.get("redirect")?.toString(), homeForRoles(roles)));
}

export async function register(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = registerSchema.safeParse(formDataToRecord(formData));
  if (!parsed.success) return { fieldErrors: parsed.error.flatten().fieldErrors };
  const { email, password } = parsed.data;

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    // Le déclencheur SQL revalide ces métadonnées ; aucun rôle n'en est jamais lu.
    options: { data: buildSignupMetadata(parsed.data) },
  });
  if (error) {
    // Détail complet dans les journaux du serveur ; l’utilisateur reçoit un message et un code.
    console.error("[inscription] échec Supabase", { code: error.code, status: error.status, message: error.message });
    return { error: signupErrorMessage(error.code) };
  }

  if (!data.session) {
    return { message: email };
  }
  redirect(safeRedirect(formData.get("redirect")?.toString(), "/app"));
}

export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/");
}
