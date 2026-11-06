/** Notes et pondérations des activités d'évaluation (pur : sans accès base, testé unitairement). */

export type Rounding = "none" | "nearest" | "up" | "down";

export const ACTIVITY_KINDS = {
  quiz: "Quiz",
  assignment: "Devoir",
  case_study: "Étude de cas",
  practical: "Évaluation pratique",
} as const;
export type ActivityKind = keyof typeof ACTIVITY_KINDS;

/** Types d'évaluation proposés à la formation (cartes de l'étape 3), avec leur explication. */
export const EVALUATION_TYPES: Record<ActivityKind, { label: string; hint: string }> = {
  quiz: { label: "Quiz en ligne", hint: "Questions à choix unique ou multiple, corrigées automatiquement." },
  assignment: { label: "Devoirs / Travaux", hint: "Rapports, exercices pratiques : notés par le formateur." },
  case_study: { label: "Étude de cas", hint: "Analyse de situations réelles : notée par le formateur." },
  practical: { label: "Évaluation pratique", hint: "En présentiel ou sur le terrain : notée par le formateur." },
};

export const ROUNDING_LABELS: Record<Rounding, string> = {
  none: "Sans arrondi (2 décimales)",
  nearest: "Au nombre entier le plus proche",
  up: "Au nombre entier supérieur",
  down: "Au nombre entier inférieur",
};

export const GRADING_SCALES = [10, 20, 100] as const;

/** Convertit un pourcentage en note sur l'échelle de la formation, arrondie selon le réglage. */
export function toScale(percent: number, scale: number, rounding: Rounding = "none"): number {
  const raw = (percent * scale) / 100;
  switch (rounding) {
    case "up": return Math.ceil(raw - 1e-9);
    case "down": return Math.floor(raw + 1e-9);
    case "nearest": return Math.round(raw);
    default: return Math.round(raw * 100) / 100;
  }
}

/** Convertit une note saisie sur l'échelle en pourcentage (0 à 100, entier). */
export function fromScale(value: number, scale: number): number {
  if (!Number.isFinite(value) || scale <= 0) return 0;
  return Math.min(100, Math.max(0, Math.round((value * 100) / scale)));
}

/** « 12 / 20 » */
export function formatGrade(percent: number, scale: number, rounding: Rounding = "none"): string {
  return `${toScale(percent, scale, rounding).toLocaleString("fr-FR")} / ${scale}`;
}

export type WeightedActivity = { weight_percent: number; status: string };

/** Total des pondérations des activités actives (la somme attendue est 100 %). */
export function totalWeight(activities: WeightedActivity[]): number {
  return activities.filter((a) => a.status === "published").reduce((n, a) => n + a.weight_percent, 0);
}

/** Avertissement sur la pondération, ou null si elle est cohérente (aucune pondération, ou total de 100 %). */
export function weightWarning(activities: WeightedActivity[]): string | null {
  const total = totalWeight(activities);
  const weighted = activities.some((a) => a.status === "published" && a.weight_percent > 0);
  if (!weighted || total === 100) return null;
  return `La somme des pondérations des activités actives est de ${total} % : elle doit être de 100 %.`;
}
