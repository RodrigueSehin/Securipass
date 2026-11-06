import { createClient } from "@/lib/supabase/server";
import type { PaymentFilters, PaymentOptions, PaymentRow, PaymentStats } from "./payments";

export type PaymentsPage = { total: number; rows: PaymentRow[]; failed: boolean };

export async function loadPayments(f: PaymentFilters, limit: number, offset: number): Promise<PaymentsPage> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_list_payments", {
    p_q: f.q, p_course: f.course || null, p_status: f.status, p_from: f.from || null, p_to: f.to || null, p_limit: limit, p_offset: offset,
  });
  if (error || !data) return { total: 0, rows: [], failed: true };
  const d = data as { total: number; rows: PaymentRow[] };
  return { total: d.total, rows: d.rows, failed: false };
}

export async function loadPaymentStats(): Promise<PaymentStats | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_payments_stats");
  return error || !data ? null : (data as PaymentStats);
}

export async function loadPaymentOptions(): Promise<PaymentOptions> {
  const supabase = await createClient();
  const { data } = await supabase.rpc("admin_payments_options");
  return { courses: [], all_courses: [], learners: [], organizations: [], ...((data as Partial<PaymentOptions> | null) ?? {}) };
}
