"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { enrollmentErrorMessage } from "@/lib/enrollments/errors";
import type { FormState } from "@/lib/auth/actions";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createEnrollmentSchema } from "./enrollments";
import { temporaryPassword } from "./users";

/** Valide ou refuse une demande en attente, ou annule une inscription ; `back` ramène à la liste (adresse interne uniquement). */
export async function decideEnrollment(formData: FormData): Promise<void> {
  const id = z.string().uuid().safeParse(formData.get("enrollmentId"));
  const decision = z.enum(["approve", "decline", "cancel"]).safeParse(formData.get("decision"));
  const raw = formData.get("back")?.toString() ?? "";
  const back = /^\/admin\/inscriptions[^\s]*$/.test(raw) && !raw.includes("//") ? raw : "/admin/inscriptions";
  if (!id.success || !decision.success) redirect(back);
  const supabase = await createClient();
  const { error } = decision.data === "cancel"
    ? await supabase.rpc("cancel_enrollment", { p_enrollment: id.data })
    : await supabase.rpc("review_enrollment", { p_enrollment: id.data, p_approve: decision.data === "approve" });
  revalidatePath("/admin/inscriptions");
  const sep = back.includes("?") ? "&" : "?";
  const done = { approve: "validee", decline: "refusee", cancel: "annulee" }[decision.data];
  redirect(`${back}${sep}${error ? `erreur=${encodeURIComponent(enrollmentErrorMessage(error.message))}` : `resultat=${done}`}`);
}

/** Crée une inscription (apprenant existant, ou nouveau compte créé à la volée) avec paiement saisi, notes et pièces jointes ; réservé aux administrateurs. */
export async function createEnrollment(_prev: FormState, formData: FormData): Promise<FormState> {
  const values = Object.fromEntries([...formData.entries()].filter(([, v]) => typeof v === "string" && v.length < 2000)) as Record<string, string>;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Session expirée. Reconnectez-vous.", values };
  const { data: isAdmin } = await supabase.rpc("has_role", { _role: "admin" });
  if (!isAdmin) return { error: "Seul un administrateur peut effectuer cette action.", values };

  let documents: unknown[] = [];
  try { documents = formData.getAll("doc").map((v) => JSON.parse(String(v))); } catch { return { error: "Pièce jointe invalide.", values }; }
  const parsed = createEnrollmentSchema.safeParse({ ...Object.fromEntries(formData), documents });
  if (!parsed.success) return { fieldErrors: parsed.error.flatten().fieldErrors, values };
  const d = parsed.data;
  if (d.documents.some((f) => !f.path.startsWith(`${user.id}/`) || f.path.includes(".."))) return { fieldErrors: { documents: ["Pièce jointe invalide"] }, values };
  if (d.photoPath && !new RegExp(`^${user.id}/user-[0-9a-f-]{36}\\.(jpg|png)$`).test(d.photoPath)) return { fieldErrors: { photoPath: ["Photo invalide"] }, values };

  const admin = createAdminClient();
  let learnerId = d.learnerId;
  let password: string | null = null;
  if (d.mode === "existing") {
    const { data: role } = await admin.from("roles").select("id").eq("code", "learner").single<{ id: number }>();
    const { data: has } = await admin.from("user_roles").select("user_id").eq("user_id", learnerId).eq("role_id", role?.id ?? -1).maybeSingle();
    if (!has) return { fieldErrors: { learnerId: ["Apprenant introuvable"] }, values };
  } else {
    password = temporaryPassword((n) => crypto.getRandomValues(new Uint8Array(n)));
    const fullName = `${d.firstName} ${d.lastName}`;
    const created = await admin.auth.admin.createUser({ email: d.email, password, email_confirm: true, user_metadata: { full_name: fullName, phone: `${d.phoneCode} ${d.phoneNumber}` } });
    if (created.error || !created.data.user) {
      const exists = /already|registered|exists/i.test(created.error?.message ?? "");
      return { ...(exists ? { fieldErrors: { email: ["Un compte existe déjà avec cette adresse e-mail : choisissez « Apprenant existant »."] } } : { error: "Impossible de créer le compte. Réessayez." }), values };
    }
    learnerId = created.data.user.id;
    let photo: string | null = null;
    if (d.photoPath) {
      const moved = await admin.storage.from("profile-photos").move(d.photoPath, `${learnerId}/photo`);
      if (!moved.error) photo = `${learnerId}/photo`;
    }
    await admin.from("profiles").update({ gender: d.gender, birth_date: d.birthDate, photo_path: photo }).eq("id", learnerId);
    await admin.from("audit_logs").insert({ actor_id: user.id, action: "user.create", entity_type: "user", entity_id: learnerId, metadata: { roles: ["learner"], via: "enrollment" } });
  }

  const { data, error } = await supabase.rpc("admin_create_enrollment", {
    p_learner: learnerId, p_course: d.courseId, p_session: d.sessionId, p_status: d.status, p_date: d.date, p_source: d.source, p_notes: d.notes,
    p_amount_due: d.amountDue, p_amount_paid: d.amountPaid, p_payment_status: d.paymentStatus, p_payment_method: d.paymentMethod,
  });
  if (error) {
    const note = password ? " Le compte de l’apprenant a toutefois été créé : choisissez « Apprenant existant » pour réessayer." : "";
    return { error: `${enrollmentErrorMessage(error.message)}${note}`, values };
  }
  const result = data as { enrollment_id: string; status: string; reference: string };
  if (d.documents.length) {
    await admin.from("enrollment_documents").insert(d.documents.map((f) => ({ enrollment_id: result.enrollment_id, storage_path: f.path, file_name: f.name, size_bytes: f.size })));
  }
  revalidatePath("/admin/inscriptions");
  if (password) return { message: "Inscription créée.", values: { email: d.email, password, reference: result.reference, status: result.status } };
  redirect(`/admin/inscriptions?resultat=${result.status === "waitlisted" ? "attente" : "creee"}`);
}
