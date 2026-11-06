"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import type { FormState } from "@/lib/auth/actions";

const uuid = z.string().uuid();

const MESSAGES: Record<string, string> = {
  not_authenticated: "Connectez-vous pour participer au forum.",
  forum_disabled: "Le forum de cette formation est désactivé.",
  forbidden: "Seuls les inscrits à la formation peuvent participer au forum.",
  discussions_disabled: "Les discussions entre apprenants ne sont pas autorisées : seul le formateur peut répondre aux questions des autres participants.",
  invalid_post: "Le titre (3 caractères minimum) et le message (4 000 caractères au maximum) sont requis.",
  thread_not_found: "Cette question n’existe plus.",
};
const errorMessage = (message: string) => MESSAGES[Object.keys(MESSAGES).find((k) => message.includes(k)) ?? ""] ?? "L’opération a échoué. Réessayez.";

export async function askQuestion(_prev: FormState, formData: FormData): Promise<FormState> {
  const courseId = uuid.safeParse(formData.get("courseId"));
  const title = String(formData.get("title") ?? "");
  const body = String(formData.get("body") ?? "");
  if (!courseId.success) return { error: "Formation introuvable." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("create_forum_thread", { p_course: courseId.data, p_title: title, p_body: body });
  if (error) return { error: errorMessage(error.message), values: { title, body } };
  revalidatePath(`/app/forum/${courseId.data}`);
  return { message: "Votre question est publiée." };
}

export async function replyToThread(_prev: FormState, formData: FormData): Promise<FormState> {
  const threadId = uuid.safeParse(formData.get("threadId"));
  const courseId = uuid.safeParse(formData.get("courseId"));
  const body = String(formData.get("body") ?? "");
  if (!threadId.success || !courseId.success) return { error: "Question introuvable." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("reply_forum_thread", { p_thread: threadId.data, p_body: body });
  if (error) return { error: errorMessage(error.message), values: { body } };
  revalidatePath(`/app/forum/${courseId.data}`);
  return { message: "Réponse publiée." };
}

/** Modération : le formateur de la formation et le personnel suppriment une question (et ses réponses) ou une réponse (RLS). */
export async function deleteForumItem(formData: FormData): Promise<void> {
  const courseId = uuid.safeParse(formData.get("courseId"));
  const kind = formData.get("kind") === "post" ? "forum_posts" : "forum_threads";
  const id = uuid.safeParse(formData.get("id"));
  if (!courseId.success || !id.success) return;
  const supabase = await createClient();
  await supabase.from(kind).delete().eq("id", id.data);
  revalidatePath(`/app/forum/${courseId.data}`);
}
