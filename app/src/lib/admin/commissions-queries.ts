import { createClient } from "@/lib/supabase/server";
import type { PayoutInstructor } from "./payout-create";
import type { CommissionFilters, CommissionOptions, CommissionRow, CommissionStats, PayoutRow, RecentPayout } from "./commissions";

export type Paged<T> = { total: number; rows: T[]; failed: boolean };

export async function loadCommissions(f: CommissionFilters, limit: number, offset: number): Promise<Paged<CommissionRow>> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_list_commissions", {
    p_q: f.q, p_month: f.month, p_status: f.status, p_instructor: f.instructor || null, p_limit: limit, p_offset: offset,
  });
  if (error || !data) return { total: 0, rows: [], failed: true };
  const d = data as { total: number; rows: CommissionRow[] };
  return { total: d.total, rows: d.rows, failed: false };
}

export async function loadPayouts(limit: number, offset: number): Promise<Paged<PayoutRow>> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_list_payouts", { p_limit: limit, p_offset: offset });
  if (error || !data) return { total: 0, rows: [], failed: true };
  const d = data as { total: number; rows: PayoutRow[] };
  return { total: d.total, rows: d.rows, failed: false };
}

export async function loadCommissionStats(): Promise<CommissionStats | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_commissions_stats");
  return error || !data ? null : (data as CommissionStats);
}

export async function loadCommissionOptions(): Promise<CommissionOptions> {
  const supabase = await createClient();
  const { data } = await supabase.rpc("admin_commissions_options");
  return (data as CommissionOptions | null) ?? { instructors: [], months: [] };
}

export async function loadRecentPayouts(limit = 3): Promise<RecentPayout[]> {
  const supabase = await createClient();
  const { data } = await supabase.rpc("admin_recent_payouts", { p_limit: limit });
  return (data as RecentPayout[] | null) ?? [];
}

/** Formateurs ayant des commissions à verser, avec leurs lignes (formation / session) sélectionnables. */
export async function loadPayoutOptions(): Promise<PayoutInstructor[] | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_payout_options");
  return error || !data ? null : ((data as { instructors: PayoutInstructor[] }).instructors);
}
