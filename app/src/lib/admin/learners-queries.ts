import { createClient } from "@/lib/supabase/server";
import type { LearnerFilters, LearnerOptions, LearnerRow, LearnerStats } from "./learners";

export type LearnersPage = { total: number; rows: LearnerRow[]; failed: boolean };

export async function loadLearners(f: LearnerFilters, limit: number, offset: number): Promise<LearnersPage> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_list_learners", {
    p_q: f.q, p_tab: f.tab, p_course: f.course || null, p_org: f.org || null, p_status: f.status, p_sort: f.sort, p_limit: limit, p_offset: offset,
  });
  if (error || !data) return { total: 0, rows: [], failed: true };
  const d = data as { total: number; rows: LearnerRow[] };
  return { total: d.total, rows: d.rows, failed: false };
}

export async function loadLearnerStats(): Promise<LearnerStats | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_learners_stats");
  return error || !data ? null : (data as LearnerStats);
}

export async function loadLearnerOptions(): Promise<LearnerOptions> {
  const supabase = await createClient();
  const { data } = await supabase.rpc("admin_learners_options");
  return (data as LearnerOptions | null) ?? { courses: [], organizations: [] };
}
