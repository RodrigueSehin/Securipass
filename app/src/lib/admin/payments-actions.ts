"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { FormState } from "@/lib/auth/actions";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { createPaymentSchema } from "./payments";

const RESULTS = { confirmed: "confirme", failed: "echoue", cancelled: "annule" } as const;

/** Confirme, déclare échoué ou annule un paiement en attente ; `back` ramène à la liste d'où l'action est partie (adresse interne uniquement). */
export async function setPaymentStatus(formData: FormData): Promise<void> {
  const id = z.string().uuid().safeParse(formData.get("paymentId"));
  const status = z.enum(["confirmed", "failed", "cancelled"]).safeParse(formData.get("status"));
  const raw = formData.get("back")?.toString() ?? "";
  const back = /^\/admin\/paiements[^\s]*$/.test(raw) && !raw.includes("//") ? raw : "/admin/paiements";
  if (!id.success || !status.success) redirect(back);
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_set_payment_status", { p_payment: id.data, p_status: status.data });
  revalidatePath("/admin/paiements");
  const sep = back.includes("?") ? "&" : "?";
  const msg = error?.message.includes("payment_locked") ? "Ce paiement n’est plus en attente : son statut est définitif." : "L’opération a échoué. Réessayez.";
  redirect(`${back}${sep}${error ? `erreur=${encodeURIComponent(msg)}` : `resultat=${RESULTS[status.data]}`}`);
}

/** Enregistre un paiement saisi par l'administration (apprenant ou entreprise) avec remise, frais et justificatif ; tracé dans le journal d'audit. */
export async function createPayment(_prev: FormState, formData: FormData): Promise<FormState> {
  const values = Object.fromEntries([...formData.entries()].filter(([, v]) => typeof v === "string" && v.length < 2000)) as Record<string, string>;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Session expirée. Reconnectez-vous.", values };
  const { data: isAdmin } = await supabase.rpc("has_role", { _role: "admin" });
  if (!isAdmin) return { error: "Seul un administrateur peut effectuer cette action.", values };

  const parsed = createPaymentSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { fieldErrors: parsed.error.flatten().fieldErrors, values };
  const d = parsed.data;
  if (d.paidAt.getTime() > Date.now() + 5 * 60_000) return { fieldErrors: { paidDate: ["La date ne peut pas être dans le futur"] }, values };
  if (d.proofPath && (!d.proofPath.startsWith(`${user.id}/`) || d.proofPath.includes(".."))) return { fieldErrors: { proofPath: ["Justificatif invalide"] }, values };

  const admin = createAdminClient();
  if (d.payer === "learner") {
    const { data } = await admin.from("profiles").select("id").eq("id", d.payerId).maybeSingle();
    if (!data) return { fieldErrors: { payerRef: ["Apprenant introuvable"] }, values };
  } else {
    const { data } = await admin.from("organizations").select("id").eq("id", d.payerId).maybeSingle();
    if (!data) return { fieldErrors: { payerRef: ["Entreprise introuvable"] }, values };
  }
  const withCourse = d.kind === "course" || d.kind === "certification";
  if (withCourse) {
    const { data } = await admin.from("courses").select("id").eq("id", d.courseId).maybeSingle();
    if (!data) return { fieldErrors: { courseId: ["Formation introuvable"] }, values };
  }
  if (d.sessionId) {
    const { data } = await admin.from("sessions").select("id, course_id").eq("id", d.sessionId).maybeSingle<{ id: string; course_id: string }>();
    if (!data || (withCourse && data.course_id !== d.courseId)) return { fieldErrors: { sessionId: ["Session introuvable pour cette formation"] }, values };
  }

  const { data: created, error } = await admin.from("payments").insert({
    kind: d.kind, learner_id: d.payer === "learner" ? d.payerId : null, organization_id: d.payer === "company" ? d.payerId : null,
    course_id: withCourse ? d.courseId : null, session_id: d.sessionId || null, label: d.label,
    amount: d.total, gross_amount: d.grossAmount, discount_amount: d.discountAmount, fees_amount: d.feesAmount,
    method: d.method, status: d.status, transaction_ref: d.transactionRef, proof_path: d.proofPath, paid_at: d.paidAt.toISOString(), note: d.note, created_by: user.id,
  }).select("id, reference").single<{ id: string; reference: string }>();
  if (error || !created) return { error: "Impossible d’enregistrer le paiement. Vérifiez les informations.", values };
  await admin.from("audit_logs").insert({ actor_id: user.id, action: "payment.create", entity_type: "payment", entity_id: created.id, metadata: { reference: created.reference, amount: d.total, status: d.status } });
  revalidatePath("/admin/paiements");
  redirect("/admin/paiements?resultat=cree");
}

