import { createClient } from "@/lib/supabase/server";
import type { CourseStatus, Mode } from "@/lib/courses/labels";
import { courseOrder, sanitizeSearch, type CourseFilters } from "./courses";

export const ADMIN_COURSES_SELECT =
  "id, title, course_code, cover_url, status, delivery_mode, duration_minutes, price_amount, created_at, instructor_id, " +
  "category:categories(name, icon, color), instructor:profiles!courses_instructor_id_fkey(full_name, avatar_url)";

export type CourseListRow = {
  id: string; title: string; course_code: string | null; cover_url: string | null; status: CourseStatus; delivery_mode: Mode;
  duration_minutes: number; price_amount: number; created_at: string; instructor_id: string;
  category: { name: string; icon: string; color: string } | null;
  instructor: { full_name: string; avatar_url: string | null } | null;
};

export type CoursesPage = { total: number; rows: CourseListRow[]; failed: boolean };

export type Teacher = { name: string; avatar_url: string | null };
export type CourseDetails = {
  learners: number;
  rating: { avg: number; count: number } | null;
  /** Formateurs associés en plus du formateur principal. */
  coTrainers: Teacher[];
};

const monthStart = (offset = 0) => {
  const d = new Date();
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + offset, 1)).toISOString();
};

/** Liste filtrée et paginée. La recherche porte sur le titre, le code, la description et le formateur principal. */
export async function loadCourses(f: CourseFilters, limit: number, offset: number): Promise<CoursesPage> {
  const supabase = await createClient();
  let query = supabase.from("courses").select(ADMIN_COURSES_SELECT, { count: "exact" });
  if (f.status) query = query.eq("status", f.status);
  if (f.category) query = query.eq("category_id", f.category);
  if (f.mode) query = query.eq("delivery_mode", f.mode);

  const q = sanitizeSearch(f.q);
  if (q) {
    const { data: people } = await supabase.from("profiles").select("id").ilike("full_name", `%${q}%`).limit(100);
    const ids = (people ?? []).map((p) => p.id);
    const clauses = [`title.ilike.%${q}%`, `course_code.ilike.%${q}%`, `description.ilike.%${q}%`];
    if (ids.length) clauses.push(`instructor_id.in.(${ids.join(",")})`);
    query = query.or(clauses.join(","));
  }

  for (const o of courseOrder(f.sort)) query = query.order(o.column, { ascending: o.ascending });
  const { data, error, count } = await query.range(offset, offset + limit - 1).returns<CourseListRow[]>();
  if (error) return { total: 0, rows: [], failed: true };
  return { total: count ?? 0, rows: data ?? [], failed: false };
}

/** Apprenants inscrits (confirmés ou terminé), note moyenne et formateurs associés, pour les formations d'une page. */
export async function loadCourseDetails(ids: string[]): Promise<Map<string, CourseDetails>> {
  const out = new Map<string, CourseDetails>();
  if (ids.length === 0) return out;
  const supabase = await createClient();
  const [learners, reviews, trainers] = await Promise.all([
    Promise.all(ids.map((id) => supabase.from("enrollments").select("id", { count: "exact", head: true }).eq("course_id", id).in("status", ["confirmed", "completed"]))),
    supabase.from("course_reviews").select("course_id, rating").in("course_id", ids),
    supabase.from("trainer_courses").select("course_id, trainer:profiles(full_name, avatar_url)").in("course_id", ids).returns<{ course_id: string; trainer: Teacher | null }[]>(),
  ]);

  ids.forEach((id, i) => out.set(id, { learners: learners[i].count ?? 0, rating: null, coTrainers: [] }));
  const sums = new Map<string, { sum: number; count: number }>();
  for (const r of reviews.data ?? []) {
    const s = sums.get(r.course_id) ?? { sum: 0, count: 0 };
    s.sum += r.rating; s.count += 1;
    sums.set(r.course_id, s);
  }
  for (const [id, s] of sums) {
    const d = out.get(id);
    if (d) d.rating = { avg: s.sum / s.count, count: s.count };
  }
  for (const t of trainers.data ?? []) {
    const d = out.get(t.course_id);
    if (d && t.trainer) d.coTrainers.push(t.trainer);
  }
  return out;
}

export type CourseStats = {
  total: number; totalMonth: number; totalPrev: number;
  published: number; publishedMonth: number; publishedPrev: number;
  inProgress: number; inProgressLearners: number;
  finished: number;
  completed: number; expired: number;
  drafts: number;
};

/** Indicateurs globaux de la page. Les formations « en cours » ont une session en cours ; « terminées » une session terminée. */
export async function loadCourseStats(): Promise<CourseStats | null> {
  const supabase = await createClient();
  const count = (build: (q: ReturnType<typeof supabase.from>) => PromiseLike<{ count: number | null; error: unknown }>) => build(supabase.from("courses")).then((r) => r.count ?? 0);
  const now = new Date().toISOString();
  const thisMonth = monthStart(), prevMonth = monthStart(-1);

  const [total, totalMonth, totalPrev, published, publishedMonth, publishedPrev, drafts, active, finishedSessions, completed, expired] = await Promise.all([
    count((t) => t.select("id", { count: "exact", head: true })),
    count((t) => t.select("id", { count: "exact", head: true }).gte("created_at", thisMonth)),
    count((t) => t.select("id", { count: "exact", head: true }).gte("created_at", prevMonth).lt("created_at", thisMonth)),
    count((t) => t.select("id", { count: "exact", head: true }).eq("status", "published")),
    count((t) => t.select("id", { count: "exact", head: true }).eq("status", "published").gte("published_at", thisMonth)),
    count((t) => t.select("id", { count: "exact", head: true }).eq("status", "published").gte("published_at", prevMonth).lt("published_at", thisMonth)),
    count((t) => t.select("id", { count: "exact", head: true }).eq("status", "draft")),
    supabase.from("sessions").select("id, course_id").eq("status", "scheduled").lte("start_at", now).gt("end_at", now),
    supabase.from("sessions").select("course_id").eq("status", "completed"),
    supabase.from("enrollments").select("id", { count: "exact", head: true }).eq("status", "completed"),
    supabase.from("enrollments").select("id", { count: "exact", head: true }).eq("status", "expired"),
  ]);

  const sessions = active.data ?? [];
  const inProgressLearners = sessions.length === 0 ? 0 : (await supabase.from("enrollments").select("id", { count: "exact", head: true })
    .in("session_id", sessions.map((s) => s.id)).in("status", ["confirmed", "completed"])).count ?? 0;

  return {
    total, totalMonth, totalPrev,
    published, publishedMonth, publishedPrev,
    inProgress: new Set(sessions.map((s) => s.course_id)).size,
    inProgressLearners,
    finished: new Set((finishedSessions.data ?? []).map((s) => s.course_id)).size,
    completed: completed.count ?? 0,
    expired: expired.count ?? 0,
    drafts,
  };
}

/** Catégories proposées dans le filtre. */
export async function loadCategoryOptions(): Promise<{ id: string; name: string }[]> {
  const supabase = await createClient();
  const { data } = await supabase.from("categories").select("id, name").order("name");
  return data ?? [];
}
