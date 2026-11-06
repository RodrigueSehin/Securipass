import { createClient } from "@/lib/supabase/server";
import type { BillingFilters, BillingOptions, BillingStats, CreditNoteRow, InvoiceRow, RecentRefund, RefundRow } from "./billing";

export type BillingPage<T> = { total: number; rows: T[]; failed: boolean };

async function list<T>(fn: string, args: Record<string, unknown>): Promise<BillingPage<T>> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc(fn, args);
  if (error || !data) return { total: 0, rows: [], failed: true };
  const d = data as { total: number; rows: T[] };
  return { total: d.total, rows: d.rows, failed: false };
}

const range = (f: BillingFilters) => ({ p_from: f.from || null, p_to: f.to || null });

export const loadInvoices = (f: BillingFilters, limit: number, offset: number) =>
  list<InvoiceRow>("admin_list_invoices", { p_q: f.q, p_course: f.course || null, p_status: f.status, ...range(f), p_limit: limit, p_offset: offset });
export const loadRefunds = (f: BillingFilters, limit: number, offset: number) =>
  list<RefundRow>("admin_list_refunds", { p_q: f.q, p_status: f.status, ...range(f), p_limit: limit, p_offset: offset });
export const loadCreditNotes = (f: BillingFilters, limit: number, offset: number) =>
  list<CreditNoteRow>("admin_list_credit_notes", { p_q: f.q, ...range(f), p_limit: limit, p_offset: offset });

export async function loadBillingStats(): Promise<BillingStats | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_billing_stats");
  return error || !data ? null : (data as BillingStats);
}

export async function loadBillingOptions(): Promise<BillingOptions> {
  const supabase = await createClient();
  const { data } = await supabase.rpc("admin_billing_options");
  return { courses: [], all_courses: [], learners: [], organizations: [], refundable: [], ...((data as Partial<BillingOptions> | null) ?? {}) };
}

export async function loadRecentRefunds(): Promise<RecentRefund[]> {
  const supabase = await createClient();
  const { data } = await supabase.rpc("admin_recent_refunds", { p_limit: 3 });
  return (data as RecentRefund[] | null) ?? [];
}
