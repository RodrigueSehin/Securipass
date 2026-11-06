"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import type { FormState } from "@/lib/auth/actions";
import { fromDatetimeLocal } from "@/lib/format";
import { attachmentLinkSchema, contentStep1Schema, contentStep2Schema, contentStep3Schema } from "./schemas";
import { contentWizardUrl } from "./wizard";

const uuid = z.string().uuid();
const entries = (fd: FormData) => Object.fromEntries(fd) as Record<string, string>;
const stringValues = (fd: FormData) =>
  Object.fromEntries([...fd.entries()].filter(([, v]) => typeof v === "string")) as Record<string, string>;

type Db = Awaited<ReturnType<typeof createClient>>;

async function auth() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return { supabase, user };
}

const refresh = () => {
  revalidatePath("/formateur/contenus", "layout");
  revalidatePath("/formateur/formations", "layout");
};

async function nextPosition(supabase: Db, moduleId: string): Promise<number> {
  const { data } = await supabase.from("learning_contents").select("position").eq("module_id", moduleId).order("position", { ascending: false }).limit(1);
  return (data?.[0]?.position ?? 0) + 1;
}

/** Place un contenu à une position donnée dans son module (positions renumérotées 1, 2, 3…). */
async function moveToPosition(supabase: Db, moduleId: string, contentId: string, position: number) {
  const { data } = await supabase.from("learning_contents").select("id").eq("module_id", moduleId).order("position").order("id");
  const order = (data ?? []).map((r) => r.id).filter((x) => x !== contentId);
  order.splice(Math.min(Math.max(position, 1), order.length + 1) - 1, 0, contentId);
  await Promise.all(order.map((id, i) => supabase.from("learning_contents").update({ position: i + 1 }).eq("id", id)));
}

/** Le module doit appartenir au formateur ; un quiz ou un prérequis doivent appartenir à la même formation. */
async function checkLinks(supabase: Db, input: { moduleId?: string; evaluationId?: string | null; prerequisiteContentId?: string | null; contentId?: string }) {
  let courseId: string | null = null;
  if (input.moduleId) {
    const { data } = await supabase.from("course_modules").select("course_id").eq("id", input.moduleId).maybeSingle<{ course_id: string }>();
    if (!data) return "Module introuvable.";
    courseId = data.course_id;
  } else if (input.contentId) {
    const { data } = await supabase.from("learning_contents").select("module:course_modules(course_id)").eq("id", input.contentId)
      .maybeSingle<{ module: { course_id: string } | null }>();
    courseId = data?.module?.course_id ?? null;
  }
  if (!courseId) return null;
  if (input.evaluationId) {
    const { data } = await supabase.from("evaluations").select("course_id, kind").eq("id", input.evaluationId).maybeSingle<{ course_id: string; kind: string }>();
    if (!data || data.course_id !== courseId || data.kind !== "quiz") return "Ce quiz n’appartient pas à la formation choisie.";
  }
  if (input.prerequisiteContentId) {
    if (input.prerequisiteContentId === input.contentId) return "Un contenu ne peut pas être son propre prérequis.";
    const { data } = await supabase.from("learning_contents").select("module:course_modules(course_id)").eq("id", input.prerequisiteContentId)
      .maybeSingle<{ module: { course_id: string } | null }>();
    if (!data || data.module?.course_id !== courseId) return "Le prérequis doit être un contenu de la même formation.";
  }
  return null;
}

/**
 * Enregistre une étape de l'assistant. Sans `contentId`, l'étape 1 crée le contenu en brouillon ; ensuite chaque étape le met à jour.
 * `next` : numéro de l'étape suivante, ou « list » pour revenir à la bibliothèque (enregistrement comme brouillon).
 */
export async function saveContentStep(_prev: FormState, formData: FormData): Promise<FormState> {
  const values = stringValues(formData);
  const step = formData.get("step")?.toString();
  const next = formData.get("next")?.toString();
  const idParsed = uuid.safeParse(formData.get("contentId"));
  const contentId = idParsed.success ? idParsed.data : undefined;
  if (step !== "1" && step !== "2" && step !== "3") return { error: "Étape inconnue.", values };
  if (step !== "1" && !contentId) return { error: "Contenu introuvable.", values };

  const { supabase, user } = await auth();
  if (!user) return { error: "Session expirée. Reconnectez-vous.", values };
  const input = entries(formData);

  let payload: Record<string, unknown> = {};
  let moduleChanged: { moduleId: string; position?: number } | null = null;
  let linkInput: Parameters<typeof checkLinks>[1] = { contentId };

  if (step === "1") {
    const p = contentStep1Schema.safeParse(input);
    if (!p.success) return { fieldErrors: p.error.flatten().fieldErrors, values };
    const d = p.data;
    linkInput = { moduleId: d.moduleId, evaluationId: d.evaluationId, contentId };
    payload = {
      module_id: d.moduleId, content_type: d.contentType, title: d.title, description: d.description,
      file_path: d.filePath, file_name: d.fileName, file_size_bytes: d.fileSize, file_mime: d.fileMime,
      external_url: d.externalUrl, evaluation_id: d.evaluationId, duration_minutes: d.durationMinutes,
      required_level: d.requiredLevel, is_required: d.isRequired, allow_download: d.allowDownload,
      counts_in_progress: d.countsInProgress, is_visible: d.isVisible, allow_comments: d.allowComments,
    };
    moduleChanged = { moduleId: d.moduleId };
  } else if (step === "2") {
    const p = contentStep2Schema.safeParse(input);
    if (!p.success) return { fieldErrors: p.error.flatten().fieldErrors, values };
    const d = p.data;
    linkInput = { evaluationId: d.evaluationId, contentId };
    payload = {
      body: d.body, file_path: d.filePath, file_name: d.fileName, file_size_bytes: d.fileSize, file_mime: d.fileMime,
      external_url: d.externalUrl, evaluation_id: d.evaluationId,
    };
  } else {
    const p = contentStep3Schema.safeParse(input);
    if (!p.success) return { fieldErrors: p.error.flatten().fieldErrors, values };
    const d = p.data;
    linkInput = { moduleId: d.moduleId, prerequisiteContentId: d.prerequisiteContentId, contentId };
    const date = (v: string | undefined) => (v === undefined ? undefined : v === "" ? null : fromDatetimeLocal(v));
    payload = {
      module_id: d.moduleId, duration_minutes: d.durationMinutes, required_level: d.requiredLevel,
      prerequisite_content_id: d.prerequisiteContentId, is_required: d.isRequired, publish_at: date(d.publishAt), available_until: date(d.availableUntil),
      is_visible: d.isVisible, allow_download: d.allowDownload, allow_comments: d.allowComments, show_in_outline: d.showInOutline,
      counts_in_progress: d.countsInProgress, notify_learners: d.notifyLearners,
    };
    moduleChanged = { moduleId: d.moduleId, position: d.position };
  }

  const linkProblem = await checkLinks(supabase, linkInput);
  if (linkProblem) return { error: linkProblem, values };

  let savedId = contentId;
  if (!contentId) {
    const moduleId = payload.module_id as string;
    const { data, error } = await supabase.from("learning_contents")
      .insert({ ...payload, position: await nextPosition(supabase, moduleId), status: "draft" }).select("id").single();
    if (error || !data) return { error: "Impossible de créer le contenu. Vérifiez vos droits sur cette formation.", values };
    savedId = data.id;
  } else {
    // Changement de module : le contenu passe en fin de liste du nouveau module, sauf position demandée
    const { data: before } = await supabase.from("learning_contents").select("module_id").eq("id", contentId).maybeSingle<{ module_id: string }>();
    if (moduleChanged && before && before.module_id !== moduleChanged.moduleId) payload.position = await nextPosition(supabase, moduleChanged.moduleId);
    const { data, error } = await supabase.from("learning_contents").update(payload).eq("id", contentId).select("id").maybeSingle();
    if (error || !data) return { error: "Impossible d’enregistrer ce contenu.", values };
    if (moduleChanged?.position) await moveToPosition(supabase, moduleChanged.moduleId, contentId, moduleChanged.position);
  }

  refresh();
  if (next && savedId) redirect(contentWizardUrl(savedId, next, Number(step) + 1));
  return { message: "Modifications enregistrées.", values };
}

const ATTACHMENT_ERROR = "La pièce n’a pas pu être enregistrée.";

/** Déclare un fichier déjà envoyé dans le stockage comme fichier complémentaire d'un contenu. */
export async function addContentFile(input: { contentId: string; name: string; filePath: string; sizeBytes: number; mimeType: string }): Promise<{ error?: string }> {
  const parsed = z.object({
    contentId: uuid, name: z.string().trim().min(1).max(200), filePath: z.string().min(3).max(500),
    sizeBytes: z.number().int().min(0).max(104_857_600), mimeType: z.string().max(150),
  }).safeParse(input);
  if (!parsed.success) return { error: "Fichier invalide." };
  const { supabase, user } = await auth();
  if (!user) return { error: "Session expirée. Reconnectez-vous." };
  // Le fichier doit se trouver dans le dossier du formateur (règle du stockage)
  if (!parsed.data.filePath.startsWith(`${user.id}/`) || parsed.data.filePath.includes("..")) return { error: "Fichier invalide." };
  const { error } = await supabase.from("content_attachments").insert({
    content_id: parsed.data.contentId, kind: "file", name: parsed.data.name, file_path: parsed.data.filePath,
    size_bytes: parsed.data.sizeBytes, mime_type: parsed.data.mimeType,
  });
  if (error) return { error: ATTACHMENT_ERROR };
  refresh();
  return {};
}

/** Ajoute un lien complémentaire (adresse https). */
export async function addContentLink(_prev: FormState, formData: FormData): Promise<FormState> {
  const contentId = uuid.safeParse(formData.get("contentId"));
  const parsed = attachmentLinkSchema.safeParse(entries(formData));
  if (!contentId.success) return { error: "Contenu introuvable." };
  if (!parsed.success) return { fieldErrors: parsed.error.flatten().fieldErrors, values: stringValues(formData) };
  const { supabase } = await auth();
  const name = parsed.data.name || new URL(parsed.data.url).hostname;
  const { error } = await supabase.from("content_attachments").insert({ content_id: contentId.data, kind: "link", name, url: parsed.data.url });
  if (error) return { error: ATTACHMENT_ERROR, values: stringValues(formData) };
  refresh();
  return { message: "Lien ajouté." };
}

export async function deleteContentAttachment(formData: FormData): Promise<void> {
  const id = uuid.safeParse(formData.get("attachmentId"));
  if (!id.success) return;
  const { supabase } = await auth();
  const { data } = await supabase.from("content_attachments").select("file_path").eq("id", id.data).maybeSingle<{ file_path: string | null }>();
  await supabase.from("content_attachments").delete().eq("id", id.data);
  if (data?.file_path) await supabase.storage.from("course-files").remove([data.file_path]);
  refresh();
}

const PUBLISH_ERRORS: Record<string, { step: number; message: string }> = {
  content_media_required: { step: 2, message: "Ajoutez le fichier principal ou un lien avant de publier ce contenu." },
  content_quiz_required: { step: 2, message: "Choisissez le quiz à associer avant de publier ce contenu." },
  content_text_required: { step: 2, message: "Renseignez l’énoncé (description ou contenu textuel) avant de publier ce contenu." },
};

/** Publie le contenu (dernière étape). La règle « de quoi afficher » est appliquée en base. */
export async function publishContent(formData: FormData): Promise<void> {
  const id = uuid.safeParse(formData.get("contentId"));
  if (!id.success) redirect("/formateur/contenus");
  const { supabase } = await auth();
  const { error } = await supabase.from("learning_contents").update({ status: "published" }).eq("id", id.data);
  if (error) {
    const known = Object.entries(PUBLISH_ERRORS).find(([code]) => error.message.includes(code))?.[1];
    redirect(`${contentWizardUrl(id.data, String(known?.step ?? 4))}&erreur=${encodeURIComponent(known?.message ?? "La publication a échoué. Réessayez.")}`);
  }
  refresh();
  redirect("/formateur/contenus?resultat=publie");
}
