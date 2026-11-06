"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { MAX_BODY_CHARS, attachmentProblem, messagingErrorMessage, safeFileName } from "./rules";

const uuid = z.string().uuid();
const BASE = "/app/messages";

function back(conversationId: string | null, extra: Record<string, string> = {}) {
  const p = new URLSearchParams(extra);
  if (conversationId) p.set("c", conversationId);
  const s = p.toString();
  return s ? `${BASE}?${s}` : BASE;
}

/** Ouvre (ou retrouve) la conversation avec le formateur d'une formation suivie. */
export async function startCourseConversation(formData: FormData): Promise<void> {
  const courseId = uuid.safeParse(formData.get("courseId"));
  if (!courseId.success) redirect(back(null, { erreur: "Formation introuvable." }));
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("open_course_conversation", { p_course: courseId.data });
  if (error) redirect(back(null, { erreur: messagingErrorMessage(error.message) }));
  redirect(back(data as string));
}

/** Ouvre (ou retrouve) la conversation avec l'équipe support. */
export async function startSupportConversation(): Promise<void> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("open_support_conversation");
  if (error) redirect(back(null, { erreur: messagingErrorMessage(error.message) }));
  redirect(back(data as string));
}

/**
 * Envoie un message, avec éventuellement un fichier. Le fichier est déposé dans le dossier de la conversation
 * (contrôlé par la RLS du stockage) puis rattaché au message par la fonction SQL ; s'il est refusé, il est supprimé.
 */
export async function sendMessage(formData: FormData): Promise<void> {
  const conversationId = uuid.safeParse(formData.get("conversationId"));
  if (!conversationId.success) redirect(back(null, { erreur: "Conversation introuvable." }));
  const id = conversationId.data;
  const body = String(formData.get("body") ?? "").trim();
  if (body.length > MAX_BODY_CHARS) redirect(back(id, { erreur: "Le message dépasse 4000 caractères." }));

  const file = formData.get("file");
  const hasFile = file instanceof File && file.size > 0;
  if (hasFile) {
    const problem = attachmentProblem({ size: file.size, type: file.type });
    if (problem) redirect(back(id, { erreur: problem }));
  }
  if (!body && !hasFile) redirect(back(id, { erreur: "Écrivez un message ou joignez un fichier." }));

  const supabase = await createClient();
  let path: string | null = null;
  if (hasFile) {
    const name = safeFileName(file.name);
    path = `${id}/${crypto.randomUUID()}/${name}`;
    const { error: uploadError } = await supabase.storage.from("message-files").upload(path, file, { contentType: file.type });
    if (uploadError) redirect(back(id, { erreur: "Le fichier n’a pas pu être envoyé. Réessayez." }));
  }

  const { error } = await supabase.rpc("send_message", {
    p_conversation: id,
    p_body: body,
    p_attachment_path: path,
    p_attachment_name: hasFile ? safeFileName(file.name) : null,
    p_attachment_size: hasFile ? file.size : null,
    p_attachment_mime: hasFile ? file.type : null,
  });
  if (error) {
    if (path) await supabase.storage.from("message-files").remove([path]);
    redirect(back(id, { erreur: messagingErrorMessage(error.message) }));
  }
  revalidatePath(BASE);
  redirect(back(id));
}

/** Archive ou désarchive une conversation (apprenant uniquement, contrôlé en SQL). */
export async function setConversationArchived(formData: FormData): Promise<void> {
  const conversationId = uuid.safeParse(formData.get("conversationId"));
  if (!conversationId.success) redirect(BASE);
  const archived = formData.get("archived") === "1";
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_conversation_archived", { p_conversation: conversationId.data, p_archived: archived });
  if (error) redirect(back(conversationId.data, { erreur: messagingErrorMessage(error.message) }));
  revalidatePath(BASE);
  redirect(back(archived ? null : conversationId.data, { resultat: archived ? "archivee" : "restauree" }));
}
