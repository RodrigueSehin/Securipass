import { createClient } from "@/lib/supabase/server";
import type { EnrollmentFilters, EnrollmentRow, EnrollmentStats } from "./enrollments";

export type EnrollmentsPage = { total: number; rows: EnrollmentRow[]; failed: boolean };
export type EnrollmentOptions = { courses: { id: string; title: string }[]; sessions: { id: string; title: string; course_id: string }[] };

export async function loadEnrollments(f: EnrollmentFilters, limit: number, offset: number): Promise<EnrollmentsPage> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_list_enrollments", {
    p_q: f.q, p_course: f.course || null, p_session: f.session || null, p_status: f.status, p_from: f.from || null, p_to: f.to || null,
    p_sort: f.asc ? "old" : "recent", p_limit: limit, p_offset: offset,
  });
  if (error || !data) return { total: 0, rows: [], failed: true };
  const d = data as { total: number; rows: EnrollmentRow[] };
  return { total: d.total, rows: d.rows, failed: false };
}

export async function loadEnrollmentStats(): Promise<EnrollmentStats | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_enrollments_stats");
  return error || !data ? null : (data as EnrollmentStats);
}

export async function loadEnrollmentOptions(): Promise<EnrollmentOptions> {
  const supabase = await createClient();
  const { data } = await supabase.rpc("admin_enrollments_options");
  return (data as EnrollmentOptions | null) ?? { courses: [], sessions: [] };
}
