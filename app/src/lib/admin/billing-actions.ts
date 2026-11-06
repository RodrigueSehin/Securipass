"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { FormState } from "@/lib/auth/actions";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { createInvoiceSchema, createRefundSchema } from "./billing";

const BACK = /^\/admin\/factures[^\s]*$/;
const safeBack = (raw: string) => (BACK.test(raw) && !raw.includes("//") ? raw : "/admin/factures");
const withResult = (back: string, error: boolean, result: string, message = "L’opération a échoué. Réessayez.") =>
  `${back}${back.includes("?") ? "&" : "?"}${error ? `erreur=${encodeURIComponent(message)}` : `resultat=${result}`}`;

/** Émet une facture brouillon, marque une facture en attente comme payée, ou annule une facture brouillon ou en attente. */
export async function setInvoiceStatus(formData: FormData): Promise<void> {
  const id = z.string().uuid().safeParse(formData.get("invoiceId"));
  const status = z.enum(["pending", "paid", "cancelled"]).safeParse(formData.get("status"));
  const back = safeBack(formData.get("back")?.toString() ?? "");
  if (!id.success || !status.success) redirect(back);
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_set_invoice_status", { p_invoice: id.data, p_status: status.data });
  revalidatePath("/admin/factures");
  redirect(withResult(back, !!error, status.data === "paid" ? "payee" : status.data === "pending" ? "emise" : "annulee", error?.message.includes("invoice_locked") ? "Cette facture ne peut plus changer ainsi : son statut est définitif." : undefined));
}

/** Marque un remboursement en cours comme effectué ou le refuse. */
export async function setRefundStatus(formData: FormData): Promise<void> {
  const id = z.string().uuid().safeParse(formData.get("refundId"));
  const status = z.enum(["refunded", "rejected"]).safeParse(formData.get("status"));
  const back = safeBack(formData.get("back")?.toString() ?? "");
  if (!id.success || !status.success) redirect(back);
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_set_refund_status", { p_refund: id.data, p_status: status.data });
  revalidatePath("/admin/factures");
  redirect(withResult(back, !!error, status.data === "refunded" ? "rembourse" : "refuse", error?.message.includes("refund_locked") ? "Ce remboursement est déjà traité." : undefined));
}

async function adminContext() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Session expirée. Reconnectez-vous." } as const;
  const { data: isAdmin } = await supabase.rpc("has_role", { _role: "admin" });
  if (!isAdmin) return { error: "Seul un administrateur peut effectuer cette action." } as const;
  return { user, admin: createAdminClient() } as const;
}

/** Crée une facture détaillée (lignes, échéance, conditions) en brouillon ou émise (en attente) ; tracée dans le journal d'audit. */
export async function createInvoice(_prev: FormState, formData: FormData): Promise<FormState> {
  const values = Object.fromEntries([...formData.entries()].filter(([, v]) => typeof v === "string" && v.length < 2000)) as Record<string, string>;
  const ctx = await adminContext();
  if ("error" in ctx) return { error: ctx.error, values };
  const { user, admin } = ctx;

  let lines: unknown[] = [];
  let files: unknown[] = [];
  try {
    lines = formData.getAll("line").map((v) => JSON.parse(String(v)));
    files = formData.getAll("file").map((v) => JSON.parse(String(v)));
  } catch { return { error: "Données de facture invalides.", values }; }
  const parsed = createInvoiceSchema.safeParse({ ...Object.fromEntries(formData), acceptedMethods: formData.getAll("method").map(String), lines, files });
  if (!parsed.success) return { fieldErrors: parsed.error.flatten().fieldErrors, values };
  const d = parsed.data;
  if (d.issuedAt.getTime() > Date.now() + 86_400_000) return { fieldErrors: { issuedDate: ["La date ne peut pas être dans le futur"] }, values };
  if (d.files.some((f) => !f.path.startsWith(`${user.id}/`) || f.path.includes(".."))) return { fieldErrors: { files: ["Pièce jointe invalide"] }, values };

  const table = d.payer === "learner" ? "profiles" : "organizations";
  const { data: payer } = await admin.from(table).select("id").eq("id", d.payerId).maybeSingle();
  if (!payer) return { fieldErrors: { payerRef: ["Client introuvable"] }, values };
  if (d.courseId) {
    const { data } = await admin.from("courses").select("id").eq("id", d.courseId).maybeSingle();
    if (!data) return { fieldErrors: { courseId: ["Formation introuvable"] }, values };
  }

  const status = d.intent === "draft" ? "draft" : "pending";
  const { data: created, error } = await admin.from("invoices").insert({
    learner_id: d.payer === "learner" ? d.payerId : null, organization_id: d.payer === "company" ? d.payerId : null, course_id: d.courseId || null,
    label: d.subject, subject: d.subject, amount: d.total, status, issued_at: d.issuedAt.toISOString(), due_date: d.dueDate, payment_terms: d.paymentTerms,
    accepted_methods: d.acceptedMethods, client_email: d.clientEmail || null, send_email: d.sendEmail, note: d.note, created_by: user.id,
  }).select("id, number").single<{ id: string; number: string }>();
  if (error || !created) return { error: "Impossible d’enregistrer la facture. Vérifiez les informations.", values };

  await admin.from("invoice_lines").insert(d.lines.map((l, i) => ({ invoice_id: created.id, position: i + 1, description: l.description, quantity: l.quantity, unit_price: l.unitPrice, discount_percent: l.discountPercent })));
  if (d.files.length) await admin.from("invoice_files").insert(d.files.map((f) => ({ invoice_id: created.id, storage_path: f.path, file_name: f.name, size_bytes: f.size })));
  await admin.from("audit_logs").insert({ actor_id: user.id, action: "invoice.create", entity_type: "invoice", entity_id: created.id, metadata: { number: created.number, amount: d.total, status } });
  revalidatePath("/admin/factures");
  redirect(`/admin/factures?resultat=${status === "draft" ? "facture-brouillon" : "facture-creee"}`);
}

/** Crée un remboursement (en cours) ou un avoir sur une facture payée, dans la limite du montant encore disponible. */
export async function createRefund(_prev: FormState, formData: FormData): Promise<FormState> {
  const values = Object.fromEntries([...formData.entries()].filter(([, v]) => typeof v === "string" && v.length < 2000)) as Record<string, string>;
  const ctx = await adminContext();
  if ("error" in ctx) return { error: ctx.error, values };
  const { user, admin } = ctx;
  const parsed = createRefundSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { fieldErrors: parsed.error.flatten().fieldErrors, values };
  const d = parsed.data;

  const { data: invoice } = await admin.from("invoices").select("id, amount, status").eq("id", d.invoiceId).maybeSingle<{ id: string; amount: number; status: string }>();
  if (!invoice || invoice.status !== "paid") return { fieldErrors: { invoiceId: ["Seule une facture payée peut être remboursée"] }, values };
  const [refunds, credits] = await Promise.all([
    admin.from("refunds").select("amount").eq("invoice_id", invoice.id).neq("status", "rejected").returns<{ amount: number }[]>(),
    admin.from("credit_notes").select("amount").eq("invoice_id", invoice.id).returns<{ amount: number }[]>(),
  ]);
  const used = [...(refunds.data ?? []), ...(credits.data ?? [])].reduce((n, r) => n + Number(r.amount), 0);
  const available = Number(invoice.amount) - used;
  if (d.amount > available) return { fieldErrors: { amount: [`Au plus ${new Intl.NumberFormat("fr-FR").format(available)} FCFA restent disponibles sur cette facture`] }, values };

  const base = { invoice_id: invoice.id, amount: d.amount, reason: d.reason, created_by: user.id };
  const { data: created, error } = d.type === "refund"
    ? await admin.from("refunds").insert(base).select("id, number").single<{ id: string; number: string }>()
    : await admin.from("credit_notes").insert(base).select("id, number").single<{ id: string; number: string }>();
  if (error || !created) return { error: "Impossible d’enregistrer la demande. Réessayez.", values };
  await admin.from("audit_logs").insert({ actor_id: user.id, action: d.type === "refund" ? "refund.create" : "credit_note.create", entity_type: d.type === "refund" ? "refund" : "credit_note", entity_id: created.id, metadata: { number: created.number, amount: d.amount } });
  revalidatePath("/admin/factures");
  redirect(`/admin/factures?onglet=${d.type === "refund" ? "remboursements" : "avoirs"}&resultat=${d.type === "refund" ? "remboursement-cree" : "avoir-cree"}`);
}
