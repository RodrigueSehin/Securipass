/** Calcul de progression d'un apprenant (pur : sans accès base, testé unitairement). */

export type ContentRow = { id: string; course_id: string; duration_minutes: number; counts_in_progress?: boolean };

export type CourseProgress = {
  courseId: string;
  total: number;
  done: number;
  percent: number;
  totalMinutes: number;
  doneMinutes: number;
};

export type ProgressStatus = "not_started" | "in_progress" | "completed";

export function courseProgress(contents: ContentRow[], doneIds: ReadonlySet<string>, courseId: string): CourseProgress {
  // Un contenu réglé « ne compte pas dans la progression » reste consultable mais n'entre pas dans le calcul.
  const own = contents.filter((c) => c.course_id === courseId && c.counts_in_progress !== false);
  const done = own.filter((c) => doneIds.has(c.id));
  const total = own.length;
  return {
    courseId,
    total,
    done: done.length,
    percent: total === 0 ? 0 : Math.round((done.length / total) * 100),
    totalMinutes: own.reduce((sum, c) => sum + c.duration_minutes, 0),
    doneMinutes: done.reduce((sum, c) => sum + c.duration_minutes, 0),
  };
}

/** Statut affiché : « terminée » seulement si toutes les leçons publiées sont faites (et qu'il y en a). */
export function progressStatus(p: Pick<CourseProgress, "total" | "done">): ProgressStatus {
  if (p.total > 0 && p.done >= p.total) return "completed";
  if (p.done > 0) return "in_progress";
  return "not_started";
}

/** Première leçon non terminée, pour reprendre là où l'apprenant s'est arrêté. */
export function nextContentId(
  contents: { id: string; course_id: string; module_position: number; position: number }[],
  doneIds: ReadonlySet<string>,
  courseId: string,
): string | null {
  const ordered = contents
    .filter((c) => c.course_id === courseId)
    .sort((a, b) => a.module_position - b.module_position || a.position - b.position);
  return ordered.find((c) => !doneIds.has(c.id))?.id ?? null;
}
