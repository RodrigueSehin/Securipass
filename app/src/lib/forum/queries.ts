import { createClient } from "@/lib/supabase/server";

export type ForumPost = { id: string; author_id: string; body: string; created_at: string };
export type ForumThread = { id: string; title: string; author_id: string; created_at: string; last_post_at: string; posts: ForumPost[] };
export type ForumData = {
  userId: string;
  course: { id: string; title: string; forum_enabled: boolean; allow_discussions: boolean; instructor_id: string };
  threads: ForumThread[];
  authors: Map<string, { name: string; instructor: boolean }>;
  /** Formateur de la formation ou personnel : peut supprimer questions et réponses. */
  moderator: boolean;
};

/**
 * Forum d'une formation. La RLS limite la lecture au formateur, au personnel et aux inscrits (tant que le forum est activé) ;
 * les noms des auteurs sont réduits au prénom et à l'initiale par la fonction SQL forum_authors.
 */
export async function loadForum(courseId: string): Promise<ForumData | null> {
  if (!/^[0-9a-f-]{36}$/i.test(courseId)) return null;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: course } = await supabase.from("courses").select("id, title, forum_enabled, allow_discussions, instructor_id").eq("id", courseId)
    .maybeSingle<ForumData["course"]>();
  if (!course) return null;

  const [threadsRes, authorsRes, rolesRes] = await Promise.all([
    supabase.from("forum_threads")
      .select("id, title, author_id, created_at, last_post_at, posts:forum_posts(id, author_id, body, created_at)")
      .eq("course_id", courseId).order("last_post_at", { ascending: false }).returns<ForumThread[]>(),
    supabase.rpc("forum_authors", { p_course: courseId }),
    supabase.from("user_roles").select("roles(code)").eq("user_id", user.id),
  ]);
  const roles = (rolesRes.data ?? []).flatMap((r) => {
    const rel = r.roles as unknown as { code: string } | { code: string }[] | null;
    return Array.isArray(rel) ? rel.map((x) => x.code) : rel ? [rel.code] : [];
  });
  const authors = new Map<string, { name: string; instructor: boolean }>();
  for (const a of (authorsRes.data ?? []) as { id: string; display_name: string; is_instructor: boolean }[]) {
    authors.set(a.id, { name: a.display_name, instructor: a.is_instructor });
  }
  return {
    userId: user.id,
    course,
    threads: (threadsRes.data ?? []).map((t) => ({ ...t, posts: [...(t.posts ?? [])].sort((a, b) => a.created_at.localeCompare(b.created_at)) })),
    authors,
    moderator: course.instructor_id === user.id || roles.some((r) => ["admin", "pedagogy_manager", "support"].includes(r)),
  };
}
