/** Classement des évaluations pour l'apprenant (pur : sans accès base, testé unitairement). */

export type EvalCategory = "upcoming" | "in_progress" | "finished";

export type EvalAttempt = {
  evaluation_id: string;
  submitted_at: string | null;
  deadline_at: string | null;
  score_percent: number | null;
  passed: boolean | null;
};

export type EvalSchedule = {
  available_at: string | null;
  due_at: string | null;
  max_attempts: number;
};

export type EvalState = {
  category: EvalCategory;
  /** La tentative en cours est encore valable. */
  inProgress: boolean;
  /** Une tentative a été réussie. */
  passed: boolean;
  /** Au moins une tentative envoyée et notée. */
  graded: boolean;
  /** Meilleur score envoyé, ou null. */
  bestScore: number | null;
  submitted: number;
  /** Disponible maintenant (ouverte, pas échue). */
  openNow: boolean;
};

const t = (iso: string | null) => (iso ? new Date(iso).getTime() : null);

export function evaluationState(ev: EvalSchedule, attempts: EvalAttempt[], now: number): EvalState {
  const submitted = attempts.filter((a) => a.submitted_at !== null);
  const scores = submitted.map((a) => a.score_percent).filter((s): s is number => s !== null);
  const passed = submitted.some((a) => a.passed === true);
  const expired = t(ev.due_at) !== null && (t(ev.due_at) as number) <= now;
  const noAttemptLeft = submitted.length >= ev.max_attempts;
  const openAttempt = attempts.find((a) => a.submitted_at === null);
  const inProgress = Boolean(openAttempt && (t(openAttempt.deadline_at) === null || (t(openAttempt.deadline_at) as number) > now) && !expired);
  const finished = !inProgress && (passed || noAttemptLeft || (expired && submitted.length > 0));
  const notOpenYet = t(ev.available_at) !== null && (t(ev.available_at) as number) > now;
  const category: EvalCategory = inProgress ? "in_progress" : finished ? "finished" : "upcoming";
  return {
    category,
    inProgress,
    passed,
    graded: submitted.length > 0,
    bestScore: scores.length ? Math.max(...scores) : null,
    submitted: submitted.length,
    openNow: !notOpenYet && !expired && category !== "finished",
  };
}

export type EvalStats = {
  passed: number;
  failed: number;
  inProgress: number;
  upcoming: number;
  /** Part des évaluations réussies parmi celles terminées par une note, ou null sans résultat. */
  successRate: number | null;
};

export function evaluationStats(items: { state: EvalState }[]): EvalStats {
  const finishedGraded = items.filter((i) => i.state.category === "finished" && i.state.graded);
  const passed = finishedGraded.filter((i) => i.state.passed).length;
  const failed = finishedGraded.length - passed;
  return {
    passed,
    failed,
    inProgress: items.filter((i) => i.state.category === "in_progress").length,
    upcoming: items.filter((i) => i.state.category === "upcoming").length,
    successRate: finishedGraded.length ? Math.round((passed / finishedGraded.length) * 100) : null,
  };
}
