"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { FormState } from "@/lib/auth/actions";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

import { createAdminSessionSchema } from "./sessions";

const MESSAGES: Record<string, string> = {
  session_locked: "Cette session ne peut plus être modifiée.",
  session_not_found: "Session introuvable.",
};

/** Annule une session ou rétablit une session annulée ; `back` ramène à la liste d'où l'action est partie (adresse interne uniquement). */
export async function setSessionStatus(formData: FormData): Promise<void> {
  const id = z.string().uuid().safeParse(formData.get("sessionId"));
  const status = z.enum(["scheduled", "cancelled"]).safeParse(formData.get("status"));
  const raw = formData.get("back")?.toString() ?? "";
  const back = /^\/admin\/sessions[^\s]*$/.test(raw) && !raw.includes("//") ? raw : "/admin/sessions";
  if (!id.success || !status.success) redirect(back);
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_set_session_status", { p_session: id.data, p_status: status.data });
  revalidatePath("/admin/sessions");
  const sep = back.includes("?") ? "&" : "?";
  const msg = MESSAGES[Object.keys(MESSAGES).find((k) => error?.message?.includes(k)) ?? ""] ?? "L’opération a échoué. Réessayez.";
  redirect(`${back}${sep}${error ? `erreur=${encodeURIComponent(msg)}` : `resultat=${status.data === "cancelled" ? "annulee" : "retablie"}`}`);
}

/** Crée une session pour un formateur (ouverte aux inscriptions ou en brouillon), avec ses formateurs supplémentaires et son lien de connexion ; tracé dans le journal d'audit. */
export async function createAdminSession(_prev: FormState, formData: FormData): Promise<FormState> {
  const values = Object.fromEntries([...formData.entries()].filter(([, v]) => typeof v === "string")) as Record<string, string>;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Session expirée. Reconnectez-vous.", values };
  const { data: isAdmin } = await supabase.rpc("has_role", { _role: "admin" });
  if (!isAdmin) return { error: "Seul un administrateur peut effectuer cette action.", values };

  const parsed = createAdminSessionSchema.safeParse({ ...Object.fromEntries(formData), extraInstructors: formData.getAll("extraInstructor").map(String) });
  if (!parsed.success) return { fieldErrors: parsed.error.flatten().fieldErrors, values };
  const d = parsed.data;
  if (d.initial === "open" && Date.parse(d.startAt) <= Date.now()) return { fieldErrors: { startDate: ["La session doit commencer dans le futur"] }, values };
  if (d.coverUrl && !new RegExp(`^https://[^/]+/storage/v1/object/public/session-covers/${user.id}/`).test(d.coverUrl)) return { fieldErrors: { coverUrl: ["Image invalide"] }, values };

  const admin = createAdminClient();
  const { data: course } = await admin.from("courses").select("id").eq("id", d.courseId).eq("status", "published").maybeSingle();
  if (!course) return { fieldErrors: { courseId: ["Formation introuvable ou non publiée"] }, values };

  const ids = [...new Set([d.instructorId, ...d.extraInstructors])];
  const { data: role } = await admin.from("roles").select("id").eq("code", "instructor").single<{ id: number }>();
  const { data: trainers } = await admin.from("user_roles").select("user_id").eq("role_id", role?.id ?? -1).in("user_id", ids);
  const known = new Set((trainers ?? []).map((t) => t.user_id as string));
  if (!known.has(d.instructorId)) return { fieldErrors: { instructorId: ["Formateur introuvable"] }, values };
  if (d.extraInstructors.some((i) => !known.has(i))) return { fieldErrors: { extraInstructors: ["Formateur introuvable"] }, values };

  const { data: created, error } = await admin.from("sessions").insert({
    course_id: d.courseId, instructor_id: d.instructorId, title: d.title, description: d.description, reference: d.code ?? undefined,
    start_at: d.startAt, end_at: d.endAt, timezone: d.timezone, delivery_mode: d.mode, location: d.location,
    capacity: d.capacity, min_capacity: d.minCapacity, registration_deadline: d.deadlineAt, waitlist_enabled: d.waitlist,
    online_registration: d.onlineRegistration, manual_validation: d.manualValidation, company_reserved: d.companyReserved,
    cover_url: d.coverUrl, status: d.initial === "open" ? "scheduled" : "draft",
  }).select("id").single<{ id: string }>();
  if (error || !created) {
    if (error?.code === "23505") return { fieldErrors: { code: ["Ce code est déjà utilisé"] }, values };
    if (error?.code === "23P01") return { fieldErrors: { instructorId: ["Ce formateur a déjà une session sur ce créneau"] }, values };
    return { error: "Impossible de créer la session. Vérifiez les informations.", values };
  }

  if (d.meetingUrl) await admin.from("session_meeting_links").insert({ session_id: created.id, url: d.meetingUrl });
  if (d.extraInstructors.length) await admin.from("session_instructors").insert(d.extraInstructors.map((instructor_id) => ({ session_id: created.id, instructor_id })));
  await admin.from("audit_logs").insert({ actor_id: user.id, action: "session.create", entity_type: "session", entity_id: created.id, metadata: { course: d.courseId, instructor: d.instructorId, status: d.initial } });
  revalidatePath("/admin/sessions");
  redirect(`/admin/sessions?resultat=${d.initial === "open" ? "creee" : "brouillon"}`);
}
