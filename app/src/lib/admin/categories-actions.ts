"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { FormState } from "@/lib/auth/actions";
import { slugify, withSuffix } from "@/lib/courses/slug";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

import { createCategorySchema } from "./categories";

const RESULTS = { active: "active", pending: "attente", inactive: "inactive" } as const;

/** Change le statut d'une catégorie ; `back` ramène à la liste d'où l'action est partie (adresse interne uniquement). */
export async function setCategoryStatus(formData: FormData): Promise<void> {
  const id = z.string().uuid().safeParse(formData.get("categoryId"));
  const status = z.enum(["active", "pending", "inactive"]).safeParse(formData.get("status"));
  const raw = formData.get("back")?.toString() ?? "";
  const back = /^\/admin\/categories[^\s]*$/.test(raw) && !raw.includes("//") ? raw : "/admin/categories";
  if (!id.success || !status.success) redirect(back);
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_set_category_status", { p_category: id.data, p_status: status.data });
  revalidatePath("/admin/categories");
  const sep = back.includes("?") ? "&" : "?";
  redirect(`${back}${sep}${error ? `erreur=${encodeURIComponent("L’opération a échoué. Réessayez.")}` : `resultat=${RESULTS[status.data]}`}`);
}

/** Crée une catégorie (nom, code unique, parente éventuelle, visuel, statut, visibilité) ; tracé dans le journal d'audit. */
export async function createCategory(_prev: FormState, formData: FormData): Promise<FormState> {
  const values = Object.fromEntries([...formData.entries()].filter(([, v]) => typeof v === "string")) as Record<string, string>;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Session expirée. Reconnectez-vous.", values };
  const { data: isAdmin } = await supabase.rpc("has_role", { _role: "admin" });
  if (!isAdmin) return { error: "Seul un administrateur peut effectuer cette action.", values };

  const parsed = createCategorySchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { fieldErrors: parsed.error.flatten().fieldErrors, values };
  const d = parsed.data;

  const admin = createAdminClient();
  if (d.parentId) {
    const { data: parent } = await admin.from("categories").select("id, parent_id").eq("id", d.parentId).maybeSingle<{ id: string; parent_id: string | null }>();
    if (!parent) return { fieldErrors: { parentId: ["Catégorie parente introuvable"] }, values };
    if (parent.parent_id) return { fieldErrors: { parentId: ["Une sous-catégorie ne peut pas être parente"] }, values };
  }
  if (d.coverUrl && !new RegExp(`^https://[^/]+/storage/v1/object/public/category-covers/${user.id}/`).test(d.coverUrl)) return { fieldErrors: { coverUrl: ["Image invalide"] }, values };

  const base = slugify(d.name);
  let created: { id: string } | null = null;
  for (let attempt = 0; attempt < 4 && !created; attempt++) {
    const { data, error } = await admin.from("categories").insert({
      name: d.name, slug: withSuffix(base, attempt), code: d.code, parent_id: d.parentId || null, display_order: d.order,
      description: d.shortDescription, long_description: d.longDescription, icon: d.icon, color: d.color, cover_url: d.coverUrl,
      status: d.status, visible_platform: d.visiblePlatform, visible_catalogue: d.visibleCatalogue,
    }).select("id").single<{ id: string }>();
    if (data) { created = data; break; }
    if (error?.code !== "23505") return { error: "Impossible de créer la catégorie. Réessayez.", values };
    if (error.message.includes("categories_code_key")) return { fieldErrors: { code: ["Ce code est déjà utilisé"] }, values };
    // Conflit sur le slug : on retente avec un suffixe
  }
  if (!created) return { error: "Impossible de créer la catégorie. Réessayez.", values };

  await admin.from("audit_logs").insert({ actor_id: user.id, action: "category.create", entity_type: "category", entity_id: created.id, metadata: { code: d.code, status: d.status } });
  revalidatePath("/admin/categories");
  redirect(formData.get("afterSub") === "1" ? `/admin/categories/nouveau?parent=${created.id}&resultat=cree` : "/admin/categories?resultat=cree");
}
