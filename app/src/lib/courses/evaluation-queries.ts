import { createClient } from "@/lib/supabase/server";
import type { ActivityKind } from "./grading";

export type Question = {
  id: string;
  position: number;
  prompt: string;
  kind: "single" | "multiple";
  options: { id: string; label: string }[];
  points: number;
  key: { correct_option_ids: string[] } | null;
};

export type Activity = {
  id: string;
  title: string;
  kind: ActivityKind;
  weight_percent: number;
  passing_score: number;
  max_attempts: number;
  time_limit_minutes: number | null;
  instructions: string | null;
  status: "draft" | "published" | "archived";
  questions: Question[];
};

/** Activités d'évaluation d'une formation (RLS : seul son formateur et le personnel y accèdent), avec leurs questions. */
export async function listActivities(courseId: string): Promise<Activity[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("evaluations")
    .select("id, title, kind, weight_percent, passing_score, max_attempts, time_limit_minutes, instructions, status, questions:evaluation_questions(id, position, prompt, kind, options, points, key:evaluation_answer_keys(correct_option_ids))")
    .eq("course_id", courseId)
    .neq("status", "archived")
    .order("created_at")
    .returns<Activity[]>();
  return (data ?? []).map((a) => ({ ...a, questions: [...(a.questions ?? [])].sort((x, y) => x.position - y.position) }));
}

export type GradeRow = { learnerId: string; name: string; email: string; scorePercent: number | null; feedback: string | null };

/** Apprenants inscrits à la formation et leur note pour une activité notée par le formateur. */
export async function listGradeRows(courseId: string, evaluationId: string): Promise<GradeRow[]> {
  const supabase = await createClient();
  const [enrollments, grades] = await Promise.all([
    supabase.from("enrollments")
      .select("learner_id, learner:profiles!enrollments_learner_id_fkey(full_name, email)")
      .eq("course_id", courseId).in("status", ["confirmed", "completed"])
      .returns<{ learner_id: string; learner: { full_name: string; email: string } | null }[]>(),
    supabase.from("evaluation_grades").select("learner_id, score_percent, feedback").eq("evaluation_id", evaluationId)
      .returns<{ learner_id: string; score_percent: number; feedback: string | null }[]>(),
  ]);
  const byLearner = new Map((grades.data ?? []).map((g) => [g.learner_id, g]));
  return (enrollments.data ?? [])
    .map((e) => ({
      learnerId: e.learner_id,
      name: e.learner?.full_name || e.learner?.email || "Apprenant",
      email: e.learner?.email ?? "",
      scorePercent: byLearner.get(e.learner_id)?.score_percent ?? null,
      feedback: byLearner.get(e.learner_id)?.feedback ?? null,
    }))
    .sort((a, b) => a.name.localeCompare(b.name, "fr"));
}
