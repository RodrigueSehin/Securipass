import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { EnrollmentStatus } from "@/lib/courses/labels";
import { courseProgress, progressStatus, type ContentRow, type CourseProgress, type ProgressStatus } from "./progress";
import { evaluationState } from "./evaluations";
import type { ActivityKind, Rounding } from "@/lib/courses/grading";

/**
 * Données de l'espace apprenant. Chaque requête repose sur la RLS : l'apprenant ne reçoit que ses inscriptions,
 * les contenus de ses formations et les évaluations qu'il peut passer. Les jointures précisent leur clé étrangère.
 */

export type LearnerEnrollment = {
  id: string;
  status: EnrollmentStatus;
  enrolled_at: string;
  course: { id: string; title: string; slug: string; cover_url: string | null; duration_minutes: number; description: string | null; competencies: string[]; certificate_conditions: string | null; allow_downloads: boolean; show_progress: boolean; forum_enabled: boolean; category: { slug: string; name: string } | null } | null;
  session: { id: string; title: string; start_at: string; end_at: string; timezone: string; location: string | null } | null;
};

export type LearnerContent = {
  id: string;
  title: string;
  description: string | null;
  content_type: "video" | "pdf" | "presentation" | "link" | "text" | "practice" | "document" | "case_study" | "quiz";
  body: string | null;
  file_path: string | null;
  external_url: string | null;
  duration_minutes: number;
  position: number;
  show_in_outline: boolean;
  counts_in_progress: boolean;
  allow_download: boolean;
  allow_comments: boolean;
  is_required: boolean;
  evaluation_id: string | null;
  prerequisite_content_id: string | null;
  module: { course_id: string; position: number; title: string } | null;
};

export type LearnerEvaluation = {
  id: string;
  title: string;
  available_at: string | null;
  instructions: string | null;
  time_limit_minutes: number | null;
  max_attempts: number;
  passing_score: number;
  due_at: string | null;
  course_id: string;
  /** Activité de la formation : « quiz » (corrigé automatiquement) ou notée par le formateur. */
  kind: ActivityKind;
  weight_percent: number;
  course: { title: string; show_results: boolean; grading_scale: number; grade_rounding: Rounding; allow_retake: boolean } | null;
};

export type LearnerGrade = { evaluation_id: string; score_percent: number; feedback: string | null; graded_at: string };

export type LearnerAttempt = {
  id: string;
  evaluation_id: string;
  started_at: string;
  submitted_at: string | null;
  deadline_at: string | null;
  score_percent: number | null;
  passed: boolean | null;
};

export type LearnerAttendance = {
  session_id: string;
  status: "present" | "absent" | "late" | "excused";
  justification: string | null;
  session: { title: string; start_at: string; timezone: string; course_id: string } | null;
};

export type LearnerNotification = {
  id: string;
  kind: string;
  title: string;
  body: string | null;
  link: string | null;
  created_at: string;
  read_at: string | null;
};

export type LearnerState = {
  /** Instant de chargement : les pages s’en servent pour les échéances, sans appeler l’horloge pendant le rendu. */
  now: number;
  enrollments: LearnerEnrollment[];
  contents: (ContentRow & LearnerContent & { module_position: number })[];
  doneIds: Set<string>;
  /** Date de fin de chaque leçon terminée (identifiant de leçon → ISO). */
  completedAt: Map<string, string>;
  evaluations: LearnerEvaluation[];
  attempts: LearnerAttempt[];
  grades: LearnerGrade[];
  attendance: LearnerAttendance[];
};

const ACTIVE_STATUSES: EnrollmentStatus[] = ["confirmed", "completed"];

export async function loadLearnerState(supabase: SupabaseClient, userId: string): Promise<LearnerState> {
  const [enrollments, contents, completions, evaluations, attempts, attendance, grades] = await Promise.all([
    supabase
      .from("enrollments")
      .select("id, status, enrolled_at, course:courses(id, title, slug, cover_url, duration_minutes, description, competencies, certificate_conditions, allow_downloads, show_progress, forum_enabled, category:categories(slug, name)), session:sessions(id, title, start_at, end_at, timezone, location)")
      .eq("learner_id", userId)
      .order("enrolled_at", { ascending: false })
      .returns<LearnerEnrollment[]>(),
    supabase
      .from("learning_contents")
      .select("id, title, description, content_type, body, file_path, external_url, duration_minutes, position, show_in_outline, counts_in_progress, allow_download, allow_comments, is_required, evaluation_id, prerequisite_content_id, module:course_modules(course_id, position, title)")
      .eq("status", "published")
      .returns<LearnerContent[]>(),
    supabase.from("content_completions").select("content_id, completed_at").eq("learner_id", userId).returns<{ content_id: string; completed_at: string }[]>(),
    supabase
      .from("evaluations")
      .select("id, title, instructions, available_at, time_limit_minutes, max_attempts, passing_score, due_at, course_id, kind, weight_percent, course:courses(title, show_results, grading_scale, grade_rounding, allow_retake)")
      .eq("status", "published")
      .order("due_at", { ascending: true, nullsFirst: false })
      .returns<LearnerEvaluation[]>(),
    supabase
      .from("evaluation_attempts")
      .select("id, evaluation_id, started_at, submitted_at, deadline_at, score_percent, passed")
      .eq("learner_id", userId)
      .returns<LearnerAttempt[]>(),
    supabase
      .from("attendance_records")
      .select("session_id, status, justification, session:sessions(title, start_at, timezone, course_id)")
      .eq("learner_id", userId)
      .returns<LearnerAttendance[]>(),
    supabase.from("evaluation_grades").select("evaluation_id, score_percent, feedback, graded_at").eq("learner_id", userId).returns<LearnerGrade[]>(),
  ]);

  const flatContents = (contents.data ?? [])
    .filter((c) => c.module && c.show_in_outline)
    .map((c) => ({ ...c, course_id: c.module!.course_id, module_position: c.module!.position }));

  // Tentatives effectives : le rattrapage ajoute une tentative aux quiz ; une activité notée par le formateur se « passe » une fois,
  // et sa note devient une tentative envoyée pour que le classement des évaluations reste le même.
  const gradeList = grades.data ?? [];
  const evaluationList = (evaluations.data ?? []).map((ev) => ({
    ...ev,
    max_attempts: ev.kind === "quiz" ? ev.max_attempts + (ev.course?.allow_retake ? 1 : 0) : 1,
  }));
  const gradeAttempts: LearnerAttempt[] = gradeList.map((g) => {
    const ev = evaluationList.find((e) => e.id === g.evaluation_id);
    return {
      id: `grade-${g.evaluation_id}`, evaluation_id: g.evaluation_id, started_at: g.graded_at, submitted_at: g.graded_at, deadline_at: null,
      score_percent: g.score_percent, passed: ev ? g.score_percent >= ev.passing_score : null,
    };
  });

  return {
    now: Date.now(),
    enrollments: enrollments.data ?? [],
    contents: flatContents,
    doneIds: new Set((completions.data ?? []).map((c) => c.content_id)),
    completedAt: new Map((completions.data ?? []).map((c) => [c.content_id, c.completed_at])),
    evaluations: evaluationList,
    attempts: [...(attempts.data ?? []), ...gradeAttempts],
    grades: gradeList,
    attendance: attendance.data ?? [],
  };
}

/** Inscriptions actives (confirmées ou terminées) avec leur progression réelle. */
export function activeCourses(state: LearnerState) {
  return state.enrollments
    .filter((e) => ACTIVE_STATUSES.includes(e.status) && e.course)
    .map((e) => {
      const progress: CourseProgress = courseProgress(state.contents, state.doneIds, e.course!.id);
      return { enrollment: e, course: e.course!, progress, status: progressStatus(progress) as ProgressStatus };
    });
}

/** Évaluations à passer maintenant : ouvertes, non terminées, en cours ou non commencées. */
export function evaluationsTodo(state: LearnerState, now = state.now) {
  return state.evaluations.filter((ev) => {
    const s = evaluationState(ev, state.attempts.filter((a) => a.evaluation_id === ev.id), now);
    return s.openNow && s.category !== "finished";
  });
}

/** Prochaines sessions confirmées, dans l'ordre chronologique. */
export function upcomingSessions(state: LearnerState, now = Date.now(), limit = 5) {
  return state.enrollments
    .filter((e) => e.status === "confirmed" && e.session && new Date(e.session.end_at).getTime() > now)
    .sort((a, b) => new Date(a.session!.start_at).getTime() - new Date(b.session!.start_at).getTime())
    .slice(0, limit);
}
