import { z } from "zod";

/** Paiements gérés par l'administration : filtres, libellés, calculs et validation (pur : testé unitairement). */

export const PAYMENT_STATUS_UI = {
  confirmed: { label: "Confirmé", tone: "bg-success/15 text-success" },
  pending: { label: "En attente", tone: "bg-warning/15 text-warning" },
  failed: { label: "Échoué", tone: "bg-danger/10 text-danger" },
  cancelled: { label: "Annulé", tone: "bg-line text-brand-dark" },
} as const;
export type PaymentStatus = keyof typeof PAYMENT_STATUS_UI;

/** Onglets : « failed » regroupe les paiements échoués et annulés. */
export const PAYMENT_TABS = ["confirmed", "pending", "failed"] as const;
export type PaymentTab = (typeof PAYMENT_TABS)[number];
export const PAYMENT_TAB_LABEL: Record<PaymentTab, string> = { confirmed: "Confirmées", pending: "En attente", failed: "Échouées" };

export const PAYMENT_METHODS = { mobile_money: "Mobile Money", card: "Carte bancaire", bank_transfer: "Virement bancaire", cash: "Espèces", cheque: "Chèque" } as const;
export type PaymentMethod = keyof typeof PAYMENT_METHODS;

export const PAYMENT_KINDS = { course: "Formations", certification: "Certifications", session: "Sessions", other: "Autres services" } as const;
export type PaymentKind = keyof typeof PAYMENT_KINDS;
export const KIND_COLOR: Record<PaymentKind, string> = { course: "#2563eb", certification: "#f59e0b", session: "#10a875", other: "#7c3aed" };

export type PaymentFilters = { q: string; course: string; status: string; from: string; to: string };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DAY = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;

/** Valeurs de filtre acceptées : tout le reste est ignoré ; une période inversée est remise dans l'ordre. */
export function parsePaymentFilters(sp: { q?: string; formation?: string; statut?: string; du?: string; au?: string }): PaymentFilters {
  let from = sp.du && DAY.test(sp.du) ? sp.du : "";
  let to = sp.au && DAY.test(sp.au) ? sp.au : "";
  if (from && to && from > to) [from, to] = [to, from];
  return {
    q: sp.q?.trim().slice(0, 100) ?? "",
    course: sp.formation && UUID.test(sp.formation) ? sp.formation : "",
    status: (PAYMENT_TABS as readonly string[]).includes(sp.statut ?? "") ? sp.statut! : "",
    from, to,
  };
}

export type PaymentRow = {
  id: string; reference: string; kind: PaymentKind; amount: number; method: PaymentMethod; status: PaymentStatus; paid_at: string; course_id: string | null;
  purpose: string; payer_name: string | null; payer_avatar: string | null; payer_is_company: boolean;
};
export type PaymentStats = {
  total: number; total_month: number; total_prev: number; confirmed: number; pending: number; failed: number;
  counts: { all: number; confirmed: number; pending: number; failed: number };
  by_kind: Record<PaymentKind, number>; months: { month: string; amount: number }[];
};
export type PaymentOptions = {
  courses: { id: string; title: string }[]; all_courses: { id: string; title: string; price: number }[];
  learners: { id: string; name: string }[]; organizations: { id: string; name: string }[];
};

/** Part d'un total en pourcentage avec une décimale, virgule française (« 89,0 % »). */
export function formatShare(part: number, total: number): string {
  const pct = total > 0 ? Math.round((part / total) * 1000) / 10 : 0;
  return `${pct.toLocaleString("fr-FR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} %`;
}

/** Axe des montants : « 8 M », « 500 k », « 0 » (millions et milliers de FCFA). */
export function compactAmount(v: number): string {
  if (v >= 1_000_000) return `${(v / 1_000_000).toLocaleString("fr-FR", { maximumFractionDigits: 1 })} M`;
  if (v >= 1000) return `${(v / 1000).toLocaleString("fr-FR", { maximumFractionDigits: 0 })} k`;
  return String(v);
}

export const NOTE_MAX = 500;
export const PROOF_MAX_MB = 5;
export const TRANSACTION_REF_MAX = 80;

/** Total à payer : montant, moins la remise (en FCFA ou en pourcentage du montant), plus les frais. */
export function paymentTotals(gross: number, discountValue: number, discountUnit: "fcfa" | "percent", fees: number) {
  const discount = discountUnit === "percent" ? Math.round((gross * Math.min(discountValue, 100)) / 100) : discountValue;
  return { discount, fees, total: gross - discount + fees };
}

const numeric = (msg: string) => z.string().trim().optional().transform((v) => (v ? Number(v.replace(/\s/g, "").replace(",", ".")) : 0))
  .pipe(z.number({ error: msg }).min(0, msg).max(10_000_000_000, msg));

export const createPaymentSchema = z.object({
  payerRef: z.string().regex(/^(learner|company):[0-9a-f-]{36}$/i, "Choisissez un apprenant ou une entreprise"),
  kind: z.enum(Object.keys(PAYMENT_KINDS) as [PaymentKind, ...PaymentKind[]], { error: "Type de paiement requis" }),
  courseId: z.string().optional().transform((v) => v ?? ""),
  sessionId: z.string().optional().transform((v) => v ?? ""),
  label: z.string().trim().max(200, "200 caractères au maximum").optional().transform((v) => v || null),
  amount: z.string().trim().min(1, "Montant requis").transform((v) => Number(v.replace(/\s/g, "")))
    .pipe(z.number({ error: "Montant invalide" }).int("Montant entier attendu").min(1, "Montant requis").max(10_000_000_000, "Montant trop élevé")),
  discount: numeric("Remise invalide"),
  discountUnit: z.enum(["fcfa", "percent"]).optional().transform((v) => v ?? "fcfa"),
  fees: numeric("Frais invalides"),
  method: z.enum(Object.keys(PAYMENT_METHODS) as [PaymentMethod, ...PaymentMethod[]], { error: "Mode de paiement requis" }),
  status: z.enum(["confirmed", "pending", "failed"], { error: "Statut requis" }),
  transactionRef: z.string().trim().max(TRANSACTION_REF_MAX, `${TRANSACTION_REF_MAX} caractères au maximum`).optional().transform((v) => v || null),
  paidDate: z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/, "Date requise"),
  paidTime: z.string().trim().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Heure requise"),
  proofPath: z.string().trim().max(300).optional().transform((v) => v || null),
  note: z.string().trim().max(NOTE_MAX, `${NOTE_MAX} caractères au maximum`).optional().transform((v) => v || null),
}).superRefine((d, ctx) => {
  if ((d.kind === "course" || d.kind === "certification") && !UUID.test(d.courseId)) ctx.addIssue({ code: "custom", path: ["courseId"], message: "Choisissez la formation concernée" });
  if ((d.kind === "session" || d.kind === "other") && !d.label) ctx.addIssue({ code: "custom", path: ["label"], message: "Précisez le service concerné" });
  if (d.sessionId && !UUID.test(d.sessionId)) ctx.addIssue({ code: "custom", path: ["sessionId"], message: "Session invalide" });
  const { discount, total } = paymentTotals(d.amount, d.discount, d.discountUnit, d.fees);
  if (d.discountUnit === "percent" && d.discount > 100) ctx.addIssue({ code: "custom", path: ["discount"], message: "100 % au maximum" });
  else if (discount > d.amount) ctx.addIssue({ code: "custom", path: ["discount"], message: "La remise dépasse le montant" });
  else if (total < 1) ctx.addIssue({ code: "custom", path: ["amount"], message: "Le total à payer doit être positif" });
}).transform((d) => {
  const t = paymentTotals(d.amount, d.discount, d.discountUnit, d.fees);
  const [kind, id] = d.payerRef.split(":");
  return { ...d, payer: kind as "learner" | "company", payerId: id, grossAmount: d.amount, discountAmount: t.discount, feesAmount: Math.round(t.fees), total: t.total, paidAt: new Date(`${d.paidDate}T${d.paidTime}:00Z`) };
}).refine((d) => !Number.isNaN(d.paidAt.getTime()), { path: ["paidDate"], message: "Date invalide" });
