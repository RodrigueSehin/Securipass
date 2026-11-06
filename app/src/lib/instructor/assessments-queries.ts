import { createClient } from "@/lib/supabase/server";
import { assessmentStatus, type RosterRow } from "./assessments";

export type AssessmentSession = {
  id: string; title: string; courseId: string; courseTitle: string; startAt: string; endAt: string;
  mode: "onsite" | "online" | "hybrid"; location: string | null; platform: string | null; scale: number; passMark: number;
};

export type AssessmentRoster = { sessions: AssessmentSession[]; session: AssessmentSession | null; rows: RosterRow[]; failed: boolean };

type SessionRow = {
  id: string; title: string; course_id: string; start_at: string; end_at: string; delivery_mode: AssessmentSession["mode"]; location: string | null; meeting_platform: string | null;
  course: { title: string; grading_scale: number; pass_mark_percent: number } | null;
};

/** Sessions du formateur et, pour la session choisie (sinon la plus récente), ses apprenants avec leur statut d'évaluation. Lectures soumises à la RLS. */
export async function loadAssessmentRoster(sessionId: string): Promise<AssessmentRoster> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { sessions: [], session: null, rows: [], failed: true };
  const { data, error } = await supabase.from("sessions")
    .select("id, title, course_id, start_at, end_at, delivery_mode, location, meeting_platform, course:courses(title, grading_scale, pass_mark_percent)")
    .eq("instructor_id", user.id).neq("status", "draft").order("start_at", { ascending: false }).returns<SessionRow[]>();
  if (error) return { sessions: [], session: null, rows: [], failed: true };
  const sessions: AssessmentSession[] = (data ?? []).map((s) => ({
    id: s.id, title: s.title, courseId: s.course_id, courseTitle: s.course?.title ?? s.title, startAt: s.start_at, endAt: s.end_at, mode: s.delivery_mode,
    location: s.location, platform: s.meeting_platform, scale: s.course?.grading_scale ?? 20, passMark: s.course?.pass_mark_percent ?? 70,
  }));
  const session = sessions.find((s) => s.id === sessionId) ?? sessions[0] ?? null;
  if (!session) return { sessions, session: null, rows: [], failed: false };

  const { data: enrollments } = await supabase.from("enrollments")
    .select("learner_id, learner:profiles!enrollments_learner_id_fkey(full_name, email, avatar_url)")
    .eq("session_id", session.id).in("status", ["confirmed", "completed"])
    .returns<{ learner_id: string; learner: { full_name: string | null; email: string; avatar_url: string | null } | null }[]>();
  const { data: evals } = await supabase.from("evaluations").select("id").eq("course_id", session.courseId).or(`session_id.is.null,session_id.eq.${session.id}`)
    .returns<{ id: string }[]>();
  const evalIds = (evals ?? []).map((e) => e.id);
  const [assessed, attempts, grades] = await Promise.all([
    supabase.from("session_assessments").select("learner_id, score_percent, passed").eq("session_id", session.id)
      .returns<{ learner_id: string; score_percent: number; passed: boolean }[]>(),
    evalIds.length ? supabase.from("evaluation_attempts").select("learner_id").in("evaluation_id", evalIds).returns<{ learner_id: string }[]>() : Promise.resolve({ data: [] as { learner_id: string }[] }),
    evalIds.length ? supabase.from("evaluation_grades").select("learner_id").in("evaluation_id", evalIds).returns<{ learner_id: string }[]>() : Promise.resolve({ data: [] as { learner_id: string }[] }),
  ]);
  const done = new Map((assessed.data ?? []).map((a) => [a.learner_id, a]));
  const active = new Set([...(attempts.data ?? []), ...(grades.data ?? [])].map((a) => a.learner_id));
  const rows = (enrollments ?? []).map((e): RosterRow => {
    const a = done.get(e.learner_id);
    return {
      learnerId: e.learner_id, name: e.learner?.full_name || e.learner?.email || "Apprenant", email: e.learner?.email ?? "", avatar: e.learner?.avatar_url ?? null,
      status: assessmentStatus(Boolean(a), active.has(e.learner_id)), scorePercent: a?.score_percent ?? null, passed: a?.passed ?? null,
    };
  }).sort((x, y) => x.name.localeCompare(y.name, "fr"));
  return { sessions, session, rows, failed: false };
}

export type QuestionDetail = { id: string; prompt: string; kind: "single" | "multiple"; points: number; options: { id: string; label: string }[]; correct: string[]; chosen: string[] | null };
export type QuizDetail = { evaluationId: string; title: string; submittedAt: string | null; scorePercent: number | null; questions: QuestionDetail[] };
export type GradeDetail = { evaluationId: string; title: string; scorePercent: number; feedback: string | null; gradedAt: string };
export type HistoryItem = { at: string; label: string; detail: string };
export type LearnerAssessment = {
  quizzes: QuizDetail[]; grades: GradeDetail[]; history: HistoryItem[];
  saved: { scorePercent: number; passed: boolean; comment: string | null; gradedAt: string } | null;
};

/** Détail d'un apprenant : réponses à chaque quiz (dernière tentative rendue), notes du formateur, évaluation globale enregistrée et historique. */
export async function loadLearnerAssessment(session: AssessmentSession, learnerId: string): Promise<LearnerAssessment> {
  const supabase = await createClient();
  const { data: evals } = await supabase.from("evaluations")
    .select("id, title, kind, status, questions:evaluation_questions(id, position, prompt, kind, options, points, key:evaluation_answer_keys(correct_option_ids))")
    .eq("course_id", session.courseId).or(`session_id.is.null,session_id.eq.${session.id}`).neq("status", "archived").order("created_at")
    .returns<{ id: string; title: string; kind: string; status: string; questions: { id: string; position: number; prompt: string; kind: "single" | "multiple"; options: { id: string; label: string }[]; points: number; key: { correct_option_ids: string[] } | null }[] }[]>();
  const evalList = evals ?? [];
  const ids = evalList.map((e) => e.id);
  const [attempts, grades, saved] = await Promise.all([
    ids.length ? supabase.from("evaluation_attempts").select("evaluation_id, started_at, submitted_at, answers, score_percent").in("evaluation_id", ids).eq("learner_id", learnerId).order("started_at", { ascending: false })
      .returns<{ evaluation_id: string; started_at: string; submitted_at: string | null; answers: Record<string, string[]> | null; score_percent: number | null }[]>() : Promise.resolve({ data: [] }),
    ids.length ? supabase.from("evaluation_grades").select("evaluation_id, score_percent, feedback, graded_at").in("evaluation_id", ids).eq("learner_id", learnerId)
      .returns<{ evaluation_id: string; score_percent: number; feedback: string | null; graded_at: string }[]>() : Promise.resolve({ data: [] }),
    supabase.from("session_assessments").select("score_percent, passed, comment, graded_at").eq("session_id", session.id).eq("learner_id", learnerId)
      .maybeSingle<{ score_percent: number; passed: boolean; comment: string | null; graded_at: string }>(),
  ]);
  const title = new Map(evalList.map((e) => [e.id, e.title]));
  const attemptList = attempts.data ?? [];
  const quizzes: QuizDetail[] = evalList.filter((e) => e.kind === "quiz" && e.questions.length > 0).map((e) => {
    const last = attemptList.find((a) => a.evaluation_id === e.id && a.submitted_at);
    return {
      evaluationId: e.id, title: e.title, submittedAt: last?.submitted_at ?? null, scorePercent: last?.score_percent ?? null,
      questions: [...e.questions].sort((x, y) => x.position - y.position).map((q) => ({
        id: q.id, prompt: q.prompt, kind: q.kind, points: q.points, options: q.options, correct: q.key?.correct_option_ids ?? [], chosen: last?.answers ? last.answers[q.id] ?? [] : null,
      })),
    };
  });
  const gradeList: GradeDetail[] = (grades.data ?? []).map((g) => ({ evaluationId: g.evaluation_id, title: title.get(g.evaluation_id) ?? "Activité", scorePercent: g.score_percent, feedback: g.feedback, gradedAt: g.graded_at }));
  const history: HistoryItem[] = [
    ...attemptList.map((a) => ({
      at: a.submitted_at ?? a.started_at, label: a.submitted_at ? "Quiz rendu" : "Quiz commencé",
      detail: `${title.get(a.evaluation_id) ?? "Quiz"}${a.score_percent !== null ? ` · ${a.score_percent} %` : ""}`,
    })),
    ...gradeList.map((g) => ({ at: g.gradedAt, label: "Activité notée", detail: `${g.title} · ${g.scorePercent} %` })),
    ...(saved.data ? [{ at: saved.data.graded_at, label: "Évaluation enregistrée", detail: saved.data.passed ? "Réussi" : "Non réussi" }] : []),
  ].sort((a, b) => b.at.localeCompare(a.at));
  return { quizzes, grades: gradeList, history, saved: saved.data ? { scorePercent: saved.data.score_percent, passed: saved.data.passed, comment: saved.data.comment, gradedAt: saved.data.graded_at } : null };
}
