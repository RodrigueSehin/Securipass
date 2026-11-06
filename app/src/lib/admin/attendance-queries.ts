import { createClient } from "@/lib/supabase/server";
import type { AttendanceOptions, AttendanceRow, AttendanceSessionHead, AttendanceStats, AttendanceSummaryRow } from "./attendance";

export type Page<T> = { total: number; rows: T[]; failed: boolean };

export async function loadAttendanceOptions(): Promise<AttendanceOptions> {
  const supabase = await createClient();
  const { data } = await supabase.rpc("admin_attendance_options");
  return (data as AttendanceOptions | null) ?? { courses: [], sessions: [] };
}

export async function loadAttendanceStats(course: string, session: string, date: string): Promise<AttendanceStats | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_attendance_stats", { p_course: course || null, p_session: session || null, p_date: date || null });
  return error || !data ? null : (data as AttendanceStats);
}

export async function loadAttendanceList(session: string, limit: number, offset: number): Promise<Page<AttendanceRow> & { session: AttendanceSessionHead | null }> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_list_attendance", { p_session: session, p_limit: limit, p_offset: offset });
  if (error || !data) return { total: 0, rows: [], failed: true, session: null };
  const d = data as { total: number; rows: AttendanceRow[]; session: AttendanceSessionHead | null };
  return { total: d.total, rows: d.rows, failed: false, session: d.session };
}

export async function loadAttendanceBySession(course: string, date: string, limit: number, offset: number): Promise<Page<AttendanceSummaryRow>> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_attendance_by_session", { p_course: course || null, p_date: date || null, p_limit: limit, p_offset: offset });
  if (error || !data) return { total: 0, rows: [], failed: true };
  const d = data as { total: number; rows: AttendanceSummaryRow[] };
  return { total: d.total, rows: d.rows, failed: false };
}

export async function loadAttendanceByCourse(limit: number, offset: number): Promise<Page<AttendanceSummaryRow>> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_attendance_by_course", { p_limit: limit, p_offset: offset });
  if (error || !data) return { total: 0, rows: [], failed: true };
  const d = data as { total: number; rows: AttendanceSummaryRow[] };
  return { total: d.total, rows: d.rows, failed: false };
}
