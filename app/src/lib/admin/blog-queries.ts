import { createClient } from "@/lib/supabase/server";
import type { BlogDraft, BlogFilters, BlogRow, BlogStats } from "./blog";

export type BlogPage = { total: number; rows: BlogRow[]; failed: boolean };

export async function loadBlog(f: BlogFilters, limit: number, offset: number): Promise<BlogPage> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_list_blog", {
    p_q: f.q, p_kind: f.kind, p_category: f.category, p_status: f.status, p_from: f.from || null, p_to: f.to || null, p_limit: limit, p_offset: offset,
  });
  if (error || !data) return { total: 0, rows: [], failed: true };
  const d = data as { total: number; rows: BlogRow[] };
  return { total: d.total, rows: d.rows, failed: false };
}

export async function loadBlogStats(): Promise<BlogStats | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_blog_stats");
  return error || !data ? null : (data as BlogStats);
}

export async function loadBlogDrafts(): Promise<BlogDraft[]> {
  const supabase = await createClient();
  const { data } = await supabase.rpc("admin_blog_drafts", { p_limit: 3 });
  return (data as BlogDraft[] | null) ?? [];
}
