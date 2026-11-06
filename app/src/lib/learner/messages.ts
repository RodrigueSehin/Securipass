/** Messages affichés pour les codes d'erreur renvoyés par les fonctions SQL de l'espace apprenant. */
export const LEARNER_ERRORS: Record<string, string> = {
  content_not_available: "Cette leçon n’est pas disponible.",
  not_enrolled: "Vous devez être inscrit à cette formation.",
  evaluation_not_available: "Cette évaluation n’est pas accessible.",
  evaluation_closed: "L’échéance de cette évaluation est dépassée.",
  no_attempt_left: "Vous avez utilisé toutes vos tentatives.",
  attempt_already_submitted: "Cette tentative a déjà été envoyée.",
  attempt_not_found: "Tentative introuvable.",
  contenu: "La leçon n’a pas pu être enregistrée. Réessayez.",
};

export const learnerErrorMessage = (code?: string) => (code && LEARNER_ERRORS[code]) || "L’opération a échoué. Réessayez.";

/** Libellés et tons des statuts de progression affichés à l'apprenant. */
export const PROGRESS_LABEL = {
  not_started: { label: "Non commencée", tone: "neutral" },
  in_progress: { label: "En cours", tone: "info" },
  completed: { label: "Terminée", tone: "success" },
} as const;

export const ATTENDANCE_STATUS = {
  present: { label: "Présent", tone: "success" },
  absent: { label: "Absent", tone: "danger" },
  late: { label: "En retard", tone: "warning" },
  excused: { label: "Excusé", tone: "info" },
} as const;

type AttemptLike = { submitted_at: string | null; score_percent: number | null; passed: boolean | null };

/** Statut d'une évaluation pour l'apprenant, à partir de ses tentatives. */
export function evaluationStatus(attempts: AttemptLike[]): { label: string; tone: "neutral" | "info" | "success" | "danger" } {
  const graded = attempts.filter((a) => a.submitted_at !== null && a.score_percent !== null);
  if (attempts.some((a) => a.submitted_at === null)) return { label: "En cours", tone: "info" };
  if (graded.length === 0) return { label: "Non commencée", tone: "neutral" };
  const best = graded.reduce((m, a) => Math.max(m, a.score_percent ?? 0), 0);
  return graded.some((a) => a.passed)
    ? { label: `Réussie · meilleur score ${best} %`, tone: "success" }
    : { label: `Non réussie · meilleur score ${best} %`, tone: "danger" };
}
