import { createClient } from "@/lib/supabase/server";
import { missingSteps, type SessionDraft } from "./wizard";

export type WizardCourse = {
  id: string; title: string; description: string | null; cover_url: string | null; duration_minutes: number;
  default_capacity: number | null; delivery_mode: "onsite" | "online" | "hybrid"; language: string; level: string;
  category: { slug: string; name: string } | null;
};

/** Formations du formateur sur lesquelles une session peut être planifiée (les archivées sont exclues). */
export async function loadWizardCourses(): Promise<WizardCourse[]> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];
  const { data } = await supabase
    .from("courses")
    .select("id, title, description, cover_url, duration_minutes, default_capacity, delivery_mode, language, level, category:categories(slug, name)")
    .eq("instructor_id", user.id).neq("status", "archived").order("title")
    .returns<WizardCourse[]>();
  return data ?? [];
}

export async function getSessionDraft(id: string): Promise<{ id: string; data: SessionDraft } | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase.from("session_drafts").select("id, data").eq("id", id).eq("instructor_id", user.id)
    .maybeSingle<{ id: string; data: SessionDraft }>();
  return data ?? null;
}

/** Sessions en cours de création : titre et première étape incomplète pour reprendre l'assistant. */
export async function listDrafts(): Promise<{ id: string; title: string; step: number }[]> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];
  const { data } = await supabase.from("session_drafts").select("id, data").eq("instructor_id", user.id).order("updated_at", { ascending: false }).limit(10)
    .returns<{ id: string; data: SessionDraft }[]>();
  return (data ?? []).map((d) => ({ id: d.id, title: d.data.title ?? "", step: missingSteps(d.data)[0] ?? 4 }));
}
