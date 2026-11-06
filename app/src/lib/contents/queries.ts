import { createClient } from "@/lib/supabase/server";
import type { WizardContent } from "./wizard";

export type OwnContent = WizardContent & {
  id: string;
  module_id: string;
  content_type: string;
  title: string;
  status: "draft" | "published";
  created_at: string;
  updated_at: string;
  module: { id: string; title: string; position: number; course: { id: string; title: string; instructor_id: string } };
};

const CONTENT_COLUMNS = "id, module_id, content_type, title, description, body, external_url, file_path, file_name, file_size_bytes, file_mime, evaluation_id, duration_minutes, position, required_level, prerequisite_content_id, is_required, counts_in_progress, allow_download, allow_comments, show_in_outline, is_visible, notify_learners, publish_at, available_until, status, created_at, updated_at";

/** Contenu d'un formateur (RLS) avec son module et sa formation ; null s'il n'existe pas ou n'appartient pas à l'utilisateur. */
export async function getOwnContent(id: string): Promise<OwnContent | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase
    .from("learning_contents")
    .select(`${CONTENT_COLUMNS}, module:course_modules(id, title, position, course:courses(id, title, instructor_id))`)
    .eq("id", id)
    .maybeSingle<OwnContent>();
  if (!data || data.module?.course.instructor_id !== user.id) return null;
  return data;
}

export type ContentLookups = {
  courses: { id: string; title: string }[];
  modules: { id: string; title: string; position: number; courseId: string }[];
  quizzes: { id: string; title: string; courseId: string; status: string }[];
  /** Contenus du formateur, pour choisir un prérequis. */
  contents: { id: string; title: string; moduleId: string; courseId: string }[];
};

/** Formations, modules, quiz et contenus du formateur : listes des sélecteurs de l'assistant. */
export async function loadContentLookups(): Promise<ContentLookups> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const empty: ContentLookups = { courses: [], modules: [], quizzes: [], contents: [] };
  if (!user) return empty;
  const { data: courses } = await supabase.from("courses").select("id, title").eq("instructor_id", user.id).neq("status", "archived").order("title")
    .returns<{ id: string; title: string }[]>();
  const ids = (courses ?? []).map((c) => c.id);
  if (ids.length === 0) return empty;
  const [mods, quizzes] = await Promise.all([
    supabase.from("course_modules").select("id, title, position, course_id").in("course_id", ids).order("position")
      .returns<{ id: string; title: string; position: number; course_id: string }[]>(),
    supabase.from("evaluations").select("id, title, course_id, status").in("course_id", ids).eq("kind", "quiz").neq("status", "archived").order("title")
      .returns<{ id: string; title: string; course_id: string; status: string }[]>(),
  ]);
  const modules = (mods.data ?? []).map((m) => ({ id: m.id, title: m.title, position: m.position, courseId: m.course_id }));
  const courseOf = new Map(modules.map((m) => [m.id, m.courseId]));
  const moduleIds = modules.map((m) => m.id);
  const { data: contents } = moduleIds.length
    ? await supabase.from("learning_contents").select("id, title, module_id").in("module_id", moduleIds).order("position")
        .returns<{ id: string; title: string; module_id: string }[]>()
    : { data: [] };
  return {
    courses: courses ?? [],
    modules,
    quizzes: (quizzes.data ?? []).map((q) => ({ id: q.id, title: q.title, courseId: q.course_id, status: q.status })),
    contents: (contents ?? []).map((c) => ({ id: c.id, title: c.title, moduleId: c.module_id, courseId: courseOf.get(c.module_id) ?? "" })),
  };
}

export type Attachment = {
  id: string;
  kind: "file" | "link";
  name: string;
  file_path: string | null;
  url: string | null;
  size_bytes: number;
  mime_type: string | null;
};

export async function listAttachments(contentId: string): Promise<Attachment[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("content_attachments")
    .select("id, kind, name, file_path, url, size_bytes, mime_type")
    .eq("content_id", contentId)
    .order("created_at")
    .returns<Attachment[]>();
  return data ?? [];
}
