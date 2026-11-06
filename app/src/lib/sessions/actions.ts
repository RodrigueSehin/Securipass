"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import type { FormState } from "@/lib/auth/actions";
import { offsetMinutes } from "./timezones";
import { enrollmentErrorMessage } from "@/lib/enrollments/errors";
import { enrollByEmailSchema, sessionSchema } from "./schemas";

const entries = (fd: FormData) => Object.fromEntries(fd) as Record<string, string>;
const stringValues = (fd: FormData) =>
  Object.fromEntries([...fd.entries()].filter(([, v]) => typeof v === "string")) as Record<string, string>;

async function auth() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return { supabase, user };
}

const refresh = (courseId: string) => {
  revalidatePath(`/formateur/formations/${courseId}/sessions`, "layout");
  revalidatePath("/formateur/sessions");
};

function conflictMessage(code?: string, message?: string): string {
  if (code === "23P01") return "Vous avez déjà une session sur ce créneau horaire.";
  if (message?.includes("capacity_below_enrolled")) return enrollmentErrorMessage("capacity_below_enrolled");
  return "Impossible d’enregistrer la session. Vérifiez les informations.";
}

export async function saveSession(_prev: FormState, formData: FormData): Promise<FormState> {
  const r = await persistSession(formData);
  return { error: r.error, fieldErrors: r.fieldErrors, message: r.message, values: r.values };
}

/** Crée ou modifie une session à partir d'un formulaire ; réutilisée par l'assistant de création. */
export async function persistSession(formData: FormData): Promise<FormState & { sessionId?: string }> {
  const values = stringValues(formData);
  const { supabase, user } = await auth();
  if (!user) return { error: "Session expirée. Reconnectez-vous." };
  const parsed = sessionSchema.safeParse({ ...entries(formData), objectives: formData.has("objective") ? formData.getAll("objective").map(String) : undefined });
  if (!parsed.success) return { fieldErrors: parsed.error.flatten().fieldErrors, values };
  const d = parsed.data;
  // Les saisies sont lues comme heure d'Abidjan par le schéma : on les ramène à l'heure du fuseau choisi.
  const shift = (iso: string) => new Date(Date.parse(iso) - offsetMinutes(d.timezone) * 60_000).toISOString();
  if (d.timezone) {
    d.start = shift(d.start);
    d.end = shift(d.end);
    if (d.registrationDeadline) d.registrationDeadline = shift(d.registrationDeadline);
  }

  const sessionId = formData.get("sessionId")?.toString();
  const draft = formData.get("draft") === "1";
  const row = {
    title: d.title, start_at: d.start, end_at: d.end, delivery_mode: d.deliveryMode, location: d.location ?? null,
    capacity: d.capacity, registration_deadline: d.registrationDeadline ?? null, waitlist_enabled: d.waitlistEnabled,
    description: d.description, objectives: d.objectives, required_level: d.requiredLevel,
    prerequisite_course_id: d.prerequisiteCourseId, language: d.language, timezone: d.timezone,
    meeting_platform: formData.has("meetingPlatform") ? d.meetingPlatform ?? null : undefined,
    welcome_message: d.welcomeMessage,
    send_invitation: d.sendInvitation === undefined ? undefined : d.sendInvitation === "1",
    add_to_calendar: d.addToCalendar === undefined ? undefined : d.addToCalendar === "1",
  };

  let id: string;
  if (sessionId) {
    const sid = z.string().uuid().safeParse(sessionId);
    if (!sid.success) return { error: "Session introuvable.", values };
    const current = await supabase.from("sessions").select("status").eq("id", sid.data).maybeSingle();
    // Seul un brouillon change de statut ici : il devient planifié à l'enregistrement normal.
    const status = current.data?.status === "draft" ? (draft ? "draft" : "scheduled") : undefined;
    const { data, error } = await supabase.from("sessions").update({ ...row, ...(status ? { status } : {}) }).eq("id", sid.data).select("id").maybeSingle();
    if (error) return { error: conflictMessage(error.code, error.message), values };
    if (!data) return { error: "Session introuvable.", values };
    id = data.id;
  } else {
    if (new Date(d.start) <= new Date()) return { fieldErrors: { start: ["La session doit commencer dans le futur"] }, values };
    const { data, error } = await supabase
      .from("sessions").insert({ ...row, status: draft ? "draft" : "scheduled", course_id: d.courseId, instructor_id: user.id }).select("id").single();
    if (error || !data) return { error: conflictMessage(error?.code, error?.message), values };
    id = data.id;
  }

  // Lien de visioconférence : table séparée, visible des seuls inscrits/formateur/personnel
  if (d.meetingUrl) {
    const { error } = await supabase.from("session_meeting_links").upsert({ session_id: id, url: d.meetingUrl });
    if (error) return { error: "Session enregistrée, mais le lien de connexion n’a pas pu l’être.", values };
  } else {
    await supabase.from("session_meeting_links").delete().eq("session_id", id);
  }
  refresh(d.courseId);
  return { message: draft ? "Brouillon enregistré." : sessionId ? "Session modifiée." : "Session créée.", sessionId: id };
}

export async function cancelSession(_prev: FormState, formData: FormData): Promise<FormState> {
  const id = z.string().uuid().safeParse(formData.get("sessionId"));
  const courseId = z.string().uuid().safeParse(formData.get("courseId"));
  if (!id.success || !courseId.success) return { error: "Session introuvable." };
  const { supabase } = await auth();
  const { data, error } = await supabase.from("sessions").update({ status: "cancelled" }).eq("id", id.data).select("id").maybeSingle();
  if (error || !data) return { error: "Impossible d’annuler la session." };
  refresh(courseId.data);
  return { message: "Session annulée. Les inscriptions associées ont été annulées." };
}

export async function enrollLearnerByEmail(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = enrollByEmailSchema.safeParse(entries(formData));
  if (!parsed.success) return { fieldErrors: parsed.error.flatten().fieldErrors, values: stringValues(formData) };
  const { supabase } = await auth();
  const { data, error } = await supabase.rpc("instructor_enroll_learner", { p_session: parsed.data.sessionId, p_email: parsed.data.email });
  if (error) return { error: enrollmentErrorMessage(error.message), values: stringValues(formData) };
  revalidatePath("/formateur", "layout");
  const status = (data as { status?: string } | null)?.status;
  return { message: status === "waitlisted" ? "Apprenant ajouté en liste d’attente (session complète)." : "Apprenant inscrit à la session." };
}
