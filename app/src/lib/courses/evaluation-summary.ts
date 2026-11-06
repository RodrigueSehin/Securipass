import { ACTIVITY_KINDS, formatGrade, type ActivityKind, type Rounding } from "./grading";

/**
 * Textes affichés sur la fiche de la formation (« modalités d'évaluation », « conditions d'obtention du certificat »),
 * déduits des réglages de l'étape 3 : ils décrivent exactement les règles appliquées.
 */

export type SummarySettings = {
  evaluation_enabled: boolean;
  pass_mark_percent: number;
  grading_scale: number;
  grade_rounding: Rounding;
  certificate_enabled: boolean;
};

export type SummaryActivity = { title: string; kind: ActivityKind; weight_percent: number; passing_score: number; status: string };

export function buildEvaluationModalities(s: SummarySettings, activities: SummaryActivity[]): string {
  if (!s.evaluation_enabled) return "Cette formation ne comporte pas d’évaluation notée.";
  const active = activities.filter((a) => a.status === "published");
  const lines = [`Évaluation notée sur ${s.grading_scale}. Note minimale de réussite : ${s.pass_mark_percent} %.`];
  for (const a of active) {
    const weight = a.weight_percent > 0 ? `pondération ${a.weight_percent} %, ` : "";
    lines.push(`- ${a.title} (${ACTIVITY_KINDS[a.kind].toLowerCase()}) : ${weight}note minimale ${formatGrade(a.passing_score, s.grading_scale, s.grade_rounding)}.`);
  }
  if (active.length === 0) lines.push("Les activités d’évaluation seront précisées avant le début de la formation.");
  return lines.join("\n");
}

export function buildCertificateConditions(s: SummarySettings): string | null {
  if (!s.certificate_enabled) return null;
  const mark = s.evaluation_enabled ? ` et obtenir une moyenne pondérée d’au moins ${s.pass_mark_percent} %` : "";
  return `Avoir terminé toutes les leçons, réussir chaque évaluation notée${mark}. Présence d’au moins 80 % lorsque la formation se déroule en session.`;
}
