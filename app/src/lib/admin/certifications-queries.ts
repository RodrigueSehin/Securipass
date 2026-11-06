import { createClient } from "@/lib/supabase/server";
import type { CertificationFilters, CertificationOptions, CertificationRow, CertificationStats } from "./certifications";

export type CertificationsPage = { total: number; rows: CertificationRow[]; failed: boolean };

export async function loadCertifications(f: CertificationFilters, limit: number, offset: number): Promise<CertificationsPage> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_list_certifications", {
    p_q: f.q, p_category: f.category || null, p_status: f.status, p_tab: f.tab, p_limit: limit, p_offset: offset,
  });
  if (error || !data) return { total: 0, rows: [], failed: true };
  const d = data as { total: number; rows: CertificationRow[] };
  return { total: d.total, rows: d.rows, failed: false };
}

export async function loadCertificationStats(): Promise<CertificationStats | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_certifications_stats");
  return error || !data ? null : (data as CertificationStats);
}

export async function loadCertificationOptions(): Promise<CertificationOptions> {
  const supabase = await createClient();
  const { data } = await supabase.rpc("admin_certifications_options");
  return { categories: [], all_categories: [], templates: [], courses: [], ...((data as Partial<CertificationOptions> | null) ?? {}) };
}
