import { createClient } from "@/lib/supabase/server";
import type { TrainerFilters, TrainerRow, TrainerStats } from "./trainers";

export type TrainersPage = { total: number; rows: TrainerRow[]; failed: boolean };

export async function loadTrainers(f: TrainerFilters, limit: number, offset: number): Promise<TrainersPage> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_list_trainers", {
    p_q: f.q, p_category: f.category || null, p_status: f.status, p_contract: f.contract, p_sort: f.sort, p_limit: limit, p_offset: offset,
  });
  if (error || !data) return { total: 0, rows: [], failed: true };
  const d = data as { total: number; rows: TrainerRow[] };
  return { total: d.total, rows: d.rows, failed: false };
}

export async function loadTrainerStats(): Promise<TrainerStats | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_trainers_stats");
  return error || !data ? null : (data as TrainerStats);
}

/** Catégories proposées dans le filtre « Spécialité ». */
export async function loadSpecialtyOptions(): Promise<{ id: string; name: string }[]> {
  const supabase = await createClient();
  const { data } = await supabase.from("categories").select("id, name").order("name").returns<{ id: string; name: string }[]>();
  return data ?? [];
}
