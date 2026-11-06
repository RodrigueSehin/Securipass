import { createClient } from "@/lib/supabase/server";
import type { SessionFilters, SessionRow, SessionStats } from "./sessions";

export type SessionsPage = { total: number; rows: SessionRow[]; failed: boolean };

export async function loadSessions(f: SessionFilters, limit: number, offset: number): Promise<SessionsPage> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_list_sessions", {
    p_q: f.q, p_course: f.course || null, p_status: f.status, p_mode: f.mode, p_from: f.from || null, p_to: f.to || null,
    p_sort: f.asc ? "old" : "recent", p_limit: limit, p_offset: offset,
  });
  if (error || !data) return { total: 0, rows: [], failed: true };
  const d = data as { total: number; rows: SessionRow[] };
  return { total: d.total, rows: d.rows, failed: false };
}

export async function loadSessionStats(): Promise<SessionStats | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_sessions_stats");
  return error || !data ? null : (data as SessionStats);
}

export async function loadSessionCourses(): Promise<{ id: string; title: string }[]> {
  const supabase = await createClient();
  const { data } = await supabase.rpc("admin_sessions_options");
  return (data as { courses: { id: string; title: string }[] } | null)?.courses ?? [];
}
