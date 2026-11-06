import type { SupabaseClient } from "@supabase/supabase-js";
import { buildCertificateConditions, buildEvaluationModalities, type SummaryActivity, type SummarySettings } from "./evaluation-summary";

/**
 * Met à jour les textes affichés sur la fiche (modalités d'évaluation, conditions du certificat) à partir des réglages
 * de l'étape 3 et des activités : ils décrivent toujours les règles réellement appliquées.
 */
export async function syncEvaluationTexts(supabase: SupabaseClient, courseId: string): Promise<void> {
  const { data: course } = await supabase
    .from("courses")
    .select("evaluation_enabled, pass_mark_percent, grading_scale, grade_rounding, certificate_enabled")
    .eq("id", courseId)
    .maybeSingle<SummarySettings>();
  if (!course) return;
  const { data: activities } = await supabase
    .from("evaluations")
    .select("title, kind, weight_percent, passing_score, status")
    .eq("course_id", courseId)
    .order("created_at")
    .returns<SummaryActivity[]>();
  await supabase.from("courses").update({
    evaluation_modalities: buildEvaluationModalities(course, activities ?? []),
    certificate_conditions: buildCertificateConditions(course),
  }).eq("id", courseId);
}
