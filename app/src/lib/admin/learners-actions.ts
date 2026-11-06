"use server";

import { revalidatePath } from "next/cache";
import { enrollmentErrorMessage } from "@/lib/enrollments/errors";
import type { FormState } from "@/lib/auth/actions";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { createLearnerSchema, experienceBand } from "./learners";
import { temporaryPassword } from "./users";

/** Crée un compte apprenant confirmé (profil complet, entreprise, formations souhaitées), et l'inscrit à une session si demandé ; tracé dans le journal d'audit. */
export async function createLearner(_prev: FormState, formData: FormData): Promise<FormState> {
  // Le mot de passe saisi ne revient jamais dans les valeurs ré-affichées
  const values = Object.fromEntries([...formData.entries()].filter(([k, v]) => typeof v === "string" && k !== "password" && v.length < 2000)) as Record<string, string>;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Session expirée. Reconnectez-vous.", values };
  const { data: isAdmin } = await supabase.rpc("has_role", { _role: "admin" });
  if (!isAdmin) return { error: "Seul un administrateur peut effectuer cette action.", values };

  const parsed = createLearnerSchema.safeParse({ ...Object.fromEntries(formData), courseIds: formData.getAll("courseId").map(String) });
  if (!parsed.success) return { fieldErrors: parsed.error.flatten().fieldErrors, values };
  const d = parsed.data;
  if (d.photoPath && !new RegExp(`^${user.id}/user-[0-9a-f-]{36}\\.(jpg|png)$`).test(d.photoPath)) return { fieldErrors: { photoPath: ["Photo invalide"] }, values };

  const admin = createAdminClient();
  let orgName: string | null = null;
  if (d.organizationId) {
    const { data: org } = await admin.from("organizations").select("name").eq("id", d.organizationId).maybeSingle<{ name: string }>();
    if (!org) return { fieldErrors: { organizationId: ["Entreprise introuvable"] }, values };
    orgName = org.name;
  }
  const { data: courses } = await admin.from("courses").select("id").in("id", d.courseIds).eq("status", "published");
  if ((courses ?? []).length !== d.courseIds.length) return { fieldErrors: { courseIds: ["Formation introuvable ou non publiée"] }, values };
  let session: { id: string; course_id: string } | null = null;
  if (d.sessionId) {
    const { data } = await admin.from("sessions").select("id, course_id").eq("id", d.sessionId).maybeSingle<{ id: string; course_id: string }>();
    if (!data) return { fieldErrors: { sessionId: ["Session introuvable"] }, values };
    session = data;
  }

  const generated = d.password === "";
  const password = generated ? temporaryPassword((n) => crypto.getRandomValues(new Uint8Array(n))) : d.password;
  const created = await admin.auth.admin.createUser({
    email: d.email, password, email_confirm: true,
    user_metadata: { full_name: `${d.firstName} ${d.lastName}`, phone: `${d.phoneCode} ${d.phoneNumber}` },
  });
  if (created.error || !created.data.user) {
    const exists = /already|registered|exists/i.test(created.error?.message ?? "");
    return exists ? { fieldErrors: { email: ["Un compte existe déjà avec cette adresse e-mail"] }, values } : { error: "Impossible de créer le compte. Réessayez.", values };
  }
  const id = created.data.user.id;

  let photo: string | null = null;
  if (d.photoPath) {
    const moved = await admin.storage.from("profile-photos").move(d.photoPath, `${id}/photo`);
    if (!moved.error) photo = `${id}/photo`;
  }
  await admin.from("profiles").update({
    gender: d.civility, birth_date: d.birthDate, nationality: d.nationality, address: d.address, photo_path: photo,
    situation: d.situation, profession: d.jobTitle, employer: orgName, experience_band: experienceBand(d.experienceYears), education_level: d.educationLevel ?? null,
    preferences: { desired_courses: d.courseIds },
  }).eq("id", id);
  await admin.from("learner_private").insert({ user_id: id, birth_place: d.birthPlace, id_type: d.idType ?? null, id_number: d.idNumber, id_valid_until: d.idValidUntil, notes: d.notes });
  if (d.organizationId) await admin.from("organization_members").insert({ organization_id: d.organizationId, user_id: id, role: "member", status: "active" });
  await admin.from("audit_logs").insert({ actor_id: user.id, action: "user.create", entity_type: "user", entity_id: id, metadata: { roles: ["learner"], via: "learner_form" } });

  // L'échec de l'inscription n'annule pas le compte : on le signale pour que l'administrateur la refasse
  let warning: string | null = null;
  if (session && d.enrollment !== "none") {
    const { error } = await supabase.rpc("admin_create_enrollment", {
      p_learner: id, p_course: session.course_id, p_session: session.id, p_status: d.enrollment, p_date: new Date().toISOString().slice(0, 10), p_source: "administration",
      p_notes: null, p_amount_due: null, p_amount_paid: null, p_payment_status: null, p_payment_method: null,
    });
    if (error) warning = `Le compte est créé, mais l’inscription à la session a échoué : ${enrollmentErrorMessage(error.message)}`;
  }
  revalidatePath("/admin/apprenants");
  revalidatePath("/admin/utilisateurs");
  return { message: "Apprenant créé.", values: { id, email: d.email, name: `${d.firstName} ${d.lastName}`, ...(generated ? { password } : {}), ...(warning ? { warning } : {}) } };
}
