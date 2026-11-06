import { courseProgress, progressStatus, type ContentRow } from "@/lib/learner/progress";

/** Logique pure de « Mes apprenants » : statut, progression, filtres, indicateurs et activité récente. */

export type LearnerStatus = "in_progress" | "not_started" | "completed" | "late" | "dropped";

export const LEARNER_STATUS: Record<LearnerStatus, { label: string; tone: string; color: string }> = {
  in_progress: { label: "En cours", tone: "bg-success/15 text-success", color: "#16a34a" },
  not_started: { label: "Non commencé", tone: "bg-surface text-brand-dark", color: "#16a34a" },
  completed: { label: "Terminé", tone: "bg-success/15 text-success", color: "#0b8f5a" },
  late: { label: "En retard", tone: "bg-warning/15 text-warning", color: "#f59e0b" },
  dropped: { label: "Abandon", tone: "bg-danger/10 text-danger", color: "#ef4444" },
};

/** Une inscription sans activité depuis ce nombre de jours est « en retard ». */
export const LATE_AFTER_DAYS = 14;

export type EnrollmentInput = {
  id: string; course_id: string; learner_id: string; session_id: string | null; status: string; enrolled_at: string; completed_at: string | null;
};

export type LearnerRow = {
  id: string; courseId: string; learnerId: string; name: string; email: string; avatar: string | null;
  course: string; sessionId: string | null; sessionStart: string | null; sessionTitle: string | null;
  percent: number; status: LearnerStatus; lastActivity: string | null; enrolledAt: string; certified: boolean;
};

type Inputs = {
  enrollments: EnrollmentInput[];
  profiles: Map<string, { full_name: string; email: string; avatar_url: string | null }>;
  courses: Map<string, string>;
  sessions: Map<string, { start_at: string; title: string }>;
  contents: ContentRow[];
  completions: { learner_id: string; content_id: string; completed_at: string }[];
  attempts: { learner_id: string; evaluation_course_id: string; submitted_at: string | null }[];
  certifiedEnrollmentIds: Set<string>;
  now: number;
};

const DAY = 86_400_000;

/** Statut d'une inscription : abandon, terminé, non commencé, en retard (inactif depuis 14 jours) ou en cours. */
export function learnerStatus(args: { enrollmentStatus: string; percentStatus: "not_started" | "in_progress" | "completed"; certified: boolean; lastActivity: string | null; enrolledAt: string; now: number }): LearnerStatus {
  if (args.enrollmentStatus === "cancelled" || args.enrollmentStatus === "expired") return "dropped";
  if (args.enrollmentStatus === "completed" || args.certified || args.percentStatus === "completed") return "completed";
  if (args.percentStatus === "not_started") return "not_started";
  const since = Date.parse(args.lastActivity ?? args.enrolledAt);
  return args.now - since >= LATE_AFTER_DAYS * DAY ? "late" : "in_progress";
}

export function buildLearnerRows(i: Inputs): LearnerRow[] {
  return i.enrollments
    .filter((e) => e.status !== "pending_payment" && e.status !== "waitlisted")
    .map((e) => {
      const done = new Set(i.completions.filter((c) => c.learner_id === e.learner_id).map((c) => c.content_id));
      const p = courseProgress(i.contents, done, e.course_id);
      const ownIds = new Set(i.contents.filter((c) => c.course_id === e.course_id).map((c) => c.id));
      const dates = [
        ...i.completions.filter((c) => c.learner_id === e.learner_id && ownIds.has(c.content_id)).map((c) => c.completed_at),
        ...i.attempts.filter((a) => a.learner_id === e.learner_id && a.evaluation_course_id === e.course_id && a.submitted_at).map((a) => a.submitted_at!),
      ].sort();
      const lastActivity = dates.length ? dates[dates.length - 1] : null;
      const certified = i.certifiedEnrollmentIds.has(e.id);
      const prof = i.profiles.get(e.learner_id);
      const sess = e.session_id ? i.sessions.get(e.session_id) : undefined;
      const status = learnerStatus({ enrollmentStatus: e.status, percentStatus: progressStatus(p), certified, lastActivity, enrolledAt: e.enrolled_at, now: i.now });
      return {
        id: e.id, courseId: e.course_id, learnerId: e.learner_id, name: prof?.full_name || "Apprenant", email: prof?.email ?? "",
        avatar: prof?.avatar_url ?? null, course: i.courses.get(e.course_id) ?? "Formation", sessionId: e.session_id,
        sessionStart: sess?.start_at ?? null, sessionTitle: sess?.title ?? null,
        percent: status === "completed" ? 100 : p.percent, status, lastActivity, enrolledAt: e.enrolled_at, certified,
      };
    })
    .sort((a, b) => (b.lastActivity ?? b.enrolledAt).localeCompare(a.lastActivity ?? a.enrolledAt));
}

export type LearnerFilters = { q?: string; session?: string; status?: string; course?: string };

const fold = (v: string) => v.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase().trim();

export function filterLearners(rows: LearnerRow[], f: LearnerFilters): LearnerRow[] {
  const q = fold(f.q ?? "");
  return rows.filter((r) => {
    if (f.course && r.courseId !== f.course) return false;
    if (f.session && r.sessionId !== f.session) return false;
    if (f.status && r.status !== f.status) return false;
    if (q && !fold(`${r.name} ${r.email} ${r.course}`).includes(q)) return false;
    return true;
  });
}

/** Regroupement d'affichage : les « non commencés » comptent parmi les « en cours ». */
const group = (s: LearnerStatus): "in_progress" | "completed" | "late" | "dropped" => (s === "not_started" ? "in_progress" : s);

export function overviewStats(rows: LearnerRow[], now: number) {
  const total = rows.length;
  const count = (g: ReturnType<typeof group>) => rows.filter((r) => group(r.status) === g).length;
  const pct = (n: number) => (total === 0 ? 0 : Math.round((n / total) * 100));
  const cur = new Date(now).toISOString().slice(0, 7);
  const prevDate = new Date(Date.UTC(Number(cur.slice(0, 4)), Number(cur.slice(5)) - 2, 1)).toISOString().slice(0, 7);
  const inMonth = (m: string) => rows.filter((r) => r.enrolledAt.slice(0, 7) === m).length;
  const a = inMonth(cur);
  const b = inMonth(prevDate);
  const trend = b > 0 && a !== b ? { text: `${a > b ? "+" : "−"}${Math.round((Math.abs(a - b) / b) * 100)}%`, up: a > b } : null;
  const parts = (["in_progress", "completed", "late", "dropped"] as const).map((key) => ({ key, count: count(key), percent: pct(count(key)) }));
  return { total, trend, parts, inProgress: parts[0], completed: parts[1], dropped: parts[3] };
}

/** Formations les plus suivies : nombre d'apprenants non en abandon. */
export function topCourses(rows: LearnerRow[], limit = 5) {
  const m = new Map<string, { id: string; title: string; count: number }>();
  for (const r of rows) {
    if (r.status === "dropped") continue;
    const cur = m.get(r.courseId) ?? { id: r.courseId, title: r.course, count: 0 };
    cur.count += 1;
    m.set(r.courseId, cur);
  }
  return [...m.values()].sort((a, b) => b.count - a.count || a.title.localeCompare(b.title, "fr")).slice(0, limit);
}

export type ActivityItem = { id: string; learnerId: string; name: string; avatar: string | null; verb: string; subject: string; at: string };

/** Événements récents : certificat obtenu, formation terminée, évaluation passée, reprise (dernier contenu terminé). */
export function recentActivity(i: Inputs & { certDates: Map<string, string>; limit?: number }): ActivityItem[] {
  const rows = buildLearnerRows(i);
  const byEnrollment = new Map(rows.map((r) => [r.id, r]));
  const items: ActivityItem[] = [];
  for (const [enrollmentId, at] of i.certDates) {
    const r = byEnrollment.get(enrollmentId);
    if (r) items.push({ id: `c-${enrollmentId}`, learnerId: r.learnerId, name: r.name, avatar: r.avatar, verb: "a obtenu son certificat", subject: r.course, at });
  }
  for (const r of rows) {
    if (r.status === "completed" && !r.certified && r.lastActivity) items.push({ id: `t-${r.id}`, learnerId: r.learnerId, name: r.name, avatar: r.avatar, verb: "a terminé la formation", subject: r.course, at: r.lastActivity });
    else if ((r.status === "in_progress" || r.status === "late") && r.lastActivity) items.push({ id: `r-${r.id}`, learnerId: r.learnerId, name: r.name, avatar: r.avatar, verb: "a repris la formation", subject: r.course, at: r.lastActivity });
  }
  for (const a of i.attempts) {
    if (!a.submitted_at) continue;
    const r = rows.find((x) => x.learnerId === a.learner_id && x.courseId === a.evaluation_course_id);
    if (r) items.push({ id: `a-${r.id}-${a.submitted_at}`, learnerId: r.learnerId, name: r.name, avatar: r.avatar, verb: "a passé l’évaluation", subject: r.course, at: a.submitted_at });
  }
  return items.sort((x, y) => y.at.localeCompare(x.at)).slice(0, i.limit ?? 4);
}

export const initials = (name: string) => name.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase()).join("") || "?";
