"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { FormState } from "@/lib/auth/actions";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { createEvaluationSchema, questionSchema } from "./evaluations";

const MESSAGES: Record<string, string> = {
  evaluation_not_found: "Évaluation introuvable.",
  evaluation_no_questions: "Ajoutez au moins une question avant de publier ce QCM.",
  evaluation_has_results: "Cette évaluation a déjà des résultats : elle ne peut plus repasser en brouillon.",
};
const RESULTS = { published: "publiee", draft: "brouillon", archived: "archivee" } as const;

/** Publie, repasse en brouillon ou archive une évaluation ; `back` ramène à la liste d'où l'action est partie (adresse interne uniquement). */
export async function setEvaluationStatus(formData: FormData): Promise<void> {
  const id = z.string().uuid().safeParse(formData.get("evaluationId"));
  const status = z.enum(["draft", "published", "archived"]).safeParse(formData.get("status"));
  const raw = formData.get("back")?.toString() ?? "";
  const back = /^\/admin\/evaluations[^\s]*$/.test(raw) && !raw.includes("//") ? raw : "/admin/evaluations";
  if (!id.success || !status.success) redirect(back);
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_set_evaluation_status", { p_evaluation: id.data, p_status: status.data });
  revalidatePath("/admin/evaluations");
  const sep = back.includes("?") ? "&" : "?";
  const msg = MESSAGES[Object.keys(MESSAGES).find((k) => error?.message?.includes(k)) ?? ""] ?? "L’opération a échoué. Réessayez.";
  redirect(`${back}${sep}${error ? `erreur=${encodeURIComponent(msg)}` : `resultat=${RESULTS[status.data]}`}`);
}

async function adminContext() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Session expirée. Reconnectez-vous." } as const;
  const { data: isAdmin } = await supabase.rpc("has_role", { _role: "admin" });
  if (!isAdmin) return { error: "Seul un administrateur peut effectuer cette action." } as const;
  return { user, admin: createAdminClient() } as const;
}

/** Crée une évaluation (planifiée dans le fuseau de sa session) avec ses pièces jointes ; « Ajouter des questions » l'enregistre en brouillon puis ouvre l'éditeur. */
export async function createEvaluation(_prev: FormState, formData: FormData): Promise<FormState> {
  const values = Object.fromEntries([...formData.entries()].filter(([, v]) => typeof v === "string" && v.length < 2000)) as Record<string, string>;
  const ctx = await adminContext();
  if ("error" in ctx) return { error: ctx.error, values };
  const { user, admin } = ctx;

  let files: unknown[] = [];
  try { files = formData.getAll("file").map((v) => JSON.parse(String(v))); } catch { return { error: "Pièce jointe invalide.", values }; }
  const parsed = createEvaluationSchema.safeParse({ ...Object.fromEntries(formData), files });
  if (!parsed.success) return { fieldErrors: parsed.error.flatten().fieldErrors, values };
  const d = parsed.data;
  if (d.files.some((f) => !f.path.startsWith(`${user.id}/`) || f.path.includes(".."))) return { fieldErrors: { files: ["Pièce jointe invalide"] }, values };
  if (d.status === "published" && d.kind === "quiz" && d.intent === "save") {
    return { fieldErrors: { status: ["Un QCM publié a besoin de questions : enregistrez-le en brouillon, ajoutez les questions, puis publiez-le depuis la liste."] }, values };
  }

  const { data: session } = await admin.from("sessions").select("id, course_id, status").eq("id", d.sessionId).maybeSingle<{ id: string; course_id: string; status: string }>();
  if (!session || session.course_id !== d.courseId || session.status === "draft") return { fieldErrors: { sessionId: ["Session introuvable pour cette formation"] }, values };
  const { data: course } = await admin.from("courses").select("id").eq("id", d.courseId).eq("status", "published").maybeSingle();
  if (!course) return { fieldErrors: { courseId: ["Formation introuvable ou non publiée"] }, values };

  const status = d.intent === "questions" && d.kind === "quiz" ? "draft" : d.status;
  const { data: created, error } = await admin.from("evaluations").insert({
    course_id: d.courseId, session_id: d.sessionId, title: d.title, instructions: d.description, kind: d.kind,
    time_limit_minutes: d.duration, max_attempts: d.attempts, passing_score: d.passingScore, available_at: d.availableAt, due_at: d.dueAt,
    planned_questions: d.plannedQuestions, shuffle_questions: d.shuffleQuestions, shuffle_answers: d.shuffleAnswers,
    show_result_immediately: d.showResult, grading_mode: d.gradingMode, status,
  }).select("id").single<{ id: string }>();
  if (error || !created) return { error: "Impossible d’enregistrer l’évaluation. Vérifiez les informations.", values };

  if (d.files.length) await admin.from("evaluation_files").insert(d.files.map((f) => ({ evaluation_id: created.id, storage_path: f.path, file_name: f.name, size_bytes: f.size })));
  await admin.from("audit_logs").insert({ actor_id: user.id, action: "evaluation.create", entity_type: "evaluation", entity_id: created.id, metadata: { kind: d.kind, status } });
  revalidatePath("/admin/evaluations");
  if (d.intent === "questions" && d.kind === "quiz") redirect(`/admin/evaluations/${created.id}/questions`);
  redirect(`/admin/evaluations?resultat=${status === "published" ? "creee" : "brouillon-cree"}`);
}

/** Ajoute une question (avec sa clé de réponse) à un QCM qui n'a pas encore de résultats. */
export async function addQuestion(_prev: FormState, formData: FormData): Promise<FormState> {
  const values = Object.fromEntries([...formData.entries()].filter(([, v]) => typeof v === "string" && v.length < 2000)) as Record<string, string>;
  const ctx = await adminContext();
  if ("error" in ctx) return { error: ctx.error, values };
  const { user, admin } = ctx;

  const parsed = questionSchema.safeParse({ ...Object.fromEntries(formData), options: formData.getAll("option").map(String), correct: formData.getAll("correct").map(String) });
  if (!parsed.success) return { fieldErrors: parsed.error.flatten().fieldErrors, values };
  const d = parsed.data;

  const { data: ev } = await admin.from("evaluations").select("id, kind, planned_questions").eq("id", d.evaluationId).maybeSingle<{ id: string; kind: string; planned_questions: number | null }>();
  if (!ev || ev.kind !== "quiz") return { error: "Évaluation introuvable ou sans questions.", values };
  const { count: attempts } = await admin.from("evaluation_attempts").select("id", { count: "exact", head: true }).eq("evaluation_id", ev.id);
  if ((attempts ?? 0) > 0) return { error: "Des apprenants ont déjà passé cette évaluation : on ne peut plus la modifier.", values };
  const { count } = await admin.from("evaluation_questions").select("id", { count: "exact", head: true }).eq("evaluation_id", ev.id);
  if (ev.planned_questions && (count ?? 0) >= ev.planned_questions) return { error: `Le nombre de questions prévu (${ev.planned_questions}) est atteint.`, values };

  const { data: q, error } = await admin.from("evaluation_questions").insert({
    evaluation_id: ev.id, position: (count ?? 0) + 1, prompt: d.prompt, kind: d.kind, options: d.options, points: d.points,
    category: d.category, difficulty: d.difficulty, explanation: d.explanation,
  }).select("id").single<{ id: string }>();
  if (error || !q) return { error: "Impossible d’enregistrer la question.", values };
  const { error: keyError } = await admin.from("evaluation_answer_keys").insert({ question_id: q.id, correct_option_ids: d.correctIds });
  if (keyError) {
    await admin.from("evaluation_questions").delete().eq("id", q.id);
    return { error: "Impossible d’enregistrer la bonne réponse.", values };
  }
  await admin.from("audit_logs").insert({ actor_id: user.id, action: "evaluation.question_add", entity_type: "evaluation", entity_id: ev.id, metadata: { question: q.id } });
  revalidatePath(`/admin/evaluations/${ev.id}/questions`);
  if (formData.get("another") !== "1") redirect("/admin/evaluations?resultat=questions");
  return { message: "Question enregistrée.", values: { saved: String(Date.now()) } };
}

/** Supprime une question d'un QCM sans résultats et renumérote les suivantes. */
export async function deleteQuestion(formData: FormData): Promise<void> {
  const evaluationId = z.string().uuid().safeParse(formData.get("evaluationId"));
  const questionId = z.string().uuid().safeParse(formData.get("questionId"));
  if (!evaluationId.success || !questionId.success) redirect("/admin/evaluations");
  const ctx = await adminContext();
  if ("error" in ctx) redirect("/admin/evaluations");
  const { user, admin } = ctx;
  const back = `/admin/evaluations/${evaluationId.data}/questions`;
  const { count: attempts } = await admin.from("evaluation_attempts").select("id", { count: "exact", head: true }).eq("evaluation_id", evaluationId.data);
  if ((attempts ?? 0) > 0) redirect(`${back}?erreur=${encodeURIComponent("Des apprenants ont déjà passé cette évaluation : on ne peut plus la modifier.")}`);
  await admin.from("evaluation_questions").delete().eq("id", questionId.data).eq("evaluation_id", evaluationId.data);
  const { data: rest } = await admin.from("evaluation_questions").select("id").eq("evaluation_id", evaluationId.data).order("position").returns<{ id: string }[]>();
  for (const [i, r] of (rest ?? []).entries()) await admin.from("evaluation_questions").update({ position: i + 1 }).eq("id", r.id);
  await admin.from("audit_logs").insert({ actor_id: user.id, action: "evaluation.question_delete", entity_type: "evaluation", entity_id: evaluationId.data, metadata: { question: questionId.data } });
  revalidatePath(back);
  redirect(back);
}
