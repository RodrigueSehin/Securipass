import { createClient } from "@/lib/supabase/server";
import { PARTICIPANT_SELECT } from "@/lib/selects";
import type { CourseStatus, EnrollmentStatus, Level, Mode } from "./labels";
import type { CourseFormDefaults } from "@/components/courses/course-form";
import { coursePercent, successRate } from "@/lib/instructor/dashboard";
import type { CourseListRow } from "./course-list";

export type OwnCourse = CourseFormDefaults & {
  id: string;
  title: string;
  slug: string;
  status: CourseStatus;
  rejection_reason: string | null;
  instructor_id: string;
  subtitle: string | null;
  course_code: string | null;
  external_reference: string | null;
  certificate_template_id: string | null;
  audience_types: string[];
  keywords: string[];
  language_requirement: string | null;
  enrollment_mode: "free" | "approval" | "code";
  evaluation_enabled: boolean;
  evaluation_types: string[];
  pass_mark_percent: number;
  grading_scale: number;
  grade_rounding: "none" | "nearest" | "up" | "down";
  default_attempts: number;
  show_results: boolean;
  allow_retake: boolean;
  certificate_enabled: boolean;
  certificate_title: string | null;
  certificate_description: string | null;
  certificate_display: string[];
  publication_mode: "draft" | "publish" | "scheduled";
  publish_at: string | null;
  payment_methods: string[];
  allow_installments: boolean;
  allow_downloads: boolean;
  forum_enabled: boolean;
  allow_discussions: boolean;
  show_progress: boolean;
  notify_instructor: boolean;
  auto_certificate: boolean;
  parent_course_id: string | null;
  featured: boolean;
  registrations_open: boolean;
};

/** Code d'accès d'une formation (visible de son formateur et du personnel seulement : RLS). */
export async function getAccessCode(courseId: string): Promise<string> {
  const supabase = await createClient();
  const { data } = await supabase.from("course_access_codes").select("code").eq("course_id", courseId).maybeSingle<{ code: string }>();
  return data?.code ?? "";
}

export async function getOwnCourse(id: string): Promise<OwnCourse | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  // La lecture RLS autorise aussi les formations publiées d'autres formateurs : on filtre sur le propriétaire.
  const { data } = await supabase.from("courses").select("*").eq("id", id).eq("instructor_id", user.id).maybeSingle();
  return (data as OwnCourse | null) ?? null;
}

export async function getFormLookups(excludeId?: string) {
  const supabase = await createClient();
  const [cats, others, templates] = await Promise.all([
    supabase.from("categories").select("id, name").order("name"),
    supabase.from("courses").select("id, title").eq("status", "published").order("title").limit(200),
    supabase.from("certificate_templates").select("id, name, layout").eq("status", "published").order("name"),
  ]);
  return {
    categories: cats.data ?? [],
    otherCourses: (others.data ?? []).filter((c) => c.id !== excludeId),
    certificateTemplates: templates.data ?? [],
  };
}

export type ModuleResource = { id: string; name: string; size_bytes: number; mime_type: string | null; file_path: string };

export type ProgrammeModule = {
  id: string;
  title: string;
  description: string | null;
  position: number;
  resources: ModuleResource[];
  contents: {
    id: string;
    title: string;
    content_type: "video" | "pdf" | "presentation" | "link" | "text" | "practice";
    description: string | null;
    body: string | null;
    external_url: string | null;
    file_path: string | null;
    duration_minutes: number;
    position: number;
    status: "draft" | "published";
  }[];
};

export async function getProgramme(courseId: string): Promise<ProgrammeModule[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("course_modules")
    .select("id, title, description, position, resources:module_resources(id, name, size_bytes, mime_type, file_path), contents:learning_contents(id, title, content_type, description, body, external_url, file_path, duration_minutes, position, status)")
    .eq("course_id", courseId)
    .order("position")
    .order("id")
    .returns<ProgrammeModule[]>();
  return (data ?? []).map((m) => ({ ...m, resources: m.resources ?? [], contents: [...m.contents].sort((a, b) => a.position - b.position) }));
}

export type CourseSessionRow = {
  id: string;
  course_id: string;
  title: string;
  start_at: string;
  end_at: string;
  timezone: string;
  delivery_mode: "onsite" | "online" | "hybrid";
  location: string | null;
  capacity: number;
  registration_deadline: string | null;
  waitlist_enabled: boolean;
  status: "draft" | "scheduled" | "cancelled" | "completed";
  reference: string;
  meeting_platform: "teams" | "zoom" | "meet" | "other" | null;
};

const SESSION_COLS = "id, reference, course_id, title, start_at, end_at, timezone, delivery_mode, location, capacity, registration_deadline, waitlist_enabled, status, meeting_platform";

export async function listCourseSessions(courseId: string): Promise<(CourseSessionRow & { taken: number; waiting: number })[]> {
  const supabase = await createClient();
  const [s, e] = await Promise.all([
    supabase.from("sessions").select(SESSION_COLS).eq("course_id", courseId).order("start_at", { ascending: false }).returns<CourseSessionRow[]>(),
    supabase.from("enrollments").select("session_id, status").eq("course_id", courseId).not("session_id", "is", null),
  ]);
  const taken = new Map<string, number>();
  const waiting = new Map<string, number>();
  for (const row of e.data ?? []) {
    const sid = row.session_id as string;
    if (["confirmed", "completed", "pending_payment", "suspended"].includes(row.status)) taken.set(sid, (taken.get(sid) ?? 0) + 1);
    if (row.status === "waitlisted") waiting.set(sid, (waiting.get(sid) ?? 0) + 1);
  }
  return (s.data ?? []).map((x) => ({ ...x, taken: taken.get(x.id) ?? 0, waiting: waiting.get(x.id) ?? 0 }));
}

export type MySession = CourseSessionRow & {
  course: { title: string; cover_url: string | null; category: { slug: string; name: string } | null } | null;
  taken: number;
};

export async function listMySessions(): Promise<MySession[]> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];
  const [s, e] = await Promise.all([
    supabase.from("sessions").select(`${SESSION_COLS}, course:courses(title, cover_url, category:categories(slug, name))`).eq("instructor_id", user.id).order("start_at", { ascending: false })
      .returns<Omit<MySession, "taken">[]>(),
    supabase.from("enrollments").select("session_id, status").not("session_id", "is", null),
  ]);
  const taken = new Map<string, number>();
  for (const row of e.data ?? []) {
    if (["confirmed", "completed", "pending_payment", "suspended"].includes(row.status)) {
      taken.set(row.session_id as string, (taken.get(row.session_id as string) ?? 0) + 1);
    }
  }
  return (s.data ?? []).map((x) => ({ ...x, taken: taken.get(x.id) ?? 0 }));
}

export async function getSession(sessionId: string) {
  if (!/^[0-9a-f-]{36}$/i.test(sessionId)) return null;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase.from("sessions").select(SESSION_COLS).eq("id", sessionId).eq("instructor_id", user.id).maybeSingle<CourseSessionRow>();
  if (!data) return null;
  const link = await supabase.from("session_meeting_links").select("url").eq("session_id", sessionId).maybeSingle();
  return { ...data, meeting_url: (link.data?.url as string | undefined) ?? null };
}

export type Participant = {
  id: string;
  status: EnrollmentStatus;
  enrolled_at: string;
  learner: { full_name: string; email: string; phone: string | null } | null;
};

export async function listParticipants(sessionId: string): Promise<{ rows: Participant[]; failed: boolean }> {
  const supabase = await createClient();
  // enrollments référence profiles deux fois (learner_id, created_by) : la clé doit être explicite.
  const { data, error } = await supabase
    .from("enrollments")
    .select(PARTICIPANT_SELECT)
    .eq("session_id", sessionId)
    .order("enrolled_at")
    .returns<Participant[]>();
  return { rows: data ?? [], failed: Boolean(error) };
}

export type EnrollmentRequest = {
  id: string;
  enrolled_at: string;
  learner: { full_name: string; email: string; phone: string | null } | null;
  session: { title: string; start_at: string; timezone: string } | null;
};

/** Demandes d'inscription en attente de la décision du formateur, de la plus ancienne à la plus récente. */
export async function listPendingRequests(courseId: string): Promise<EnrollmentRequest[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("enrollments")
    .select("id, enrolled_at, learner:profiles!enrollments_learner_id_fkey(full_name, email, phone), session:sessions(title, start_at, timezone)")
    .eq("course_id", courseId)
    .eq("status", "pending_approval")
    .order("enrolled_at")
    .returns<EnrollmentRequest[]>();
  return data ?? [];
}

type CourseListRecord = {
  id: string;
  title: string;
  slug: string;
  status: CourseStatus;
  cover_url: string | null;
  level: Level;
  delivery_mode: Mode;
  duration_minutes: number;
  price_amount: number;
  created_at: string;
  updated_at: string;
  category: { name: string } | null;
};

const ACTIVE_ENROLLMENT = ["confirmed", "completed", "suspended"];

/**
 * Liste « Mes formations » avec indicateurs réels. Les lectures passent par la RLS ; les indicateurs sont
 * calculés par formation à partir des inscriptions actives, des leçons publiées et des tentatives d'évaluation.
 */
export async function loadOwnCourseList(): Promise<{ rows: CourseListRow[]; totalLearners: number; failed: boolean }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { rows: [], totalLearners: 0, failed: true };

  const { data: courses, error } = await supabase
    .from("courses")
    .select("id, title, slug, status, cover_url, level, delivery_mode, duration_minutes, price_amount, created_at, updated_at, category:categories(name)")
    .eq("instructor_id", user.id)
    .order("updated_at", { ascending: false })
    .returns<CourseListRecord[]>();
  if (error) return { rows: [], totalLearners: 0, failed: true };
  const list = courses ?? [];
  const ids = list.map((c) => c.id);
  if (ids.length === 0) return { rows: [], totalLearners: 0, failed: false };

  const [modRes, contentRes, enrRes, evalRes] = await Promise.all([
    supabase.from("course_modules").select("id, course_id").in("course_id", ids).returns<{ id: string; course_id: string }[]>(),
    supabase.from("learning_contents").select("id, module:course_modules!inner(course_id)").eq("status", "published")
      .in("module.course_id", ids).returns<{ id: string; module: { course_id: string } }[]>(),
    supabase.from("enrollments").select("course_id, learner_id, status").in("course_id", ids)
      .returns<{ course_id: string; learner_id: string; status: string }[]>(),
    supabase.from("evaluations").select("id, course_id, status").in("course_id", ids)
      .returns<{ id: string; course_id: string; status: string }[]>(),
  ]);
  const modules = modRes.data ?? [];
  const contents = contentRes.data ?? [];
  const enrollments = (enrRes.data ?? []).filter((e) => ACTIVE_ENROLLMENT.includes(e.status));
  const evals = evalRes.data ?? [];
  const evalIds = evals.map((e) => e.id);
  const contentIds = contents.map((c) => c.id);

  const [completionRes, attemptRes] = await Promise.all([
    contentIds.length
      ? supabase.from("content_completions").select("content_id, learner_id").in("content_id", contentIds)
          .returns<{ content_id: string; learner_id: string }[]>()
      : Promise.resolve({ data: [] }),
    evalIds.length
      ? supabase.from("evaluation_attempts").select("evaluation_id, submitted_at, passed").in("evaluation_id", evalIds)
          .returns<{ evaluation_id: string; submitted_at: string | null; passed: boolean | null }[]>()
      : Promise.resolve({ data: [] }),
  ]);
  const completions = completionRes.data ?? [];
  const attempts = attemptRes.data ?? [];

  const rows: CourseListRow[] = list.map((c) => {
    const learners = new Set(enrollments.filter((e) => e.course_id === c.id).map((e) => e.learner_id));
    const lessonIds = new Set(contents.filter((x) => x.module.course_id === c.id).map((x) => x.id));
    const courseEvalIds = new Set(evals.filter((e) => e.course_id === c.id && e.status === "published").map((e) => e.id));
    const courseAttempts = attempts.filter((a) => courseEvalIds.has(a.evaluation_id));
    const done = completions.filter((x) => lessonIds.has(x.content_id) && learners.has(x.learner_id)).length;
    return {
      id: c.id,
      title: c.title,
      slug: c.slug,
      status: c.status,
      cover: c.cover_url,
      category: c.category?.name ?? null,
      level: c.level,
      mode: c.delivery_mode,
      durationMinutes: c.duration_minutes,
      priceAmount: c.price_amount,
      createdAt: c.created_at,
      updatedAt: c.updated_at,
      learners: learners.size,
      percent: coursePercent(lessonIds.size, learners.size, done),
      modules: modules.filter((m) => m.course_id === c.id).length,
      lessons: lessonIds.size,
      quizzes: courseEvalIds.size,
      success: successRate(courseAttempts),
    };
  });

  const totalLearners = new Set(enrollments.map((e) => e.learner_id)).size;
  return { rows, totalLearners, failed: false };
}
