"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { FormState } from "@/lib/auth/actions";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { createCertificationSchema } from "./certifications";

const RESULTS = { active: "activee", review: "revision", inactive: "desactivee" } as const;

/** Change le statut d'une certification ; `back` ramène à la liste d'où l'action est partie (adresse interne uniquement). */
export async function setCertificationStatus(formData: FormData): Promise<void> {
  const id = z.string().uuid().safeParse(formData.get("certificationId"));
  const status = z.enum(["active", "review", "inactive"]).safeParse(formData.get("status"));
  const raw = formData.get("back")?.toString() ?? "";
  const back = /^\/admin\/certifications[^\s]*$/.test(raw) && !raw.includes("//") ? raw : "/admin/certifications";
  if (!id.success || !status.success) redirect(back);
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_set_certification_status", { p_certification: id.data, p_status: status.data });
  revalidatePath("/admin/certifications");
  const sep = back.includes("?") ? "&" : "?";
  redirect(`${back}${sep}${error ? `erreur=${encodeURIComponent("L’opération a échoué. Réessayez.")}` : `resultat=${RESULTS[status.data]}`}`);
}

/** Crée une certification (informations, formation et évaluation, validité, modèle d'attestation, options) ; une seule par formation. */
export async function createCertification(_prev: FormState, formData: FormData): Promise<FormState> {
  const values = Object.fromEntries([...formData.entries()].filter(([, v]) => typeof v === "string" && v.length < 2000)) as Record<string, string>;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Session expirée. Reconnectez-vous.", values };
  const { data: isAdmin } = await supabase.rpc("has_role", { _role: "admin" });
  if (!isAdmin) return { error: "Seul un administrateur peut effectuer cette action.", values };

  const parsed = createCertificationSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { fieldErrors: parsed.error.flatten().fieldErrors, values };
  const d = parsed.data;
  if (d.coverUrl && !new RegExp(`^https://[^/]+/storage/v1/object/public/certification-covers/${user.id}/`).test(d.coverUrl)) return { fieldErrors: { coverUrl: ["Visuel invalide"] }, values };

  const admin = createAdminClient();
  const [course, category, template] = await Promise.all([
    admin.from("courses").select("id").eq("id", d.courseId).eq("status", "published").maybeSingle(),
    admin.from("categories").select("id").eq("id", d.categoryId).maybeSingle(),
    admin.from("certificate_templates").select("id").eq("id", d.templateId).eq("status", "published").maybeSingle(),
  ]);
  if (!course.data) return { fieldErrors: { courseId: ["Formation introuvable ou non publiée"] }, values };
  if (!category.data) return { fieldErrors: { categoryId: ["Catégorie introuvable"] }, values };
  if (!template.data) return { fieldErrors: { templateId: ["Modèle introuvable ou non publié"] }, values };

  const { data: created, error } = await admin.from("certifications").insert({
    name: d.name, code: d.code, course_id: d.courseId, category_id: d.categoryId, level: d.level, description: d.description, cover_url: d.coverUrl,
    evaluation_type: d.evaluationType, passing_score: d.passingScore, max_attempts: d.maxAttempts, validity_months: d.validity,
    delivery_mode: d.deliveryMode, auto_pdf: d.autoPdf, template_id: d.templateId, number_prefix: d.numberPrefix,
    show_public: d.showPublic, allow_verification: d.allowVerification, require_proof: d.requireProof, status: d.status, created_by: user.id,
  }).select("id").single<{ id: string }>();
  if (error || !created) {
    if (error?.code === "23505") {
      return error.message.includes("course_id") ? { fieldErrors: { courseId: ["Cette formation a déjà une certification"] }, values } : { fieldErrors: { code: ["Ce code est déjà utilisé"] }, values };
    }
    return { error: "Impossible d’enregistrer la certification. Vérifiez les informations.", values };
  }
  await admin.from("audit_logs").insert({ actor_id: user.id, action: "certification.create", entity_type: "certification", entity_id: created.id, metadata: { code: d.code, status: d.status } });
  revalidatePath("/admin/certifications");
  redirect("/admin/certifications?resultat=creee");
}
