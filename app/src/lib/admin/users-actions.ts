"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { FormState } from "@/lib/auth/actions";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { createUserSchema, ROLE_CODES, temporaryPassword } from "./users";

const uuid = z.string().uuid();

const MESSAGES: Record<string, string> = {
  forbidden: "Seul un administrateur peut effectuer cette action.",
  roles_required: "Choisissez au moins un rôle.",
  role_unknown: "Rôle inconnu.",
  cannot_demote_self: "Vous ne pouvez pas retirer votre propre rôle d’administrateur.",
  cannot_suspend_self: "Vous ne pouvez pas suspendre votre propre compte.",
  user_not_found: "Utilisateur introuvable.",
  status_invalid: "Statut invalide.",
};
const message = (m: string | undefined) => MESSAGES[Object.keys(MESSAGES).find((k) => m?.includes(k)) ?? ""] ?? "L’opération a échoué. Réessayez.";

/** Remplace les rôles d'un compte (fonction SQL réservée aux administrateurs, avec garde-fous et journal d'audit). */
export async function updateUserRoles(formData: FormData): Promise<void> {
  const id = uuid.safeParse(formData.get("userId"));
  if (!id.success) redirect("/admin/utilisateurs");
  const roles = formData.getAll("role").map(String).filter((r) => (ROLE_CODES as string[]).includes(r));
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_set_user_roles", { p_user: id.data, p_roles: roles });
  revalidatePath("/admin/utilisateurs");
  redirect(`/admin/utilisateurs/${id.data}?${error ? `erreur=${encodeURIComponent(message(error.message))}` : "resultat=roles"}`);
}

/** Suspend ou réactive un compte ; `back` ramène à la page d'où l'action est partie (adresse interne uniquement). */
export async function updateUserStatus(formData: FormData): Promise<void> {
  const id = uuid.safeParse(formData.get("userId"));
  const status = formData.get("status") === "suspended" ? "suspended" : "active";
  const raw = formData.get("back")?.toString() ?? "";
  const back = /^\/admin\/(utilisateurs|apprenants)[^\s]*$/.test(raw) && !raw.includes("//") ? raw : "/admin/utilisateurs";
  if (!id.success) redirect(back);
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_set_user_status", { p_user: id.data, p_status: status });
  revalidatePath("/admin/utilisateurs");
  revalidatePath("/admin/apprenants");
  const sep = back.includes("?") ? "&" : "?";
  redirect(`${back}${sep}${error ? `erreur=${encodeURIComponent(message(error.message))}` : `resultat=${status === "suspended" ? "suspendu" : "reactive"}`}`);
}

/** Crée un compte confirmé (mot de passe généré ou défini), avec profil, organisation, rôles et statut ; tout est tracé dans le journal d'audit. */
export async function createUser(_prev: FormState, formData: FormData): Promise<FormState> {
  // Le mot de passe saisi ne revient jamais dans les valeurs ré-affichées
  const values = Object.fromEntries([...formData.entries()].filter(([k, v]) => typeof v === "string" && k !== "password")) as Record<string, string>;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Session expirée. Reconnectez-vous.", values };
  const { data: isAdmin } = await supabase.rpc("has_role", { _role: "admin" });
  if (!isAdmin) return { error: message("forbidden"), values };

  const parsed = createUserSchema.safeParse({ ...Object.fromEntries(formData), roles: formData.getAll("role").map(String) });
  if (!parsed.success) return { fieldErrors: parsed.error.flatten().fieldErrors, values };
  const d = parsed.data;
  if (d.photoPath && !new RegExp(`^${user.id}/user-[0-9a-f-]{36}\\.(jpg|png)$`).test(d.photoPath)) return { fieldErrors: { photoPath: ["Photo invalide"] }, values };

  const admin = createAdminClient();
  if (d.organizationId) {
    const { data: org } = await admin.from("organizations").select("id").eq("id", d.organizationId).maybeSingle();
    if (!org) return { fieldErrors: { organizationId: ["Organisation introuvable"] }, values };
  }

  const phone = `${d.phoneCode} ${d.phoneNumber}`;
  const password = d.passwordMode === "manual" ? d.password : temporaryPassword((n) => crypto.getRandomValues(new Uint8Array(n)));
  const created = await admin.auth.admin.createUser({
    email: d.email, password, email_confirm: true, user_metadata: { full_name: d.fullName, phone },
  });
  if (created.error || !created.data.user) {
    const exists = /already|registered|exists/i.test(created.error?.message ?? "");
    return { error: exists ? "Un compte existe déjà avec cette adresse e-mail." : "Impossible de créer le compte. Réessayez.", values };
  }
  const id = created.data.user.id;

  // Le déclencheur d'inscription a donné le rôle « apprenant » : on le remplace par la sélection
  const { data: roles } = await admin.from("roles").select("id, code").in("code", d.roles).returns<{ id: number; code: string }[]>();
  await admin.from("user_roles").delete().eq("user_id", id);
  await admin.from("user_roles").insert((roles ?? []).map((r) => ({ user_id: id, role_id: r.id, assigned_by: user.id })));

  let photo: string | null = null;
  if (d.photoPath) {
    const moved = await admin.storage.from("profile-photos").move(d.photoPath, `${id}/photo`);
    if (!moved.error) photo = `${id}/photo`;
  }
  await admin.from("profiles").update({
    gender: d.gender, profession: d.jobTitle, department: d.department, photo_path: photo, status: d.status,
  }).eq("id", id);
  if (d.organizationId) {
    await admin.from("organization_members").insert({ organization_id: d.organizationId, user_id: id, role: "member", department: d.department, status: "active" });
  }
  await admin.from("audit_logs").insert({ actor_id: user.id, action: "user.create", entity_type: "user", entity_id: id, metadata: { roles: d.roles, status: d.status } });
  revalidatePath("/admin/utilisateurs");
  // Mot de passe défini par l'administrateur : il le connaît déjà, on ne le répète pas
  return { message: "Compte créé.", values: { id, email: d.email, ...(d.passwordMode === "auto" ? { password } : {}) } };
}
