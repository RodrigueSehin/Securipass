"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { safeRedirect } from "@/lib/auth/schemas";
import type { FormState } from "@/lib/auth/actions";
import { LEARNER_ERRORS } from "./messages";

const uuid = z.string().uuid();

/** Code d'erreur SQL reconnu dans le message (ex. « no_attempt_left »), sinon le repli fourni. */
const errorCode = (message: string, fallback: string) =>
  Object.keys(LEARNER_ERRORS).find((k) => message.includes(k)) ?? fallback;

/** Coche ou décoche une leçon terminée. */
export async function toggleContentCompleted(formData: FormData): Promise<void> {
  const back = safeRedirect(formData.get("returnTo")?.toString(), "/app/formations");
  const contentId = uuid.safeParse(formData.get("contentId"));
  if (!contentId.success) redirect(`${back}?erreur=contenu`);
  const done = formData.get("done") === "1";

  const supabase = await createClient();
  const { error } = await supabase.rpc("set_content_completed", { p_content: contentId.data, p_done: done });
  if (error) redirect(`${back}?erreur=contenu`);
  revalidatePath("/app", "layout");
  redirect(back);
}

export async function markAllNotificationsRead(): Promise<void> {
  const supabase = await createClient();
  await supabase.rpc("mark_notifications_read", { p_ids: null });
  revalidatePath("/app", "layout");
}

/** Démarre (ou reprend) une tentative d'évaluation. */
export async function startEvaluation(formData: FormData): Promise<void> {
  const evaluationId = uuid.safeParse(formData.get("evaluationId"));
  if (!evaluationId.success) redirect("/app/evaluations?erreur=evaluation_not_available");

  const supabase = await createClient();
  const { error } = await supabase.rpc("start_evaluation", { p_evaluation: evaluationId.data });
  if (error) redirect(`/app/evaluations/${evaluationId.data}?erreur=${errorCode(error.message, "evaluation_not_available")}`);
  revalidatePath("/app/evaluations", "layout");
  redirect(`/app/evaluations/${evaluationId.data}`);
}

/**
 * Envoie les réponses. Les champs sont nommés `q_<questionId>` et contiennent les identifiants d'options cochées.
 * La notation est faite en SQL : le navigateur ne voit jamais les bonnes réponses.
 */
export async function submitEvaluation(formData: FormData): Promise<void> {
  const attemptId = uuid.safeParse(formData.get("attemptId"));
  const evaluationId = uuid.safeParse(formData.get("evaluationId"));
  if (!attemptId.success || !evaluationId.success) redirect("/app/evaluations?erreur=attempt_not_found");

  const answers: Record<string, string[]> = {};
  for (const [key, value] of formData.entries()) {
    if (!key.startsWith("q_") || typeof value !== "string") continue;
    const questionId = key.slice(2);
    if (!uuid.safeParse(questionId).success) continue;
    (answers[questionId] ??= []).push(value.slice(0, 64));
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("submit_evaluation", { p_attempt: attemptId.data, p_answers: answers });
  const base = `/app/evaluations/${evaluationId.data}`;
  if (error) redirect(`${base}?erreur=${errorCode(error.message, "attempt_not_found")}`);
  revalidatePath("/app/evaluations", "layout");
  revalidatePath("/app", "layout");
  const status = (data as { status?: string } | null)?.status;
  redirect(`${base}?resultat=${status === "expired" ? "expiree" : "envoyee"}`);
}

const reviewSchema = z.object({
  courseId: z.string().uuid(),
  rating: z.coerce.number({ error: "Choisissez une note de 1 à 5" }).int().min(1, "Choisissez une note de 1 à 5").max(5, "Choisissez une note de 1 à 5"),
  comment: z.string().trim().max(1000, "1 000 caractères au maximum").optional().transform((v) => (v ? v : null)),
});

/** Enregistre (ou remplace) l’avis de l’apprenant sur une formation terminée. La règle « formation terminée » est appliquée en SQL (RLS). */
export async function submitReview(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = reviewSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { fieldErrors: parsed.error.flatten().fieldErrors };
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Session expirée. Reconnectez-vous." };
  const { error } = await supabase.from("course_reviews").upsert(
    { course_id: parsed.data.courseId, learner_id: user.id, rating: parsed.data.rating, comment: parsed.data.comment },
    { onConflict: "course_id,learner_id" },
  );
  if (error) return { error: "Votre avis n’a pas pu être enregistré. Terminez toutes les leçons de la formation, puis réessayez." };
  revalidatePath("/app/formations", "layout");
  return { message: "Merci, votre avis est enregistré." };
}
