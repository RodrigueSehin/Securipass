"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { FormState } from "@/lib/auth/actions";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { createBlogPostSchema } from "./blog";

const RESULTS = { published: "publie", draft: "brouillon", archived: "archive" } as const;

/** Publie, repasse en brouillon ou archive un contenu ; `back` ramène à la liste d'où l'action est partie (adresse interne uniquement). */
export async function setBlogStatus(formData: FormData): Promise<void> {
  const id = z.string().uuid().safeParse(formData.get("postId"));
  const status = z.enum(["draft", "published", "archived"]).safeParse(formData.get("status"));
  const raw = formData.get("back")?.toString() ?? "";
  const back = /^\/admin\/blog[^\s]*$/.test(raw) && !raw.includes("//") ? raw : "/admin/blog";
  if (!id.success || !status.success) redirect(back);
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_set_blog_status", { p_post: id.data, p_status: status.data });
  revalidatePath("/admin/blog");
  const sep = back.includes("?") ? "&" : "?";
  redirect(`${back}${sep}${error ? `erreur=${encodeURIComponent("L’opération a échoué. Réessayez.")}` : `resultat=${RESULTS[status.data]}`}`);
}

/** Crée un contenu (brouillon, publié ou programmé) avec ses médias joints ; l'identifiant d'URL vient du titre et reste unique. */
export async function createBlogPost(_prev: FormState, formData: FormData): Promise<FormState> {
  const values = Object.fromEntries([...formData.entries()].filter(([, v]) => typeof v === "string" && v.length < 21000)) as Record<string, string>;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Session expirée. Reconnectez-vous.", values };
  const { data: isAdmin } = await supabase.rpc("has_role", { _role: "admin" });
  if (!isAdmin) return { error: "Seul un administrateur peut effectuer cette action.", values };

  let files: unknown[] = [];
  try { files = formData.getAll("file").map((v) => JSON.parse(String(v))); } catch { return { error: "Média invalide.", values }; }
  const parsed = createBlogPostSchema.safeParse({ ...Object.fromEntries(formData), longBody: formData.get("body") ?? "", tags: formData.getAll("tag").map(String), files });
  if (!parsed.success) return { fieldErrors: parsed.error.flatten().fieldErrors, values };
  const d = parsed.data;
  if (!new RegExp(`^https://[^/]+/storage/v1/object/public/blog-covers/${user.id}/`).test(d.coverUrl)) return { fieldErrors: { coverUrl: ["Visuel invalide"] }, values };
  if (d.files.some((f) => !f.path.startsWith(`${user.id}/`) || f.path.includes(".."))) return { fieldErrors: { files: ["Média invalide"] }, values };
  if (d.status === "published" && d.publishAt.getTime() > Date.now() && !d.schedule) {
    return { fieldErrors: { publishDate: ["Cette date est dans le futur : activez « Programmer la publication »"] }, values };
  }

  const admin = createAdminClient();
  let created: { id: string } | null = null;
  for (let attempt = 0; attempt < 4 && !created; attempt++) {
    const slug = attempt === 0 ? d.slug : `${d.slug.slice(0, 90)}-${attempt + 1}`;
    const { data, error } = await admin.from("blog_posts").insert({
      slug, title: d.title, excerpt: d.excerpt, body: d.body, category: d.category, kind: d.kind, status: d.status, author_id: user.id,
      published_at: d.status === "published" ? d.publishAt.toISOString() : null, read_minutes: d.readMinutes, image: d.coverUrl,
      visibility: d.visibility, language: d.language, tags: [...new Set(d.tags)], seo_title: d.seoTitle, seo_description: d.seoDescription,
    }).select("id").single<{ id: string }>();
    if (data) { created = data; break; }
    if (error?.code !== "23505") return { error: "Impossible d’enregistrer le contenu. Réessayez.", values };
  }
  if (!created) return { error: "Impossible d’enregistrer le contenu. Réessayez.", values };
  if (d.files.length) await admin.from("blog_post_files").insert(d.files.map((f) => ({ post_id: created.id, storage_path: f.path, file_name: f.name, mime_type: f.type, size_bytes: f.size })));
  await admin.from("audit_logs").insert({ actor_id: user.id, action: "blog.create", entity_type: "blog_post", entity_id: created.id, metadata: { kind: d.kind, status: d.status, scheduled: d.schedule } });
  revalidatePath("/admin/blog");
  redirect(`/admin/blog?resultat=${d.status === "published" ? (d.schedule ? "programme" : "publie") : "brouillon"}`);
}

