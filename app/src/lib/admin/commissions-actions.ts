"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { FormState } from "@/lib/auth/actions";
import { createClient } from "@/lib/supabase/server";
import { createPayoutSchema, payoutDate } from "./payout-create";

const uuid = z.string().uuid();

/** `back` ramène à la page d'où l'action est partie (adresse interne uniquement). */
function backTo(formData: FormData): string {
  const raw = formData.get("back")?.toString() ?? "";
  return /^\/admin\/commissions[^\s]*$/.test(raw) && !raw.includes("//") ? raw : "/admin/commissions";
}
function done(back: string, key: "resultat" | "erreur", value: string): never {
  revalidatePath("/admin/commissions");
  redirect(`${back}${back.includes("?") ? "&" : "?"}${key}=${encodeURIComponent(value)}`);
}

/** Verse les commissions en attente d'un formateur pour une formation et une session. */
export async function payCommissions(formData: FormData): Promise<void> {
  const back = backTo(formData);
  const instructor = uuid.safeParse(formData.get("instructorId"));
  const course = uuid.safeParse(formData.get("courseId"));
  const rawSession = formData.get("sessionId")?.toString() ?? "";
  const session = rawSession === "" ? { success: true as const, data: null } : uuid.safeParse(rawSession);
  if (!instructor.success || !course.success || !session.success) done(back, "erreur", "Demande invalide.");
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_pay_commissions", { p_instructor: instructor.data, p_course: course.data, p_session: session.data });
  if (error) done(back, "erreur", error.message.includes("nothing_to_pay") ? "Aucune commission à verser." : "Le versement a échoué. Réessayez.");
  done(back, "resultat", "verse");
}

/** Change le taux appliqué aux paiements confirmés à partir de maintenant. */
export async function setCommissionRate(formData: FormData): Promise<void> {
  const back = backTo(formData);
  const rate = z.coerce.number().min(0).max(100).safeParse(formData.get("rate")?.toString().replace(",", "."));
  if (!rate.success) done(back, "erreur", "Le taux doit être compris entre 0 et 100 %.");
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_set_commission_rate", { p_rate: Math.round(rate.data * 100) / 100 });
  if (error) done(back, "erreur", "Le taux n’a pas pu être enregistré.");
  done(back, "resultat", "taux");
}

/** Enregistre un versement détaillé : commissions choisies, mode, coordonnées, motif et justificatif ; tracé dans le journal d'audit. */
export async function createPayout(_prev: FormState, formData: FormData): Promise<FormState> {
  const values = Object.fromEntries([...formData.entries()].filter(([k, v]) => typeof v === "string" && v.length < 2000 && k !== "commissionIds")) as Record<string, string>;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Session expirée. Reconnectez-vous.", values };
  const { data: isAdmin } = await supabase.rpc("has_role", { _role: "admin" });
  if (!isAdmin) return { error: "Seul un administrateur peut effectuer cette action.", values };

  const parsed = createPayoutSchema.safeParse({ ...Object.fromEntries(formData), commissionIds: formData.getAll("commissionIds").map(String) });
  if (!parsed.success) return { fieldErrors: parsed.error.flatten().fieldErrors, values };
  const d = parsed.data;
  const paidAt = payoutDate(d.paidDate);
  if (!paidAt) return { fieldErrors: { paidDate: ["La date ne peut pas être dans le futur"] }, values };
  if (d.proofPath && (!d.proofPath.startsWith(`${user.id}/`) || d.proofPath.includes(".."))) return { fieldErrors: { proofPath: ["Justificatif invalide"] }, values };

  const { error } = await supabase.rpc("admin_create_payout", {
    p_instructor: d.instructorId, p_commissions: d.commissionIds, p_method: d.method, p_paid_at: paidAt.toISOString(), p_fees: d.fees,
    p_holder: d.holder, p_bank: d.bank, p_account: d.account, p_reason: d.reason, p_proof: d.proofPath,
  });
  if (error) {
    const m = error.message;
    const msg = m.includes("commissions_invalid") ? "Certaines commissions ne sont plus à verser. Actualisez la page."
      : m.includes("fees_invalid") ? "Les frais dépassent le montant des commissions."
      : "Impossible d’enregistrer le versement. Vérifiez les informations.";
    return { error: msg, values };
  }
  revalidatePath("/admin/commissions");
  redirect("/admin/commissions?onglet=versements&resultat=verse");
}
