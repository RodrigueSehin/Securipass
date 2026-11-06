import { createClient } from "@/lib/supabase/server";
import type { CompanyFilters, CompanyOptions, CompanyRow, CompanyStats } from "./companies";

export type CompaniesPage = { total: number; rows: CompanyRow[]; failed: boolean };

export async function loadCompanies(f: CompanyFilters, limit: number, offset: number): Promise<CompaniesPage> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_list_companies", {
    p_q: f.q, p_industry: f.industry, p_status: f.status, p_city: f.city, p_sort: f.sort, p_limit: limit, p_offset: offset,
  });
  if (error || !data) return { total: 0, rows: [], failed: true };
  const d = data as { total: number; rows: CompanyRow[] };
  return { total: d.total, rows: d.rows, failed: false };
}

export async function loadCompanyStats(): Promise<CompanyStats | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_companies_stats");
  return error || !data ? null : (data as CompanyStats);
}

export async function loadCompanyOptions(): Promise<CompanyOptions> {
  const supabase = await createClient();
  const { data } = await supabase.rpc("admin_companies_options");
  return (data as CompanyOptions | null) ?? { industries: [], cities: [] };
}
