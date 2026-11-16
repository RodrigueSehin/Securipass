import { createClient } from "@/lib/supabase/server";
import type { HistoryEvent, SupportDetail, SupportFilters, SupportRequester, SupportRow, SupportStaff, SupportStats } from "./support";

export type SupportPage = { total: number; rows: SupportRow[]; failed: boolean };

export async function loadSupportTickets(f: SupportFilters, limit: number, offset: number): Promise<SupportPage> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_list_support_tickets", {
    p_tab: f.tab, p_q: f.q, p_category: f.category, p_status: f.status, p_priority: f.priority, p_limit: limit, p_offset: offset,
  });
  if (error || !data) return { total: 0, rows: [], failed: true };
  const d = data as { total: number; rows: SupportRow[] };
  return { total: d.total, rows: d.rows, failed: false };
}

export async function loadSupportStats(): Promise<SupportStats | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_support_stats");
  return error || !data ? null : (data as SupportStats);
}

/** Ticket complet (demandeur, formation, messages, pièces jointes) ; null s'il n'existe pas ou si la lecture échoue. */
export async function loadSupportDetail(id: string): Promise<SupportDetail | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_get_support_ticket", { p_ticket: id });
  return error || !data ? null : (data as SupportDetail);
}

/** Événements du ticket, du plus récent au plus ancien. */
export async function loadSupportHistory(id: string): Promise<HistoryEvent[]> {
  const supabase = await createClient();
  const { data } = await supabase.rpc("admin_support_history", { p_ticket: id });
  return (data as HistoryEvent[] | null) ?? [];
}

export async function loadSupportStaff(): Promise<SupportStaff[]> {
  const supabase = await createClient();
  const { data } = await supabase.rpc("admin_support_staff");
  return (data as SupportStaff[] | null) ?? [];
}

export async function loadCourseOptions(): Promise<{ id: string; title: string }[]> {
  const supabase = await createClient();
  const { data } = await supabase.from("courses").select("id, title").order("title").limit(1000);
  return data ?? [];
}

export async function loadSupportRequesters(): Promise<SupportRequester[] | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_support_requesters");
  return error || !data ? null : (data as SupportRequester[]);
}
