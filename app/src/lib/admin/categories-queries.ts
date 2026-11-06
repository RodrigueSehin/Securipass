import { createClient } from "@/lib/supabase/server";
import type { CategoryFilters, CategoryRow, CategoryStats } from "./categories";

export type CategoriesPage = { total: number; rows: CategoryRow[]; failed: boolean };

export async function loadCategories(f: CategoryFilters, limit: number, offset: number): Promise<CategoriesPage> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_list_categories", { p_q: f.q, p_status: f.status, p_sort: f.sort, p_limit: limit, p_offset: offset });
  if (error || !data) return { total: 0, rows: [], failed: true };
  const d = data as { total: number; rows: CategoryRow[] };
  return { total: d.total, rows: d.rows, failed: false };
}

export async function loadCategoryStats(): Promise<CategoryStats | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_categories_stats");
  return error || !data ? null : (data as CategoryStats);
}
