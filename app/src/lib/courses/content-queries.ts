import { createClient } from "@/lib/supabase/server";
import type { ContentType } from "./labels";
import type { LibraryContent } from "./content-library";

/**
 * Bibliothèque des contenus du formateur, toutes formations confondues. Les lectures passent par la RLS : seules
 * les formations dont il est propriétaire sont lues.
 */
export async function loadContentLibrary(): Promise<{
  rows: LibraryContent[];
  courses: { id: string; title: string }[];
  modules: { id: string; title: string; position: number; courseId: string; courseTitle: string }[];
  quizCount: number;
  failed: boolean;
}> {
  const empty = { rows: [], courses: [], modules: [], quizCount: 0 };
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ...empty, failed: true };

  const { data: ownCourses, error } = await supabase.from("courses").select("id, title").eq("instructor_id", user.id)
    .returns<{ id: string; title: string }[]>();
  if (error) return { ...empty, failed: true };
  const courses = ownCourses ?? [];
  const courseIds = courses.map((c) => c.id);
  const courseTitle = new Map(courses.map((c) => [c.id, c.title]));
  if (courseIds.length === 0) return { ...empty, courses, failed: false };

  const [modRes, quizRes] = await Promise.all([
    supabase.from("course_modules").select("id, title, position, course_id").in("course_id", courseIds)
      .returns<{ id: string; title: string; position: number; course_id: string }[]>(),
    supabase.from("evaluations").select("id", { count: "exact", head: true }).in("course_id", courseIds).eq("status", "published"),
  ]);
  const modules = (modRes.data ?? []).map((m) => ({
    id: m.id, title: m.title, position: m.position, courseId: m.course_id, courseTitle: courseTitle.get(m.course_id) ?? "",
  }));
  const moduleById = new Map(modules.map((m) => [m.id, m]));
  const moduleIds = modules.map((m) => m.id);

  const contentRes = moduleIds.length
    ? await supabase.from("learning_contents")
        .select("id, module_id, title, content_type, description, duration_minutes, status, position, created_at, updated_at")
        .in("module_id", moduleIds)
        .returns<{
          id: string; module_id: string; title: string; content_type: ContentType; description: string | null;
          duration_minutes: number; status: "draft" | "published"; position: number; created_at: string; updated_at: string;
        }[]>()
    : { data: [] };
  const contents = contentRes.data ?? [];
  const contentIds = contents.map((c) => c.id);

  const completionRes = contentIds.length
    ? await supabase.from("content_completions").select("content_id").in("content_id", contentIds)
        .returns<{ content_id: string }[]>()
    : { data: [] };
  const completions = new Map<string, number>();
  for (const row of completionRes.data ?? []) completions.set(row.content_id, (completions.get(row.content_id) ?? 0) + 1);

  const rows: LibraryContent[] = contents.flatMap((c) => {
    const m = moduleById.get(c.module_id);
    if (!m) return [];
    return [{
      id: c.id,
      title: c.title,
      type: c.content_type,
      description: c.description,
      durationMinutes: c.duration_minutes,
      status: c.status,
      createdAt: c.created_at,
      updatedAt: c.updated_at,
      position: c.position,
      moduleId: m.id,
      moduleTitle: m.title,
      modulePosition: m.position,
      courseId: m.courseId,
      courseTitle: m.courseTitle,
      completions: completions.get(c.id) ?? 0,
    }];
  });

  return { rows, courses, modules, quizCount: quizRes.count ?? 0, failed: false };
}
