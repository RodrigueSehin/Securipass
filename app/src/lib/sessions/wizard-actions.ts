"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { FormState } from "@/lib/auth/actions";
import { createClient } from "@/lib/supabase/server";
import { persistSession } from "./actions";
import { localToUtc } from "./timezones";
import {
  draftToFormData, findOverlap, missingSteps, occurrences, sessionStep1Schema, sessionStep2Schema, sessionStep3Schema, sessionWizardUrl, type SessionDraft,
} from "./wizard";

const uuid = z.string().uuid();
const entries = (fd: FormData) => Object.fromEntries([...fd.entries()].filter(([, v]) => typeof v === "string")) as Record<string, string>;

async function auth() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return { supabase, user };
}

/** Enregistre une étape dans le brouillon (créé à la première étape) puis passe à la destination demandée. */
export async function saveSessionStep(_prev: FormState, formData: FormData): Promise<FormState> {
  const values = entries(formData);
  const step = formData.get("step")?.toString();
  const next = formData.get("next")?.toString();
  const idParsed = uuid.safeParse(formData.get("draftId"));
  const draftId = idParsed.success ? idParsed.data : undefined;
  if (step !== "1" && step !== "2" && step !== "3") return { error: "Étape inconnue.", values };
  if (step !== "1" && !draftId) return { error: "Brouillon introuvable.", values };

  const { supabase, user } = await auth();
  if (!user) return { error: "Session expirée. Reconnectez-vous.", values };

  let patch: SessionDraft;
  if (step === "1") {
    const p = sessionStep1Schema.safeParse({ ...values, objectives: formData.getAll("objective").map(String).filter((o) => o.trim()) });
    if (!p.success) return { fieldErrors: p.error.flatten().fieldErrors, values };
    const own = await supabase.from("courses").select("id").eq("id", p.data.courseId).eq("instructor_id", user.id).maybeSingle();
    if (!own.data) return { fieldErrors: { courseId: ["Formation introuvable"] }, values };
    patch = { ...p.data, capacity: String(p.data.capacity) };
  } else if (step === "2") {
    const dates = formData.getAll("extraDate").map(String);
    const starts = formData.getAll("extraStart").map(String);
    const ends = formData.getAll("extraEnd").map(String);
    const extras = values.planning === "multiple" ? dates.map((d, i) => ({ date: d, start: starts[i] ?? "", end: ends[i] ?? "" })) : [];
    const input = { ...values, extras, sendInvitation: values.sendInvitation === "1" ? "1" : "0", addToCalendar: values.addToCalendar === "1" ? "1" : "0" };
    const p = sessionStep2Schema.safeParse(input);
    if (!p.success) return { fieldErrors: p.error.flatten().fieldErrors, values };
    const overlap = findOverlap(occurrences({ ...p.data, extras }));
    if (overlap) return { fieldErrors: { extras: [`Les séances ${overlap[0]} et ${overlap[1]} se chevauchent`] }, values };
    patch = { ...p.data, extras };
  } else {
    const p = sessionStep3Schema.safeParse(values);
    if (!p.success) return { fieldErrors: p.error.flatten().fieldErrors, values };
    patch = p.data;
  }

  let id = draftId;
  if (id) {
    const cur = await supabase.from("session_drafts").select("data").eq("id", id).maybeSingle<{ data: SessionDraft }>();
    if (!cur.data) return { error: "Brouillon introuvable.", values };
    const { error } = await supabase.from("session_drafts").update({ data: { ...cur.data.data, ...patch } }).eq("id", id);
    if (error) return { error: "Impossible d’enregistrer cette étape. Réessayez.", values };
  } else {
    const { data, error } = await supabase.from("session_drafts").insert({ instructor_id: user.id, data: patch }).select("id").single<{ id: string }>();
    if (error || !data) return { error: "Impossible d’enregistrer cette étape. Réessayez.", values };
    id = data.id;
  }
  redirect(sessionWizardUrl(id, next, Number(step) + 1));
}

/** Crée la session à partir du brouillon : planifiée, ou enregistrée comme brouillon de session (bouton « draft »). */
export async function confirmSession(formData: FormData): Promise<void> {
  const id = uuid.safeParse(formData.get("draftId"));
  if (!id.success) redirect("/formateur/sessions");
  const asDraft = formData.get("draft") === "1";
  const { supabase } = await auth();
  const cur = await supabase.from("session_drafts").select("data").eq("id", id.data).maybeSingle<{ data: SessionDraft }>();
  if (!cur.data) redirect("/formateur/sessions");

  const fail = (message: string, step = 4) =>
    redirect(`/formateur/sessions/nouvelle/${id.data}?etape=${step}&erreur=${encodeURIComponent(message)}`);
  const missing = missingSteps(cur.data.data);
  if (missing.length > 0) fail("Complétez les informations obligatoires avant de continuer.", missing[0]);

  // Contrôle préalable des chevauchements (entre séances, puis avec les sessions existantes du formateur) : tout est créé ou rien.
  const data = cur.data.data;
  const slots = occurrences(data);
  const overlap = findOverlap(slots);
  if (overlap) fail(`Les séances ${overlap[0]} et ${overlap[1]} se chevauchent.`, 2);
  const { data: { user } } = await supabase.auth.getUser();
  const existing = await supabase.from("sessions").select("start_at, end_at").eq("instructor_id", user?.id ?? "").neq("status", "cancelled")
    .returns<{ start_at: string; end_at: string }[]>();
  for (const [i, s] of slots.entries()) {
    const a = localToUtc(s.start, data.timezone);
    const b = localToUtc(s.end, data.timezone);
    if (a && b && (existing.data ?? []).some((e) => e.start_at < b && a < e.end_at)) {
      fail(slots.length > 1 ? `Vous avez déjà une session sur le créneau de la séance ${i + 1}.` : "Vous avez déjà une session sur ce créneau horaire.", 2);
    }
  }

  for (const slot of slots) {
    const result = await persistSession(draftToFormData(data, { draft: asDraft, occurrence: slot }));
    if (result.error) fail(result.error);
    if (result.fieldErrors) {
      const [field, msgs] = Object.entries(result.fieldErrors)[0] ?? ["", [""]];
      fail(msgs?.[0] || "Vérifiez les informations de la session.", ["start", "end", "location", "meetingUrl", "timezone", "meetingPlatform", "welcomeMessage"].includes(field) ? 2 : ["registrationDeadline"].includes(field) ? 3 : 1);
    }
  }
  await supabase.from("session_drafts").delete().eq("id", id.data);
  revalidatePath("/formateur/sessions");
  redirect(`/formateur/sessions?resultat=${asDraft ? "brouillon" : slots.length > 1 ? "creees" : "creee"}`);
}

/** Abandonne l'assistant : supprime le brouillon puis revient à la liste. */
export async function discardSessionDraft(formData: FormData): Promise<void> {
  const id = uuid.safeParse(formData.get("draftId"));
  if (id.success) {
    const { supabase } = await auth();
    await supabase.from("session_drafts").delete().eq("id", id.data);
  }
  redirect("/formateur/sessions");
}
