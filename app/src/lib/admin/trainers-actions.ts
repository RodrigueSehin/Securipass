"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { FormState } from "@/lib/auth/actions";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { createTrainerSchema } from "./trainers";
import { temporaryPassword } from "./users";

const uuid = z.string().uuid();

/** Définit le type de contrat d'un formateur ; `back` ramène à la liste d'où l'action est partie (adresse interne uniquement). */
export async function setTrainerContract(formData: FormData): Promise<void> {
  const id = uuid.safeParse(formData.get("userId"));
  const contract = formData.get("contract") === "internal" ? "internal" : "external";
  const raw = formData.get("back")?.toString() ?? "";
  const back = /^\/admin\/formateurs[^\s]*$/.test(raw) && !raw.includes("//") ? raw : "/admin/formateurs";
  if (!id.success) redirect(back);
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_set_trainer_contract", { p_user: id.data, p_contract: contract });
  revalidatePath("/admin/formateurs");
  const sep = back.includes("?") ? "&" : "?";
  redirect(`${back}${sep}${error ? `erreur=${encodeURIComponent("L’opération a échoué. Réessayez.")}` : "resultat=contrat"}`);
}

/** Crée un compte formateur confirmé (rôle « formateur » seul) avec sa fiche et les formations qu'il peut animer ; tracé dans le journal d'audit. */
export async function createTrainer(_prev: FormState, formData: FormData): Promise<FormState> {
  // Le mot de passe saisi ne revient jamais dans les valeurs ré-affichées
  const values = Object.fromEntries([...formData.entries()].filter(([k, v]) => typeof v === "string" && k !== "password")) as Record<string, string>;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Session expirée. Reconnectez-vous.", values };
  const { data: isAdmin } = await supabase.rpc("has_role", { _role: "admin" });
  if (!isAdmin) return { error: "Seul un administrateur peut effectuer cette action.", values };

  const parsed = createTrainerSchema.safeParse({
    ...Object.fromEntries(formData),
    extraCategories: formData.getAll("extraCategory").map(String),
    skills: formData.getAll("skills").map(String).filter(Boolean),
    diplomas: formData.getAll("diplomas").map(String).filter(Boolean),
    courseIds: formData.getAll("courseId").map(String),
  });
  if (!parsed.success) return { fieldErrors: parsed.error.flatten().fieldErrors, values };
  const d = parsed.data;
  if (d.photoPath && !new RegExp(`^${user.id}/user-[0-9a-f-]{36}\\.(jpg|png)$`).test(d.photoPath)) return { fieldErrors: { photoPath: ["Photo invalide"] }, values };

  const admin = createAdminClient();
  const categoryIds = [...new Set([d.mainCategory, ...d.extraCategories])];
  const { data: cats } = await admin.from("categories").select("id").in("id", categoryIds);
  if ((cats?.length ?? 0) !== categoryIds.length) return { fieldErrors: { mainCategory: ["Spécialité introuvable"] }, values };
  if (d.organizationId) {
    const { data: org } = await admin.from("organizations").select("id").eq("id", d.organizationId).maybeSingle();
    if (!org) return { fieldErrors: { organizationId: ["Organisation introuvable"] }, values };
  }
  const courseIds = [...new Set(d.courseIds)];
  if (courseIds.length) {
    const { data: courses } = await admin.from("courses").select("id").in("id", courseIds).eq("status", "published");
    if ((courses?.length ?? 0) !== courseIds.length) return { fieldErrors: { courseId: ["Formation introuvable"] }, values };
  }

  const phone = `${d.phoneCode} ${d.phoneNumber}`;
  const password = d.passwordMode === "manual" ? d.password : temporaryPassword((n) => crypto.getRandomValues(new Uint8Array(n)));
  const created = await admin.auth.admin.createUser({ email: d.email, password, email_confirm: true, user_metadata: { full_name: d.fullName, phone } });
  if (created.error || !created.data.user) {
    const exists = /already|registered|exists/i.test(created.error?.message ?? "");
    return { error: exists ? "Un compte existe déjà avec cette adresse e-mail." : "Impossible de créer le compte. Réessayez.", values };
  }
  const id = created.data.user.id;

  // Le déclencheur d'inscription a donné le rôle « apprenant » : le formateur n'a que le rôle « formateur »
  const { data: role } = await admin.from("roles").select("id").eq("code", "instructor").single<{ id: number }>();
  await admin.from("user_roles").delete().eq("user_id", id);
  await admin.from("user_roles").insert({ user_id: id, role_id: role?.id, assigned_by: user.id });

  let photo: string | null = null;
  if (d.photoPath) {
    const moved = await admin.storage.from("profile-photos").move(d.photoPath, `${id}/photo`);
    if (!moved.error) photo = `${id}/photo`;
  }
  await admin.from("profiles").update({ gender: d.gender, birth_date: d.birthDate, profession: d.jobTitle, locality: d.city, photo_path: photo }).eq("id", id);
  if (d.organizationId) await admin.from("organization_members").insert({ organization_id: d.organizationId, user_id: id, role: "member", status: "active" });
  await admin.from("trainer_contracts").insert({
    user_id: id, contract_type: d.contract, experience_years: d.experience, city: d.city, bio: d.bio, main_category_id: d.mainCategory,
    extra_category_ids: d.extraCategories.filter((c) => c !== d.mainCategory), skills: d.skills, diplomas: d.diplomas,
  });
  if (courseIds.length) await admin.from("trainer_courses").insert(courseIds.map((course_id) => ({ trainer_id: id, course_id })));
  await admin.from("audit_logs").insert({ actor_id: user.id, action: "trainer.create", entity_type: "user", entity_id: id, metadata: { contract: d.contract, courses: courseIds.length } });
  revalidatePath("/admin/formateurs");
  // Mot de passe défini par l'administrateur : il le connaît déjà, on ne le répète pas
  return { message: "Formateur créé.", values: { id, email: d.email, ...(d.passwordMode === "auto" ? { password } : {}) } };
}
