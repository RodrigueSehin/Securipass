import { createClient } from "@/lib/supabase/server";
import { paramsFromRun, storedParams, type ReportFilters, type ReportParams } from "./report-generation";
import type { RecentReport, ReportType, ReportsOverview } from "./reports";

const NO_FILTERS: ReportFilters = { course: "", session: "", instructor: "", status: "" };
const nul = (v: string) => v || null;

export async function loadReportsOverview(month: string, f: ReportFilters = NO_FILTERS): Promise<ReportsOverview | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_reports_overview", {
    p_month: month, p_course: nul(f.course), p_session: nul(f.session), p_instructor: nul(f.instructor), p_status: f.status,
  });
  return error || !data ? null : (data as ReportsOverview);
}

export async function loadRecentReports(limit = 5): Promise<RecentReport[]> {
  const supabase = await createClient();
  const { data } = await supabase.rpc("admin_recent_reports", { p_limit: limit });
  return (data as RecentReport[] | null) ?? [];
}

/** Lignes d'un rapport ; null si la base refuse ou échoue. */
export async function loadReportRows(type: ReportType, month: string, f: ReportFilters = NO_FILTERS): Promise<(string | number)[][] | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_report_rows", {
    p_type: type, p_month: month, p_course: nul(f.course), p_session: nul(f.session), p_instructor: nul(f.instructor), p_status: f.status,
  });
  return error || !Array.isArray(data) ? null : (data as (string | number)[][]);
}

/** Inscrit un rapport généré dans l'historique ; un échec n'empêche pas le téléchargement. */
export async function logReport(params: ReportParams, rows: number): Promise<void> {
  const supabase = await createClient();
  await supabase.rpc("admin_log_report", {
    p_type: params.type, p_month: params.month, p_name: params.name, p_rows: rows, p_format: params.format, p_params: storedParams(params), p_description: params.description || null,
  });
}

/** Paramètres d'un rapport déjà généré (pour le régénérer à l'identique) ; null s'il n'existe pas ou s'il est illisible. */
export async function loadRunParams(id: string): Promise<ReportParams | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const supabase = await createClient();
  const { data } = await supabase.from("report_runs").select("type, period, name, format, description, params").eq("id", id).maybeSingle();
  return data ? paramsFromRun(data) : null;
}

export type GeneratorOptions = {
  courses: { id: string; title: string }[];
  sessions: { id: string; title: string; courseId: string; start: string }[];
  instructors: { id: string; name: string }[];
};

/** Listes proposées par le formulaire : formations, sessions (hors brouillons) et formateurs ayant au moins une formation. */
export async function loadGeneratorOptions(): Promise<GeneratorOptions> {
  const supabase = await createClient();
  const [courses, sessions] = await Promise.all([
    supabase.from("courses").select("id, title, instructor:profiles!courses_instructor_id_fkey(id, full_name, email)").order("title").limit(1000)
      .returns<{ id: string; title: string; instructor: { id: string; full_name: string | null; email: string } | null }[]>(),
    supabase.from("sessions").select("id, title, course_id, start_at").neq("status", "draft").order("start_at", { ascending: false }).limit(500)
      .returns<{ id: string; title: string; course_id: string; start_at: string }[]>(),
  ]);
  const people = new Map<string, string>();
  for (const c of courses.data ?? []) if (c.instructor) people.set(c.instructor.id, c.instructor.full_name?.trim() || c.instructor.email);
  return {
    courses: (courses.data ?? []).map((c) => ({ id: c.id, title: c.title })),
    sessions: (sessions.data ?? []).map((s) => ({ id: s.id, title: s.title, courseId: s.course_id, start: s.start_at })),
    instructors: [...people].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name, "fr")),
  };
}
