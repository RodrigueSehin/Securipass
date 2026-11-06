import { createClient } from "@/lib/supabase/server";
import type { EvaluationFilters, EvaluationRow, EvaluationStats } from "./evaluations";

export type EvaluationsPage = { total: number; rows: EvaluationRow[]; failed: boolean };
export type EvaluationOptions = { courses: { id: string; title: string }[]; sessions: { id: string; title: string; course_id: string }[] };

export async function loadEvaluations(f: EvaluationFilters, limit: number, offset: number): Promise<EvaluationsPage> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_list_evaluations", {
    p_q: f.q, p_course: f.course || null, p_session: f.session || null, p_status: f.status, p_from: f.from || null, p_to: f.to || null,
    p_sort: f.asc ? "old" : "recent", p_limit: limit, p_offset: offset,
  });
  if (error || !data) return { total: 0, rows: [], failed: true };
  const d = data as { total: number; rows: EvaluationRow[] };
  return { total: d.total, rows: d.rows, failed: false };
}

export async function loadEvaluationStats(): Promise<EvaluationStats | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_evaluations_stats");
  return error || !data ? null : (data as EvaluationStats);
}

export async function loadEvaluationOptions(): Promise<EvaluationOptions> {
  const supabase = await createClient();
  const { data } = await supabase.rpc("admin_evaluations_options");
  return (data as EvaluationOptions | null) ?? { courses: [], sessions: [] };
}
