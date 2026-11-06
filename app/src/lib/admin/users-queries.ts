import { createClient } from "@/lib/supabase/server";
import type { UserFilters, UserRow } from "./users";

export type UsersPage = { total: number; rows: UserRow[]; failed: boolean };
type StatBlock = { count: number; month: number; prev: number };
export type UserStats = Record<"total" | "learner" | "instructor" | "company" | "admin", StatBlock>;

export async function loadUsers(f: UserFilters, limit: number, offset: number): Promise<UsersPage> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_list_users", {
    p_q: f.q, p_role: f.role, p_status: f.status, p_period: f.period, p_asc: f.asc, p_limit: limit, p_offset: offset,
  });
  if (error || !data) return { total: 0, rows: [], failed: true };
  const d = data as { total: number; rows: UserRow[] };
  return { total: d.total, rows: d.rows, failed: false };
}

export async function loadUserStats(): Promise<UserStats | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_users_stats");
  return error || !data ? null : (data as UserStats);
}

/** Un compte par identifiant (lecture du profil par la RLS du personnel, puis détails via la fonction d'administration). */
export async function loadUser(id: string): Promise<UserRow | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const supabase = await createClient();
  const { data: p } = await supabase.from("profiles").select("email").eq("id", id).maybeSingle<{ email: string }>();
  if (!p) return null;
  const page = await loadUsers({ q: p.email, role: "", status: "", period: "", asc: false }, 20, 0);
  return page.rows.find((r) => r.id === id) ?? null;
}
