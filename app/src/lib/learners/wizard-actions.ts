"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { FormState } from "@/lib/auth/actions";
import { enrollmentErrorMessage } from "@/lib/enrollments/errors";
import { createClient } from "@/lib/supabase/server";
import { isSelectable, learnerStep1Schema, learnerStep2Schema, learnerStep3Schema, learnerWizardUrl, summarizeResult } from "./wizard";

const uuid = z.string().uuid();
const entries = (fd: FormData) => Object.fromEntries([...fd.entries()].filter(([, v]) => typeof v === "string")) as Record<string, string>;

async function auth() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return { supabase, user };
}

/** Enregistre une étape dans la fiche (créée à la première étape) puis passe à la destination demandée. */
export async function saveLearnerStep(_prev: FormState, formData: FormData): Promise<FormState> {
  const values = entries(formData);
  const step = formData.get("step")?.toString();
  const next = formData.get("next")?.toString();
  const idParsed = uuid.safeParse(formData.get("registrationId"));
  const id = idParsed.success ? idParsed.data : undefined;
  if (step !== "1" && step !== "2" && step !== "3") return { error: "Étape inconnue.", values };
  if (step !== "1" && !id) return { error: "Fiche introuvable.", values };

  const { supabase, user } = await auth();
  if (!user) return { error: "Session expirée. Reconnectez-vous.", values };

  let patch: Record<string, unknown>;
  if (step === "1") {
    const p = learnerStep1Schema.safeParse(values);
    if (!p.success) return { fieldErrors: p.error.flatten().fieldErrors, values };
    const d = p.data;
    // La photo doit se trouver dans le dossier du formateur (le stockage l'impose déjà : on refuse tout autre chemin)
    if (d.photoPath && !new RegExp(`^${user.id}/learner-[0-9a-f-]{36}\\.(jpg|png)$`).test(d.photoPath)) return { fieldErrors: { photoPath: ["Photo invalide"] }, values };
    patch = {
      first_name: d.firstName, last_name: d.lastName, email: d.email, phone: `${d.phoneCode} ${d.phoneNumber}`, birth_date: d.birthDate,
      gender: d.gender, company: d.company, job_title: d.jobTitle, address: d.address, notes: d.notes, photo_path: d.photoPath,
    };
  } else if (step === "2") {
    const p = learnerStep2Schema.safeParse({ sessionIds: [...new Set(formData.getAll("sessionId").map(String))] });
    if (!p.success) return { fieldErrors: p.error.flatten().fieldErrors, values };
    const now = Date.now();
    const found = await supabase.from("sessions").select("id, capacity, waitlist_enabled, status, start_at, end_at").in("id", p.data.sessionIds).eq("instructor_id", user.id)
      .returns<{ id: string; capacity: number; waitlist_enabled: boolean; status: string; start_at: string; end_at: string }[]>();
    const taken = await supabase.from("enrollments").select("session_id, status").in("session_id", p.data.sessionIds);
    const count = (sid: string) => (taken.data ?? []).filter((e) => e.session_id === sid && ["confirmed", "completed", "pending_payment", "suspended"].includes(e.status)).length;
    const ok = (found.data ?? []).filter((s) => isSelectable({ ...s, taken: count(s.id) }, now));
    if (ok.length !== p.data.sessionIds.length) return { fieldErrors: { sessionIds: ["Une des sessions choisies n’est plus disponible."] }, values };
    patch = { session_ids: p.data.sessionIds };
  } else {
    const p = learnerStep3Schema.safeParse({ notify: values.notify === "1" ? "1" : "0" });
    if (!p.success) return { error: "Option invalide.", values };
    patch = { notify: p.data.notify === "1" };
  }

  let rid = id;
  if (rid) {
    const { data, error } = await supabase.from("learner_registrations").update(patch).eq("id", rid).eq("status", "draft").select("id").maybeSingle();
    if (error || !data) return { error: "Impossible d’enregistrer cette étape. Réessayez.", values };
  } else {
    const { data, error } = await supabase.from("learner_registrations").insert({ ...patch, instructor_id: user.id }).select("id").single<{ id: string }>();
    if (error || !data) return { error: "Impossible d’enregistrer cette étape. Vérifiez les informations.", values };
    rid = data.id;
  }
  redirect(learnerWizardUrl(rid, next, Number(step) + 1));
}

/** Confirme : inscrit l'apprenant s'il a un compte, sinon met la fiche en attente de la création de son compte. */
export async function confirmLearnerRegistration(formData: FormData): Promise<void> {
  const id = uuid.safeParse(formData.get("registrationId"));
  if (!id.success) redirect("/formateur/apprenants");
  const { supabase } = await auth();
  const { data, error } = await supabase.rpc("confirm_learner_registration", { p_id: id.data });
  if (error) {
    const msg = error.message.includes("sessions_required") ? "Sélectionnez au moins une session." : enrollmentErrorMessage(error.message);
    redirect(`/formateur/apprenants/nouveau/${id.data}?etape=4&erreur=${encodeURIComponent(msg)}`);
  }
  const s = summarizeResult(data as { status?: string; enrolled?: number; failed?: unknown[] });
  revalidatePath("/formateur", "layout");
  const q = new URLSearchParams({ resultat: s.pending ? "attente" : "ajoute", n: String(s.enrolled), echecs: String(s.failed) });
  redirect(`/formateur/apprenants?${q}`);
}

/** Abandonne l'assistant : supprime la fiche en brouillon puis revient à la liste. */
export async function discardLearnerDraft(formData: FormData): Promise<void> {
  const id = uuid.safeParse(formData.get("registrationId"));
  if (id.success) {
    const { supabase } = await auth();
    await supabase.from("learner_registrations").delete().eq("id", id.data).eq("status", "draft");
  }
  redirect("/formateur/apprenants");
}
