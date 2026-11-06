import type { SupabaseClient } from "@supabase/supabase-js";
import { bucketEnrollments, completionRate, coursePercent, monthlyCounts, successRate, type Buckets, type EnrollmentRow } from "./dashboard";

/**
 * Données du tableau de bord formateur. Toutes les lectures passent par la RLS : le formateur ne voit que ses
 * formations, ses sessions et les apprenants inscrits à ses formations.
 */

export type DashboardData = {
  name: string;
  /** Instant de calcul : sert au rendu (dates relatives), sans appeler Date.now() pendant le rendu. */
  now: number;
  kpis: { learners: number; courses: number; upcomingSessions: number; certificates: number };
  performance: { success: number | null; completion: number | null; activeLearners: number };
  monthly: { label: string; enrolled: number; certified: number }[];
  courses: { id: string; title: string; status: string; cover: string | null; learners: number; percent: number }[];
  sessions: { id: string; courseId: string; title: string; course: string; start: string; end: string; tz: string; location: string | null; participants: number; capacity: number; status: string }[];
  actions: { toValidateAttendance: number; toDeliverCertificates: number; difficult: number };
  buckets: Buckets;
  activity: { id: string; text: string; at: string }[];
};

type Enr = EnrollmentRow & { session_id: string | null };

export async function loadInstructorDashboard(supabase: SupabaseClient, userId: string): Promise<DashboardData> {
  const now = Date.now();

  const { data: me } = await supabase.from("profiles").select("full_name").eq("id", userId).maybeSingle<{ full_name: string }>();
  const { data: ownCourses } = await supabase.from("courses").select("id, title, status, cover_url").eq("instructor_id", userId)
    .returns<{ id: string; title: string; status: string; cover_url: string | null }[]>();
  const courses = ownCourses ?? [];
  const courseIds = courses.map((c) => c.id);
  const empty: DashboardData = {
    name: me?.full_name ?? "", now, kpis: { learners: 0, courses: 0, upcomingSessions: 0, certificates: 0 },
    performance: { success: null, completion: null, activeLearners: 0 }, monthly: [], courses: [], sessions: [],
    actions: { toValidateAttendance: 0, toDeliverCertificates: 0, difficult: 0 },
    buckets: { formation: 0, attente: 0, certifies: 0, difficulte: 0 }, activity: [],
  };
  if (courseIds.length === 0) return empty;

  const [enrRes, sessRes, certRes, evalRes, contentRes] = await Promise.all([
    supabase.from("enrollments").select("id, course_id, learner_id, status, enrolled_at, session_id").in("course_id", courseIds).returns<Enr[]>(),
    supabase.from("sessions").select("id, course_id, title, start_at, end_at, timezone, location, capacity, status, course:courses(title)")
      .eq("instructor_id", userId).order("start_at")
      .returns<{ id: string; course_id: string; title: string; start_at: string; end_at: string; timezone: string; location: string | null; capacity: number; status: string; course: { title: string } | null }[]>(),
    supabase.from("certificates").select("id, enrollment_id, status, issued_at").in("course_id", courseIds)
      .returns<{ id: string; enrollment_id: string; status: string; issued_at: string }[]>(),
    supabase.from("evaluations").select("id, course_id, max_attempts, status").in("course_id", courseIds)
      .returns<{ id: string; course_id: string; max_attempts: number; status: string }[]>(),
    supabase.from("learning_contents").select("id, module:course_modules(course_id)").eq("status", "published")
      .returns<{ id: string; module: { course_id: string } | null }[]>(),
  ]);

  const enrollments = enrRes.data ?? [];
  const sessions = sessRes.data ?? [];
  const certs = certRes.data ?? [];
  const evals = evalRes.data ?? [];
  const contents = (contentRes.data ?? []).filter((c) => c.module && courseIds.includes(c.module.course_id));
  const evalIds = evals.map((e) => e.id);
  const sessionIds = sessions.map((s) => s.id);
  const contentIds = contents.map((c) => c.id);

  const [attemptRes, completionRes, attendanceRes, messageRes] = await Promise.all([
    evalIds.length
      ? supabase.from("evaluation_attempts").select("evaluation_id, learner_id, submitted_at, passed").in("evaluation_id", evalIds)
          .returns<{ evaluation_id: string; learner_id: string; submitted_at: string | null; passed: boolean | null }[]>()
      : Promise.resolve({ data: [] }),
    contentIds.length
      ? supabase.from("content_completions").select("content_id, learner_id, completed_at").in("content_id", contentIds)
          .returns<{ content_id: string; learner_id: string; completed_at: string }[]>()
      : Promise.resolve({ data: [] }),
    sessionIds.length
      ? supabase.from("attendance_records").select("session_id, learner_id, status").in("session_id", sessionIds)
          .returns<{ session_id: string; learner_id: string; status: string }[]>()
      : Promise.resolve({ data: [] }),
    supabase.from("messages").select("id, sender_id, created_at, conversation_id").neq("sender_id", userId)
      .order("created_at", { ascending: false }).limit(5)
      .returns<{ id: string; sender_id: string; created_at: string; conversation_id: string }[]>(),
  ]);
  const attempts = attemptRes.data ?? [];
  const completions = completionRes.data ?? [];
  const attendance = attendanceRes.data ?? [];
  const messages = messageRes.data ?? [];

  // Noms limités aux personnes affichées dans l'activité récente
  const personIds = [...new Set([...enrollments.map((e) => e.learner_id), ...messages.map((m) => m.sender_id)])];
  const { data: profiles } = personIds.length
    ? await supabase.from("profiles").select("id, full_name").in("id", personIds).returns<{ id: string; full_name: string }[]>()
    : { data: [] };
  const names = new Map((profiles ?? []).map((p) => [p.id, p.full_name]));
  const nameOf = (id: string) => names.get(id) || "Apprenant";

  // Apprenants en difficulté : évaluation publiée dont toutes les tentatives sont utilisées sans réussite
  const activeEnr = enrollments.filter((e) => ["confirmed", "completed", "suspended"].includes(e.status));
  const difficultIds = new Set<string>();
  for (const e of activeEnr) {
    const failed = evals.some((ev) => {
      if (ev.course_id !== e.course_id || ev.status !== "published") return false;
      const mine = attempts.filter((a) => a.evaluation_id === ev.id && a.learner_id === e.learner_id);
      const sent = mine.filter((a) => a.submitted_at).length;
      return sent >= ev.max_attempts && !mine.some((a) => a.passed);
    });
    if (failed) difficultIds.add(e.id);
  }

  // Certificats valides et apprenants pour lesquels le certificat peut être délivré
  const certifiedIds = new Set(certs.filter((c) => c.status !== "revoked").map((c) => c.enrollment_id));
  const candidates = activeEnr.filter((x) => !certifiedIds.has(x.id)).slice(0, 200);
  const verdicts = await Promise.all(candidates.map((e) => supabase.rpc("certificate_eligibility", { p_enrollment: e.id })));
  const eligibleIds = candidates
    .filter((_, i) => (verdicts[i].data as { eligible?: boolean } | null)?.eligible)
    .map((e) => e.id);

  const buckets = bucketEnrollments(enrollments, certifiedIds, difficultIds);
  const learnersOf = (courseId: string) => new Set(activeEnr.filter((e) => e.course_id === courseId).map((e) => e.learner_id)).size;
  const contentsOf = (courseId: string) => contents.filter((c) => c.module?.course_id === courseId).length;
  const doneOf = (courseId: string) => {
    const ids = new Set(contents.filter((c) => c.module?.course_id === courseId).map((c) => c.id));
    return completions.filter((c) => ids.has(c.content_id)).length;
  };

  const activeSince = now - 30 * 86_400_000;
  const activeLearners = new Set([
    ...completions.filter((c) => new Date(c.completed_at).getTime() >= activeSince).map((c) => c.learner_id),
    ...attempts.filter((a) => a.submitted_at && new Date(a.submitted_at).getTime() >= activeSince).map((a) => a.learner_id),
  ]).size;

  const upcoming = sessions.filter((s) => new Date(s.end_at).getTime() > now && s.status !== "cancelled");
  const toValidate = sessions.filter((s) => new Date(s.end_at).getTime() < now && s.status !== "cancelled"
    && !attendance.some((a) => a.session_id === s.id));

  const enrolledDates = enrollments.map((e) => e.enrolled_at);
  const certDates = certs.filter((c) => c.status !== "revoked").map((c) => c.issued_at);
  const enrolledByMonth = monthlyCounts(enrolledDates, 6, now);
  const certByMonth = monthlyCounts(certDates, 6, now);

  const activity = [
    ...[...enrollments].sort((a, b) => new Date(b.enrolled_at).getTime() - new Date(a.enrolled_at).getTime()).slice(0, 6)
      .map((e) => ({ id: `e-${e.id}`, text: `Nouvelle inscription : ${nameOf(e.learner_id)}`, at: e.enrolled_at })),
    ...messages.map((m) => ({ id: `m-${m.id}`, text: `Message reçu : ${nameOf(m.sender_id)}`, at: m.created_at })),
    ...certs.filter((c) => c.status !== "revoked").slice(0, 6).map((c) => ({ id: `c-${c.id}`, text: "Certificat délivré", at: c.issued_at })),
    ...attempts.filter((a) => a.submitted_at).slice(0, 10).map((a, i) => ({ id: `a-${i}`, text: `Évaluation soumise : ${nameOf(a.learner_id)}`, at: a.submitted_at! })),
  ]
    .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
    .slice(0, 6);

  return {
    name: me?.full_name ?? "",
    now,
    kpis: {
      learners: new Set(activeEnr.map((e) => e.learner_id)).size,
      courses: courses.filter((c) => c.status !== "archived").length,
      upcomingSessions: upcoming.length,
      certificates: certs.filter((c) => c.status !== "revoked").length,
    },
    performance: { success: successRate(attempts), completion: completionRate(enrollments), activeLearners },
    monthly: enrolledByMonth.map((m, i) => ({ label: m.label, enrolled: m.count, certified: certByMonth[i].count })),
    courses: courses.filter((c) => c.status !== "archived").map((c) => ({
      id: c.id,
      title: c.title,
      status: c.status,
      cover: c.cover_url,
      learners: learnersOf(c.id),
      percent: coursePercent(contentsOf(c.id), learnersOf(c.id), doneOf(c.id)),
    })),
    sessions: upcoming.slice(0, 4).map((s) => ({
      id: s.id, courseId: s.course_id, title: s.title, course: s.course?.title ?? "", start: s.start_at, end: s.end_at, tz: s.timezone,
      location: s.location, participants: enrollments.filter((e) => e.session_id === s.id && ["confirmed", "completed"].includes(e.status)).length,
      capacity: s.capacity, status: s.status,
    })),
    actions: { toValidateAttendance: toValidate.length, toDeliverCertificates: eligibleIds.length, difficult: buckets.difficulte },
    buckets,
    activity,
  };
}
