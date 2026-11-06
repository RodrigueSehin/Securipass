import { createClient } from "@/lib/supabase/server";
import type { ContentRow } from "@/lib/learner/progress";
import { buildLearnerRows, recentActivity, type ActivityItem, type EnrollmentInput, type LearnerRow } from "./overview";

export type LearnerOverview = {
  rows: LearnerRow[];
  activity: ActivityItem[];
  courses: { id: string; title: string }[];
  sessions: { id: string; title: string; start: string }[];
  now: number;
  failed: boolean;
};

/** Apprenants inscrits aux formations du formateur ; toutes les lectures passent par la RLS. */
export async function loadLearnerOverview(now: number): Promise<LearnerOverview> {
  const empty: LearnerOverview = { rows: [], activity: [], courses: [], sessions: [], now, failed: false };
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ...empty, failed: true };

  const { data: ownCourses, error } = await supabase.from("courses").select("id, title").eq("instructor_id", user.id).neq("status", "archived")
    .order("title").returns<{ id: string; title: string }[]>();
  if (error) return { ...empty, failed: true };
  const courses = ownCourses ?? [];
  if (courses.length === 0) return empty;
  const courseIds = courses.map((c) => c.id);

  const [enrRes, sessRes, contentRes, evalRes, certRes] = await Promise.all([
    supabase.from("enrollments").select("id, course_id, learner_id, session_id, status, enrolled_at, completed_at").in("course_id", courseIds).returns<EnrollmentInput[]>(),
    supabase.from("sessions").select("id, title, start_at").eq("instructor_id", user.id).order("start_at", { ascending: false })
      .returns<{ id: string; title: string; start_at: string }[]>(),
    supabase.from("learning_contents").select("id, duration_minutes, counts_in_progress, module:course_modules!inner(course_id)").eq("status", "published")
      .in("module.course_id", courseIds)
      .returns<{ id: string; duration_minutes: number; counts_in_progress: boolean | null; module: { course_id: string } }[]>(),
    supabase.from("evaluations").select("id, course_id").in("course_id", courseIds).returns<{ id: string; course_id: string }[]>(),
    supabase.from("certificates").select("enrollment_id, status, issued_at").in("course_id", courseIds)
      .returns<{ enrollment_id: string; status: string; issued_at: string }[]>(),
  ]);
  if (enrRes.error) return { ...empty, courses, failed: true };

  const enrollments = enrRes.data ?? [];
  const contents: ContentRow[] = (contentRes.data ?? []).map((c) => ({
    id: c.id, course_id: c.module.course_id, duration_minutes: c.duration_minutes, counts_in_progress: c.counts_in_progress ?? true,
  }));
  const learnerIds = [...new Set(enrollments.map((e) => e.learner_id))];
  const contentIds = contents.map((c) => c.id);
  const evalCourse = new Map((evalRes.data ?? []).map((e) => [e.id, e.course_id]));

  const [profRes, compRes, attRes] = await Promise.all([
    learnerIds.length ? supabase.from("profiles").select("id, full_name, email, avatar_url").in("id", learnerIds)
      .returns<{ id: string; full_name: string; email: string; avatar_url: string | null }[]>() : Promise.resolve({ data: [] }),
    learnerIds.length && contentIds.length ? supabase.from("content_completions").select("learner_id, content_id, completed_at").in("content_id", contentIds)
      .returns<{ learner_id: string; content_id: string; completed_at: string }[]>() : Promise.resolve({ data: [] }),
    learnerIds.length && evalCourse.size ? supabase.from("evaluation_attempts").select("evaluation_id, learner_id, submitted_at").in("evaluation_id", [...evalCourse.keys()])
      .returns<{ evaluation_id: string; learner_id: string; submitted_at: string | null }[]>() : Promise.resolve({ data: [] }),
  ]);

  const certs = (certRes.data ?? []).filter((c) => c.status !== "revoked");
  const inputs = {
    enrollments,
    profiles: new Map((profRes.data ?? []).map((p) => [p.id, p])),
    courses: new Map(courses.map((c) => [c.id, c.title])),
    sessions: new Map((sessRes.data ?? []).map((s) => [s.id, s])),
    contents,
    completions: compRes.data ?? [],
    attempts: (attRes.data ?? []).map((a) => ({ learner_id: a.learner_id, evaluation_course_id: evalCourse.get(a.evaluation_id) ?? "", submitted_at: a.submitted_at })),
    certifiedEnrollmentIds: new Set(certs.map((c) => c.enrollment_id)),
    now,
  };
  return {
    rows: buildLearnerRows(inputs),
    activity: recentActivity({ ...inputs, certDates: new Map(certs.map((c) => [c.enrollment_id, c.issued_at])) }),
    courses,
    sessions: (sessRes.data ?? []).map((s) => ({ id: s.id, title: s.title, start: s.start_at })),
    now,
    failed: false,
  };
}
