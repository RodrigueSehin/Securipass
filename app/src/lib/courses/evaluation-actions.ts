"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import type { FormState } from "@/lib/auth/actions";
import { syncEvaluationTexts } from "./evaluation-sync";
import { fromScale } from "./grading";

const uuid = z.string().uuid();
const entries = (fd: FormData) => Object.fromEntries(fd) as Record<string, string>;
const stringValues = (fd: FormData) =>
  Object.fromEntries([...fd.entries()].filter(([, v]) => typeof v === "string")) as Record<string, string>;

async function auth() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return { supabase, user };
}

/** Adresse de l'étape 3 de l'assistant, avec l'activité ouverte et un éventuel message. */
function stepUrl(courseId: string, params: Record<string, string | undefined> = {}) {
  const p = new URLSearchParams({ etape: "3" });
  for (const [k, v] of Object.entries(params)) if (v) p.set(k, v);
  return `/formateur/formations/nouveau/${courseId}?${p.toString()}`;
}

const refresh = () => revalidatePath("/formateur/formations", "layout");

const KINDS = ["quiz", "assignment", "case_study", "practical"] as const;

const activitySchema = z.object({
  courseId: uuid,
  evaluationId: uuid.optional().or(z.literal("").transform(() => undefined)),
  title: z.string().trim().min(2, "Titre requis (2 caractères minimum)").max(200),
  kind: z.enum(KINDS, { error: "Type d’activité invalide" }),
  weightPercent: z.coerce.number("Pondération requise").int("Nombre entier").min(0, "Entre 0 et 100").max(100, "Entre 0 et 100"),
  minScore: z.coerce.number("Note minimale requise").min(0, "Note minimale invalide"),
  maxAttempts: z.coerce.number("Nombre de tentatives requis").int("Nombre entier").min(1, "Au moins 1").max(10, "10 au maximum"),
  timeLimitMinutes: z.union([z.literal("").transform(() => null), z.coerce.number().int("Nombre entier").min(1, "Au moins 1 minute").max(1440, "24 h au maximum")]).optional(),
  instructions: z.string().trim().max(4000).optional().transform((v) => (v ? v : null)),
});

/** Crée ou modifie une activité d'évaluation. La note minimale est saisie sur l'échelle de la formation puis stockée en pourcentage. */
export async function saveActivity(_prev: FormState, formData: FormData): Promise<FormState> {
  const values = stringValues(formData);
  const parsed = activitySchema.safeParse(entries(formData));
  if (!parsed.success) return { fieldErrors: parsed.error.flatten().fieldErrors, values };
  const { supabase, user } = await auth();
  if (!user) return { error: "Session expirée. Reconnectez-vous.", values };
  const d = parsed.data;

  const { data: course } = await supabase.from("courses").select("grading_scale").eq("id", d.courseId).maybeSingle<{ grading_scale: number }>();
  if (!course) return { error: "Formation introuvable.", values };
  if (d.minScore > course.grading_scale) return { fieldErrors: { minScore: [`La note minimale ne peut pas dépasser ${course.grading_scale}`] }, values };

  const row = {
    course_id: d.courseId, title: d.title, kind: d.kind, weight_percent: d.weightPercent,
    passing_score: fromScale(d.minScore, course.grading_scale), max_attempts: d.maxAttempts,
    time_limit_minutes: d.kind === "quiz" ? d.timeLimitMinutes ?? null : null, instructions: d.instructions,
  };

  if (d.evaluationId) {
    const { data, error } = await supabase.from("evaluations").update(row).eq("id", d.evaluationId).select("id").maybeSingle();
    if (error || !data) return { error: "Impossible de modifier l’activité.", values };
    await syncEvaluationTexts(supabase, d.courseId);
    refresh();
    return { message: "Activité enregistrée.", values };
  }
  const { data, error } = await supabase.from("evaluations").insert({ ...row, status: "draft" }).select("id").single();
  if (error || !data) return { error: "Impossible de créer l’activité.", values };
  await syncEvaluationTexts(supabase, d.courseId);
  refresh();
  redirect(stepUrl(d.courseId, { activite: data.id }));
}

const idPair = (fd: FormData) => ({ id: uuid.safeParse(fd.get("evaluationId")), courseId: uuid.safeParse(fd.get("courseId")) });

/** Active ou désactive une activité. Un quiz ne peut être activé que s'il a au moins une question avec sa bonne réponse. */
export async function setActivityStatus(formData: FormData): Promise<void> {
  const { id, courseId } = idPair(formData);
  if (!id.success || !courseId.success) redirect("/formateur/formations");
  const status = formData.get("status") === "published" ? "published" : "draft";
  const { supabase } = await auth();

  if (status === "published") {
    const { data: ev } = await supabase.from("evaluations").select("kind").eq("id", id.data).maybeSingle<{ kind: string }>();
    if (ev?.kind === "quiz") {
      const { data: questions } = await supabase.from("evaluation_questions").select("id, key:evaluation_answer_keys(question_id)").eq("evaluation_id", id.data)
        .returns<{ id: string; key: { question_id: string } | null }[]>();
      const ready = (questions ?? []).filter((q) => q.key);
      if (ready.length === 0) redirect(stepUrl(courseId.data, { activite: id.data, erreur: "Ajoutez au moins une question avec sa bonne réponse avant d’activer ce quiz." }));
    }
  }
  await supabase.from("evaluations").update({ status }).eq("id", id.data);
  await syncEvaluationTexts(supabase, courseId.data);
  refresh();
  redirect(stepUrl(courseId.data));
}

export async function deleteActivity(formData: FormData): Promise<void> {
  const { id, courseId } = idPair(formData);
  if (!id.success || !courseId.success) redirect("/formateur/formations");
  const { supabase } = await auth();
  await supabase.from("evaluations").delete().eq("id", id.data);
  await syncEvaluationTexts(supabase, courseId.data);
  refresh();
  redirect(stepUrl(courseId.data));
}

/** Copie une activité (et ses questions) en brouillon. */
export async function duplicateActivity(formData: FormData): Promise<void> {
  const { id, courseId } = idPair(formData);
  if (!id.success || !courseId.success) redirect("/formateur/formations");
  const { supabase } = await auth();
  const { data: src } = await supabase.from("evaluations")
    .select("course_id, title, kind, weight_percent, passing_score, max_attempts, time_limit_minutes, instructions")
    .eq("id", id.data).maybeSingle<Record<string, unknown> & { title: string }>();
  if (!src) redirect(stepUrl(courseId.data));
  const { data: copy } = await supabase.from("evaluations")
    .insert({ ...src, title: `${src.title.slice(0, 190)} (copie)`, status: "draft" }).select("id").single();
  if (copy) {
    const { data: questions } = await supabase.from("evaluation_questions").select("id, position, prompt, kind, options, points, key:evaluation_answer_keys(correct_option_ids)")
      .eq("evaluation_id", id.data).returns<{ id: string; position: number; prompt: string; kind: string; options: unknown; points: number; key: { correct_option_ids: string[] } | null }[]>();
    for (const q of questions ?? []) {
      const { data: nq } = await supabase.from("evaluation_questions")
        .insert({ evaluation_id: copy.id, position: q.position, prompt: q.prompt, kind: q.kind, options: q.options, points: q.points }).select("id").single();
      if (nq && q.key) await supabase.from("evaluation_answer_keys").insert({ question_id: nq.id, correct_option_ids: q.key.correct_option_ids });
    }
  }
  await syncEvaluationTexts(supabase, courseId.data);
  refresh();
  redirect(stepUrl(courseId.data, copy ? { activite: copy.id } : {}));
}

const OPTION_IDS = "abcdefghij";

const questionSchema = z.object({
  courseId: uuid,
  evaluationId: uuid,
  questionId: uuid.optional().or(z.literal("").transform(() => undefined)),
  prompt: z.string().trim().min(2, "Énoncé requis (2 caractères minimum)").max(1000, "1 000 caractères au maximum"),
  kind: z.enum(["single", "multiple"], { error: "Type de question invalide" }),
  points: z.coerce.number("Points requis").int("Nombre entier").min(1, "Au moins 1 point").max(100, "100 points au maximum"),
});

/** Ajoute ou modifie une question de quiz : énoncé, 2 à 10 propositions, bonnes réponses et points. */
export async function saveQuestion(_prev: FormState, formData: FormData): Promise<FormState> {
  const values = stringValues(formData);
  const parsed = questionSchema.safeParse(entries(formData));
  if (!parsed.success) return { fieldErrors: parsed.error.flatten().fieldErrors, values };
  const options = formData.getAll("option").map((o) => String(o).trim());
  const correctIdx = new Set(formData.getAll("correct").map((c) => Number(c)));
  // On garde l'ordre saisi en ignorant les propositions vides
  const kept = options.map((label, i) => ({ label, i })).filter((o) => o.label);
  if (kept.length < 2) return { error: "Saisissez au moins deux propositions.", values };
  if (kept.length > 10) return { error: "10 propositions au maximum.", values };
  const correct = kept.map((o, n) => (correctIdx.has(o.i) ? OPTION_IDS[n] : null)).filter((x): x is string => Boolean(x));
  if (correct.length === 0) return { error: "Cochez au moins une bonne réponse.", values };
  if (parsed.data.kind === "single" && correct.length > 1) return { error: "Une question à choix unique n’a qu’une bonne réponse.", values };

  const { supabase, user } = await auth();
  if (!user) return { error: "Session expirée. Reconnectez-vous.", values };
  const d = parsed.data;
  const json = kept.map((o, n) => ({ id: OPTION_IDS[n], label: o.label }));

  let questionId = d.questionId;
  if (questionId) {
    const { data, error } = await supabase.from("evaluation_questions")
      .update({ prompt: d.prompt, kind: d.kind, options: json, points: d.points }).eq("id", questionId).select("id").maybeSingle();
    if (error || !data) return { error: "Impossible de modifier la question.", values };
  } else {
    const { data: last } = await supabase.from("evaluation_questions").select("position").eq("evaluation_id", d.evaluationId).order("position", { ascending: false }).limit(1);
    const { data, error } = await supabase.from("evaluation_questions")
      .insert({ evaluation_id: d.evaluationId, position: (last?.[0]?.position ?? 0) + 1, prompt: d.prompt, kind: d.kind, options: json, points: d.points })
      .select("id").single();
    if (error || !data) return { error: "Impossible d’ajouter la question.", values };
    questionId = data.id;
  }
  const { error: keyError } = await supabase.from("evaluation_answer_keys").upsert({ question_id: questionId, correct_option_ids: correct }, { onConflict: "question_id" });
  if (keyError) return { error: "Les bonnes réponses n’ont pas pu être enregistrées.", values };
  refresh();
  return { message: d.questionId ? "Question enregistrée." : "Question ajoutée." };
}

export async function deleteQuestion(formData: FormData): Promise<void> {
  const id = uuid.safeParse(formData.get("questionId"));
  const evaluationId = uuid.safeParse(formData.get("evaluationId"));
  const courseId = uuid.safeParse(formData.get("courseId"));
  if (!id.success || !evaluationId.success || !courseId.success) redirect("/formateur/formations");
  const { supabase } = await auth();
  await supabase.from("evaluation_questions").delete().eq("id", id.data);
  refresh();
  redirect(stepUrl(courseId.data, { activite: evaluationId.data }));
}

/** Enregistre la note d'un apprenant pour une activité notée par le formateur (la note est saisie sur l'échelle de la formation). */
export async function saveGrade(formData: FormData): Promise<void> {
  const evaluationId = uuid.safeParse(formData.get("evaluationId"));
  const courseId = uuid.safeParse(formData.get("courseId"));
  const learnerId = uuid.safeParse(formData.get("learnerId"));
  if (!evaluationId.success || !courseId.success || !learnerId.success) redirect("/formateur/formations");
  const back = (extra: Record<string, string>) => stepUrl(courseId.data, { activite: evaluationId.data, ...extra });
  const raw = String(formData.get("score") ?? "").replace(",", ".").trim();
  const feedback = String(formData.get("feedback") ?? "").trim().slice(0, 1000);
  const { supabase } = await auth();
  const { data: course } = await supabase.from("courses").select("grading_scale").eq("id", courseId.data).maybeSingle<{ grading_scale: number }>();
  const score = Number(raw);
  if (!course || raw === "" || !Number.isFinite(score) || score < 0 || score > course.grading_scale) {
    redirect(back({ erreur: `La note doit être comprise entre 0 et ${course?.grading_scale ?? 20}.` }));
  }
  const { error } = await supabase.from("evaluation_grades").upsert(
    { evaluation_id: evaluationId.data, learner_id: learnerId.data, score_percent: fromScale(score, course.grading_scale), feedback: feedback || null },
    { onConflict: "evaluation_id,learner_id" },
  );
  refresh();
  redirect(back(error ? { erreur: "La note n’a pas pu être enregistrée." } : { note: "ok" }));
}
