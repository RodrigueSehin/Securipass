import { z } from "zod";
import { localToUtc } from "@/lib/sessions/timezones";

/** Gestion des évaluations par l'administration : filtres, libellés et types (pur : testé unitairement). */

export const EVALUATION_STATUSES = ["draft", "planned", "in_progress", "completed"] as const;
export type EvaluationStatus = (typeof EVALUATION_STATUSES)[number];

export const EVALUATION_STATUS_UI: Record<EvaluationStatus, { label: string; tone: string }> = {
  draft: { label: "Brouillon", tone: "bg-line text-brand-dark" },
  planned: { label: "Planifiée", tone: "bg-brand-soft text-brand" },
  in_progress: { label: "En cours", tone: "bg-warning/15 text-warning" },
  completed: { label: "Terminée", tone: "bg-success/15 text-success" },
};

export const EVALUATION_KINDS: Record<string, { label: string; tone: string }> = {
  quiz: { label: "QCM", tone: "bg-[#ede9fe] text-[#6d28d9]" },
  assignment: { label: "Devoir", tone: "bg-brand-soft text-brand" },
  case_study: { label: "Étude de cas", tone: "bg-success/15 text-success" },
  practical: { label: "Pratique", tone: "bg-warning/15 text-warning" },
};

export type EvaluationFilters = { q: string; course: string; session: string; status: string; from: string; to: string; asc: boolean };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DAY = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;

/** Valeurs de filtre acceptées : tout le reste est ignoré ; une période inversée est remise dans l'ordre. */
export function parseEvaluationFilters(sp: { q?: string; formation?: string; session?: string; statut?: string; du?: string; au?: string; tri?: string }): EvaluationFilters {
  let from = sp.du && DAY.test(sp.du) ? sp.du : "";
  let to = sp.au && DAY.test(sp.au) ? sp.au : "";
  if (from && to && from > to) [from, to] = [to, from];
  return {
    q: sp.q?.trim().slice(0, 100) ?? "",
    course: sp.formation && UUID.test(sp.formation) ? sp.formation : "",
    session: sp.session && UUID.test(sp.session) ? sp.session : "",
    status: (EVALUATION_STATUSES as readonly string[]).includes(sp.statut ?? "") ? sp.statut! : "",
    from, to, asc: sp.tri === "asc",
  };
}

export type EvaluationRow = {
  id: string; title: string; kind: string; raw_status: string; display_status: EvaluationStatus; available_at: string | null; due_at: string | null; passing_score: number;
  questions: number; course_id: string; course_title: string; session_title: string | null; timezone: string;
  participants: number; results: number; passed: number;
};

type Block = { count: number; month?: number; prev?: number };
export type EvaluationStats = {
  total: Block; planned: Block; in_progress: Block; completed: Block;
  failed: { count: number; results: number }; success: { passed: number; results: number };
};

/** Pourcentage avec une décimale, virgule française (« 91,7 % »). */
export function formatPercent(part: number, total: number): string {
  if (total <= 0) return "—";
  return `${(Math.round((part / total) * 1000) / 10).toLocaleString("fr-FR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} %`;
}

/** Date de référence d'une évaluation dans la liste : ouverture, sinon échéance. */
export const evaluationDate = (e: Pick<EvaluationRow, "available_at" | "due_at">) => e.available_at ?? e.due_at;

export const CREATABLE_KINDS = { quiz: "QCM (choix multiples)", assignment: "Devoir", case_study: "Étude de cas", practical: "Pratique" } as const;
export const GRADING_MODES = { points100: "Sur 100 points", points20: "Sur 20 points", pass_fail: "Admis / Non admis" } as const;
export const QUESTION_TYPES = { single: "Choix unique (QCM)", multiple: "Choix multiple", true_false: "Vrai / Faux" } as const;
export const DIFFICULTIES = { easy: "Facile", medium: "Moyenne", hard: "Difficile" } as const;
export const DESCRIPTION_MAX = 500;
export const PROMPT_MAX = 500;
export const EXPLANATION_MAX = 300;
export const FILE_MAX_MB = 10;
export const FILE_TYPES = [
  "application/pdf", "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-powerpoint", "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/vnd.ms-excel", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "image/jpeg", "image/png",
] as const;

const day = (msg: string) => z.string().trim().regex(/^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/, msg);
const time = (msg: string) => z.string().trim().regex(/^([01]\d|2[0-3]):[0-5]\d$/, msg);
const int = (msg: string, min: number, max: number) => z.string().trim().min(1, msg).transform(Number).pipe(z.number({ error: msg }).int(msg).min(min, `${min} au minimum`).max(max, `${max} au maximum`));

/** Création d'une évaluation : informations, paramètres, planification (heure de la session), notation et publication. */
export const createEvaluationSchema = z.object({
  title: z.string().trim().min(2, "Titre requis (2 caractères au minimum)").max(200, "200 caractères au maximum"),
  courseId: z.string().uuid("Formation requise"),
  kind: z.enum(Object.keys(CREATABLE_KINDS) as [keyof typeof CREATABLE_KINDS, ...(keyof typeof CREATABLE_KINDS)[]], { error: "Type requis" }),
  sessionId: z.string().uuid("Session requise"),
  description: z.string().trim().max(DESCRIPTION_MAX, `${DESCRIPTION_MAX} caractères au maximum`).optional().transform((v) => v || null),
  plannedQuestions: z.string().trim().optional().transform((v) => v ?? ""),
  duration: int("Durée requise", 1, 600),
  passingScore: int("Note de réussite requise", 0, 100),
  attempts: int("Nombre de tentatives requis", 1, 10),
  shuffleQuestions: z.enum(["0", "1"]).optional().transform((v) => v === "1"),
  shuffleAnswers: z.enum(["0", "1"]).optional().transform((v) => v === "1"),
  showResult: z.enum(["0", "1"]).optional().transform((v) => v === "1"),
  startDate: day("Date de début requise"), startTime: time("Heure de début requise"),
  endDate: day("Date de fin requise"), endTime: time("Heure de fin requise"),
  timezone: z.string().trim().optional().transform((v) => v || "Africa/Abidjan"),
  gradingMode: z.enum(Object.keys(GRADING_MODES) as [keyof typeof GRADING_MODES, ...(keyof typeof GRADING_MODES)[]], { error: "Mode de notation requis" }),
  status: z.enum(["published", "draft"], { error: "Statut requis" }),
  intent: z.enum(["save", "questions"]).optional().transform((v) => v ?? "save"),
  files: z.array(z.object({ path: z.string().max(300), name: z.string().max(200), size: z.number().int().positive().max(FILE_MAX_MB * 1024 * 1024) })).max(10, "10 fichiers au maximum"),
}).superRefine((d, ctx) => {
  if (d.kind === "quiz") {
    const n = Number(d.plannedQuestions);
    if (!d.plannedQuestions || !Number.isInteger(n) || n < 1 || n > 500) ctx.addIssue({ code: "custom", path: ["plannedQuestions"], message: "Nombre de questions requis (1 à 500)" });
  }
  const start = localToUtc(`${d.startDate}T${d.startTime}`, d.timezone);
  const end = localToUtc(`${d.endDate}T${d.endTime}`, d.timezone);
  if (!start) ctx.addIssue({ code: "custom", path: ["startDate"], message: "Date de début invalide" });
  if (start && end && end <= start) ctx.addIssue({ code: "custom", path: ["endDate"], message: "La fin doit être après le début" });
}).transform((d) => ({
  ...d,
  plannedQuestions: d.kind === "quiz" ? Number(d.plannedQuestions) : null,
  availableAt: localToUtc(`${d.startDate}T${d.startTime}`, d.timezone)!,
  dueAt: localToUtc(`${d.endDate}T${d.endTime}`, d.timezone)!,
}));

/** Ajout d'une question : énoncé, type, points, options et bonne(s) réponse(s) (indices), paramètres facultatifs. */
export const questionSchema = z.object({
  evaluationId: z.string().uuid("Évaluation requise"),
  prompt: z.string().trim().min(2, "Question requise (2 caractères au minimum)").max(PROMPT_MAX, `${PROMPT_MAX} caractères au maximum`),
  type: z.enum(Object.keys(QUESTION_TYPES) as [keyof typeof QUESTION_TYPES, ...(keyof typeof QUESTION_TYPES)[]], { error: "Type requis" }),
  points: int("Points requis", 1, 100),
  options: z.array(z.string().trim().max(300, "300 caractères au maximum")),
  correct: z.array(z.coerce.number().int().min(0)),
  category: z.string().trim().max(80).optional().transform((v) => v || null),
  difficulty: z.enum(["", ...Object.keys(DIFFICULTIES)]).optional().transform((v) => v || null),
  explanation: z.string().trim().max(EXPLANATION_MAX, `${EXPLANATION_MAX} caractères au maximum`).optional().transform((v) => v || null),
}).superRefine((d, ctx) => {
  if (d.type === "true_false") {
    if (d.correct.length !== 1 || d.correct[0] > 1) ctx.addIssue({ code: "custom", path: ["options"], message: "Indiquez si l’affirmation est vraie ou fausse" });
    return;
  }
  const filled = d.options.filter(Boolean);
  if (filled.length !== d.options.length) ctx.addIssue({ code: "custom", path: ["options"], message: "Renseignez ou supprimez les options vides" });
  else if (d.options.length < 2) ctx.addIssue({ code: "custom", path: ["options"], message: "Au moins 2 options" });
  else if (d.options.length > 10) ctx.addIssue({ code: "custom", path: ["options"], message: "10 options au maximum" });
  else if (new Set(d.options.map((o) => o.toLowerCase())).size !== d.options.length) ctx.addIssue({ code: "custom", path: ["options"], message: "Les options doivent être différentes" });
  else if (d.correct.some((i) => i >= d.options.length)) ctx.addIssue({ code: "custom", path: ["options"], message: "Bonne réponse invalide" });
  else if (d.type === "single" && d.correct.length !== 1) ctx.addIssue({ code: "custom", path: ["options"], message: "Choisissez la bonne réponse" });
  else if (d.type === "multiple" && (d.correct.length < 1 || d.correct.length >= d.options.length)) ctx.addIssue({ code: "custom", path: ["options"], message: "Choisissez au moins une bonne réponse, mais pas toutes les options" });
}).transform((d) => {
  const labels = d.type === "true_false" ? ["Vrai", "Faux"] : d.options;
  const ids = labels.map((_, i) => String.fromCharCode(97 + i));
  return {
    ...d, kind: d.type === "multiple" ? ("multiple" as const) : ("single" as const),
    options: labels.map((label, i) => ({ id: ids[i], label })), correctIds: [...new Set(d.correct)].sort().map((i) => ids[i]),
  };
});

/** Avancement du questionnaire : questions et points saisis par rapport à l'objectif (points sur 100). */
export function questionProgress(count: number, planned: number | null, points: number) {
  return { count, planned, points, pct: planned && planned > 0 ? Math.min(100, Math.round((count / planned) * 1000) / 10) : 0, pointsPct: Math.min(100, points) };
}
