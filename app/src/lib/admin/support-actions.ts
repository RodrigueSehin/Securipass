"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { FormState } from "@/lib/auth/actions";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { SUPPORT_CATEGORY_KEYS, SUPPORT_PRIORITY_KEYS, createTicketSchema, isAllowedFile, messageSchema } from "./support";

const uuid = z.string().uuid();
const STATUSES = ["new", "in_progress", "waiting", "resolved", "archived"] as const;

/** `back` ramène à la liste d'où l'action est partie (adresse interne uniquement). */
function backTo(formData: FormData): string {
  const raw = formData.get("back")?.toString() ?? "";
  return /^\/admin\/support[^\s]*$/.test(raw) && !raw.includes("//") ? raw : "/admin/support";
}
function done(back: string, key: "resultat" | "erreur", value: string): never {
  revalidatePath("/admin/support", "layout");
  redirect(`${back}${back.includes("?") ? "&" : "?"}${key}=${encodeURIComponent(value)}`);
}
const FAIL = "L’opération a échoué. Réessayez.";

export async function setSupportStatus(formData: FormData): Promise<void> {
  const back = backTo(formData);
  const id = uuid.safeParse(formData.get("ticketId"));
  const status = z.enum(STATUSES).safeParse(formData.get("status"));
  if (!id.success || !status.success) done(back, "erreur", "Demande invalide.");
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_set_support_status", { p_ticket: id.data, p_status: status.data });
  if (error) done(back, "erreur", error.message.includes("archive_requires_resolved") ? "Seul un ticket résolu peut être archivé." : FAIL);
  done(back, "resultat", status.data);
}

export async function setSupportPriority(formData: FormData): Promise<void> {
  const back = backTo(formData);
  const id = uuid.safeParse(formData.get("ticketId"));
  const priority = z.enum(SUPPORT_PRIORITY_KEYS).safeParse(formData.get("priority"));
  if (!id.success || !priority.success) done(back, "erreur", "Demande invalide.");
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_set_support_priority", { p_ticket: id.data, p_priority: priority.data });
  if (error) done(back, "erreur", FAIL);
  done(back, "resultat", "priorite");
}

/** Prend le ticket en charge (`me` = 1) ou le désassigne. */
export async function assignSupportTicket(formData: FormData): Promise<void> {
  const back = backTo(formData);
  const id = uuid.safeParse(formData.get("ticketId"));
  if (!id.success) done(back, "erreur", "Demande invalide.");
  const me = formData.get("me") === "1";
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_assign_support_ticket", { p_ticket: id.data, p_me: me });
  if (error) done(back, "erreur", error.message.includes("ticket_closed") ? "Ce ticket est clos : rouvrez-le d’abord." : FAIL);
  done(back, "resultat", me ? "assigne" : "desassigne");
}

/** Ouvre un ticket pour un demandeur ; tracé dans le journal d'audit. */
export async function createSupportTicket(_prev: FormState, formData: FormData): Promise<FormState> {
  const values = Object.fromEntries([...formData.entries()].filter(([, v]) => typeof v === "string" && v.length < 5000)) as Record<string, string>;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Session expirée. Reconnectez-vous.", values };
  const { data: isAdmin } = await supabase.rpc("has_role", { _role: "admin" });
  if (!isAdmin) return { error: "Seul un administrateur peut effectuer cette action.", values };

  const parsed = createTicketSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { fieldErrors: parsed.error.flatten().fieldErrors, values };
  const d = parsed.data;
  const { error } = await supabase.rpc("admin_create_support_ticket", {
    p_requester: d.requesterId, p_subject: d.subject, p_description: d.description, p_category: d.category, p_priority: d.priority, p_course: d.courseId,
  });
  if (error) return { error: error.message.includes("requester_not_found") ? "Demandeur introuvable." : error.message.includes("course_not_found") ? "Formation introuvable." : "Impossible d’enregistrer la demande. Vérifiez les informations.", values };
  revalidatePath("/admin/support", "layout");
  redirect("/admin/support?resultat=cree");
}

export async function setSupportCategory(formData: FormData): Promise<void> {
  const back = backTo(formData);
  const id = uuid.safeParse(formData.get("ticketId"));
  const category = z.enum(SUPPORT_CATEGORY_KEYS).safeParse(formData.get("category"));
  if (!id.success || !category.success) done(back, "erreur", "Demande invalide.");
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_set_support_category", { p_ticket: id.data, p_category: category.data });
  if (error) done(back, "erreur", FAIL);
  done(back, "resultat", "categorie");
}

/** Réassigne le ticket à un administrateur ou à l'équipe support (`assignee` vide = personne). */
export async function reassignSupportTicket(formData: FormData): Promise<void> {
  const back = backTo(formData);
  const id = uuid.safeParse(formData.get("ticketId"));
  const raw = formData.get("assignee")?.toString() ?? "";
  const assignee = raw === "" ? { success: true as const, data: null } : uuid.safeParse(raw);
  if (!id.success || !assignee.success) done(back, "erreur", "Demande invalide.");
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_reassign_support_ticket", { p_ticket: id.data, p_assignee: assignee.data });
  if (error) done(back, "erreur", error.message.includes("ticket_closed") ? "Ce ticket est clos : rouvrez-le d’abord." : error.message.includes("assignee_invalid") ? "Seuls un administrateur ou un membre du support peuvent être responsables." : FAIL);
  done(back, "resultat", "reassigne");
}

/** Envoie une réponse à l'utilisateur ou enregistre une note interne ; la page se rafraîchit, le formulaire se vide. */
export async function postSupportMessage(_prev: FormState, formData: FormData): Promise<FormState> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Session expirée. Reconnectez-vous." };
  const { data: isAdmin } = await supabase.rpc("has_role", { _role: "admin" });
  if (!isAdmin) return { error: "Seul un administrateur peut effectuer cette action." };
  const parsed = messageSchema.safeParse({ ticketId: formData.get("ticketId"), body: formData.get("body"), internal: formData.get("internal") ?? "0" });
  if (!parsed.success) return { fieldErrors: parsed.error.flatten().fieldErrors, values: { body: formData.get("body")?.toString().slice(0, 5000) ?? "", internal: formData.get("internal")?.toString() ?? "0" } };
  const d = parsed.data;
  const { error } = await supabase.rpc("admin_post_support_message", { p_ticket: d.ticketId, p_body: d.body, p_internal: d.internal });
  if (error) return { error: error.message.includes("ticket_closed") ? "Ce ticket est archivé : rouvrez-le d’abord." : "Impossible d’envoyer le message. Réessayez.", values: { body: d.body, internal: d.internal ? "1" : "0" } };
  revalidatePath("/admin/support", "layout");
  return { message: d.internal ? "Note interne enregistrée." : "Réponse envoyée." };
}

/** Enregistre une pièce jointe déjà déposée par le navigateur dans le bucket privé (dossier de l'administrateur). */
export async function addSupportFile(ticketId: string, path: string, name: string, size: number, mime: string): Promise<{ error?: string }> {
  if (!uuid.safeParse(ticketId).success || !isAllowedFile(mime, size)) return { error: "Fichier refusé : PDF, image ou texte de 10 Mo au maximum." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_add_support_file", { p_ticket: ticketId, p_path: path, p_name: name, p_size: size, p_mime: mime });
  if (error) return { error: error.message.includes("ticket_closed") ? "Ce ticket est archivé : rouvrez-le d’abord." : "Impossible d’ajouter la pièce jointe. Réessayez." };
  revalidatePath("/admin/support", "layout");
  return {};
}

/** Retire une pièce jointe du ticket puis supprime le fichier du stockage. */
export async function removeSupportFile(formData: FormData): Promise<void> {
  const back = backTo(formData);
  const id = uuid.safeParse(formData.get("fileId"));
  if (!id.success) done(back, "erreur", "Demande invalide.");
  const supabase = await createClient();
  const { data: path, error } = await supabase.rpc("admin_remove_support_file", { p_file: id.data });
  if (error) done(back, "erreur", FAIL);
  if (typeof path === "string") await createAdminClient().storage.from("support-files").remove([path]).catch(() => undefined);
  done(back, "resultat", "fichier-retire");
}

/** Copie un ticket en un nouveau ticket « nouveau » et l'ouvre. */
export async function duplicateSupportTicket(formData: FormData): Promise<void> {
  const back = backTo(formData);
  const id = uuid.safeParse(formData.get("ticketId"));
  if (!id.success) done(back, "erreur", "Demande invalide.");
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_duplicate_support_ticket", { p_ticket: id.data });
  if (error || !data) done(back, "erreur", FAIL);
  revalidatePath("/admin/support", "layout");
  redirect(`/admin/support/${(data as { id: string }).id}?resultat=duplique`);
}
