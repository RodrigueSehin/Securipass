/** Évaluation des apprenants d'une session par le formateur (pur : sans accès base, testé unitairement). */
import { z } from "zod";

export type AssessmentStatus = "evaluated" | "in_progress" | "not_evaluated";

export const ASSESSMENT_STATUS: Record<AssessmentStatus, { label: string; tone: string }> = {
  evaluated: { label: "Évalué", tone: "bg-success/15 text-success" },
  in_progress: { label: "En cours", tone: "bg-brand-soft text-brand" },
  not_evaluated: { label: "Non évalué", tone: "bg-danger/10 text-danger" },
};

export const ASSESSMENT_SIZES = [8, 16, 32] as const;
export const ASSESSMENT_TABS = { evaluation: "Évaluation", commentaires: "Commentaires", historique: "Historique" } as const;
export type AssessmentTab = keyof typeof ASSESSMENT_TABS;
export const COMMENT_MAX = 500;

/** Évalué dès que le formateur a enregistré la note finale ; en cours dès qu'une activité a été passée ou notée. */
export function assessmentStatus(assessed: boolean, hasActivity: boolean): AssessmentStatus {
  return assessed ? "evaluated" : hasActivity ? "in_progress" : "not_evaluated";
}

export function percentOf(count: number, total: number): number {
  return total > 0 ? Math.round((count * 100) / total) : 0;
}

export type AssessmentCounts = { total: number; evaluated: number; inProgress: number; notEvaluated: number };

export function assessmentCounts(statuses: AssessmentStatus[]): AssessmentCounts {
  const n = (s: AssessmentStatus) => statuses.filter((x) => x === s).length;
  return { total: statuses.length, evaluated: n("evaluated"), inProgress: n("in_progress"), notEvaluated: n("not_evaluated") };
}

/** Points obtenus à une question : tout ou rien, comme la correction automatique (l'ensemble coché doit être exactement l'attendu). */
export function questionResult(points: number, correct: string[], chosen: string[] | undefined): { earned: number; right: boolean } {
  const a = [...(chosen ?? [])].sort().join("|");
  const b = [...correct].sort().join("|");
  const right = correct.length > 0 && a === b;
  return { earned: right ? points : 0, right };
}

export type AssessmentFilters = { q: string; status: AssessmentStatus | ""; page: number; size: number; tab: AssessmentTab };

type Raw = Record<string, string | undefined>;

export function parseAssessmentFilters(sp: Raw): AssessmentFilters {
  const size = Number(sp.par);
  const page = Number.parseInt(sp.page ?? "", 10);
  return {
    q: sp.q?.trim().slice(0, 100) ?? "",
    status: sp.statut && sp.statut in ASSESSMENT_STATUS ? (sp.statut as AssessmentStatus) : "",
    page: Number.isFinite(page) && page > 0 ? page : 1,
    size: (ASSESSMENT_SIZES as readonly number[]).includes(size) ? size : ASSESSMENT_SIZES[0],
    tab: sp.onglet && sp.onglet in ASSESSMENT_TABS ? (sp.onglet as AssessmentTab) : "evaluation",
  };
}

export type RosterRow = { learnerId: string; name: string; email: string; avatar: string | null; status: AssessmentStatus; scorePercent: number | null; passed: boolean | null };

export function filterRoster(rows: RosterRow[], f: Pick<AssessmentFilters, "q" | "status">): RosterRow[] {
  const q = f.q.toLocaleLowerCase("fr");
  return rows.filter((r) => (!f.status || r.status === f.status) && (!q || r.name.toLocaleLowerCase("fr").includes(q) || r.email.toLocaleLowerCase("fr").includes(q)));
}

export const saveAssessmentSchema = z.object({
  sessionId: z.string().uuid("Session invalide"),
  learnerId: z.string().uuid("Apprenant invalide"),
  score: z.string().trim().min(1, "Note requise").transform((v) => Number(v.replace(",", "."))).pipe(z.number("Note invalide").min(0, "Note invalide")),
  result: z.enum(["passed", "failed"], { error: "Résultat requis" }),
  comment: z.string().trim().max(COMMENT_MAX, `${COMMENT_MAX} caractères au maximum`).optional().transform((v) => (v ? v : null)),
});
