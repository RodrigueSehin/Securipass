/** Règles de la liste « Mes formations » de l'apprenant (pures : sans accès base, testées unitairement). */

export type ListStatus = "in_progress" | "completed" | "waiting" | "abandoned";

/** Une formation commencée mais inachevée est « abandonnée » après ce délai sans aucune leçon terminée. */
export const ABANDON_AFTER_DAYS = 30;

export const LIST_STATUS_LABEL: Record<ListStatus, string> = {
  in_progress: "En cours",
  completed: "Terminée",
  waiting: "En attente",
  abandoned: "Abandonnée",
};

export function listStatus(input: {
  enrollmentStatus: string;
  total: number;
  done: number;
  /** Date de la dernière leçon terminée, null si aucune. */
  lastActivityAt: string | null;
  now: number;
}): ListStatus | null {
  const { enrollmentStatus, total, done, lastActivityAt, now } = input;
  if (["waitlisted", "pending_payment", "pending_approval"].includes(enrollmentStatus)) return "waiting";
  if (enrollmentStatus !== "confirmed" && enrollmentStatus !== "completed") return null;
  if (enrollmentStatus === "completed" || (total > 0 && done >= total)) return "completed";
  const idleDays = lastActivityAt ? (now - Date.parse(lastActivityAt)) / 86_400_000 : 0;
  return done > 0 && idleDays >= ABANDON_AFTER_DAYS ? "abandoned" : "in_progress";
}

export const LIST_TABS = [
  { key: "toutes", label: "Toutes" },
  { key: "en_cours", label: "En cours", status: "in_progress" },
  { key: "terminees", label: "Terminées", status: "completed" },
  { key: "en_attente", label: "En attente", status: "waiting" },
  { key: "abandonnees", label: "Abandonnées", status: "abandoned" },
] as const;
export type ListTab = (typeof LIST_TABS)[number]["key"];

export const isListTab = (value: string | undefined): value is ListTab => LIST_TABS.some((t) => t.key === value);

export function countByStatus(statuses: ListStatus[]): Record<ListTab, number> {
  const n = (s: ListStatus) => statuses.filter((x) => x === s).length;
  return { toutes: statuses.length, en_cours: n("in_progress"), terminees: n("completed"), en_attente: n("waiting"), abandonnees: n("abandoned") };
}

export function matchesTab(status: ListStatus, tab: ListTab): boolean {
  const t = LIST_TABS.find((x) => x.key === tab);
  return !t || !("status" in t) || t.status === status;
}

export type CompetencyLevel = "Débutant" | "Intermédiaire" | "Avancé";

/** Niveau déduit de la progression : moins de 50 % débutant, moins de 85 % intermédiaire, ensuite avancé. */
export function competencyLevel(percent: number): CompetencyLevel {
  return percent < 50 ? "Débutant" : percent < 85 ? "Intermédiaire" : "Avancé";
}

/**
 * Compétences visées par les formations suivies, avec la progression moyenne des formations qui les couvrent.
 * Triées de la plus avancée à la moins avancée.
 */
export function competencyProgress(courses: { competencies: string[]; percent: number }[], limit = 4) {
  const byName = new Map<string, number[]>();
  for (const c of courses) {
    for (const raw of c.competencies) {
      const name = raw.trim();
      if (name) byName.set(name, [...(byName.get(name) ?? []), c.percent]);
    }
  }
  return [...byName.entries()]
    .map(([name, values]) => {
      const percent = Math.round(values.reduce((a, b) => a + b, 0) / values.length);
      return { name, percent, level: competencyLevel(percent) };
    })
    .sort((a, b) => b.percent - a.percent || a.name.localeCompare(b.name, "fr"))
    .slice(0, limit);
}
