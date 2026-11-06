import { z } from "zod";

/** Factures, remboursements et avoirs : filtres, libellés, calculs et validation (pur : testé unitairement). */

export const BILLING_TABS = ["factures", "remboursements", "avoirs"] as const;
export type BillingTab = (typeof BILLING_TABS)[number];

export const INVOICE_STATUS_UI = {
  draft: { label: "Brouillon", tone: "bg-line text-brand-dark" },
  paid: { label: "Payée", tone: "bg-success/15 text-success" },
  pending: { label: "En attente", tone: "bg-warning/15 text-warning" },
  cancelled: { label: "Annulée", tone: "bg-danger/10 text-danger" },
} as const;
export type InvoiceStatus = keyof typeof INVOICE_STATUS_UI;

export const REFUND_STATUS_UI = {
  in_progress: { label: "En cours", tone: "bg-warning/15 text-warning" },
  refunded: { label: "Remboursé", tone: "bg-success/15 text-success" },
  rejected: { label: "Refusé", tone: "bg-danger/10 text-danger" },
} as const;
export type RefundStatus = keyof typeof REFUND_STATUS_UI;

export type BillingFilters = { tab: BillingTab; q: string; course: string; status: string; from: string; to: string };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DAY = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;

/** Valeurs de filtre acceptées : tout le reste est ignoré ; le statut doit exister pour l'onglet courant. */
export function parseBillingFilters(sp: { onglet?: string; q?: string; formation?: string; statut?: string; du?: string; au?: string }): BillingFilters {
  const tab = (BILLING_TABS as readonly string[]).includes(sp.onglet ?? "") ? (sp.onglet as BillingTab) : "factures";
  let from = sp.du && DAY.test(sp.du) ? sp.du : "";
  let to = sp.au && DAY.test(sp.au) ? sp.au : "";
  if (from && to && from > to) [from, to] = [to, from];
  const statuses = tab === "factures" ? Object.keys(INVOICE_STATUS_UI) : tab === "remboursements" ? Object.keys(REFUND_STATUS_UI) : [];
  return {
    tab, q: sp.q?.trim().slice(0, 100) ?? "",
    course: tab === "factures" && sp.formation && UUID.test(sp.formation) ? sp.formation : "",
    status: sp.statut && statuses.includes(sp.statut) ? sp.statut : "",
    from, to,
  };
}

type Payer = { payer_name: string | null; payer_avatar: string | null; payer_is_company: boolean };
export type InvoiceRow = Payer & { id: string; number: string; amount: number; status: InvoiceStatus; issued_at: string; purpose: string };
export type RefundRow = Payer & { id: string; number: string; amount: number; reason: string; status: RefundStatus; requested_at: string; invoice_number: string };
export type CreditNoteRow = Payer & { id: string; number: string; amount: number; reason: string; issued_at: string; invoice_number: string };
export type RecentRefund = { id: string; number: string; amount: number; status: RefundStatus; requested_at: string; payer_name: string | null };

export type BillingStats = {
  invoices: { count: number; month: number; prev: number; paid: number; pending: number };
  refunds: { count: number; amount: number }; credit_notes: number;
};
export type BillingOptions = {
  courses: { id: string; title: string }[]; all_courses: { id: string; title: string; price: number }[];
  learners: { id: string; name: string; email: string | null }[]; organizations: { id: string; name: string; email: string | null }[];
  refundable: { id: string; number: string; payer: string | null; amount: number; available: number }[];
};

/** Part en pourcentage avec une décimale, virgule française (« 89,1 % »). */
export function sharePct(part: number, total: number): string {
  const pct = total > 0 ? Math.round((part / total) * 1000) / 10 : 0;
  return `${pct.toLocaleString("fr-FR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} %`;
}

const optionalText = (max: number) => z.string().trim().max(max, `${max} caractères au maximum`).optional().transform((v) => v || null);
const amount = z.string().trim().min(1, "Montant requis").transform((v) => Number(v.replace(/\s/g, "")))
  .pipe(z.number({ error: "Montant invalide" }).int("Montant entier attendu").min(1, "Montant requis").max(10_000_000_000, "Montant trop élevé"));

/** Coordonnées de l'émetteur affichées sur l'aperçu des factures. */
export const ISSUER = { address: "Abidjan, Côte d’Ivoire", phone: "+225 07 97 14 67 72", email: "contact@securipass.ci" } as const;

export const PAYMENT_TERMS = { on_receipt: "À la réception", net7: "Sous 7 jours", net14: "Sous 14 jours", net30: "Sous 30 jours", net45: "Sous 45 jours" } as const;
export type PaymentTerms = keyof typeof PAYMENT_TERMS;
const TERM_DAYS: Record<PaymentTerms, number> = { on_receipt: 0, net7: 7, net14: 14, net30: 30, net45: 45 };
export const INVOICE_FILE_MAX_MB = 10;
export const INVOICE_FILE_TYPES = ["application/pdf", "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "image/jpeg", "image/png"] as const;

/** Échéance (AAAA-MM-JJ) = émission + délai des conditions de paiement. */
export function dueDateFor(issued: string, terms: PaymentTerms): string {
  const d = new Date(`${issued}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + TERM_DAYS[terms]);
  return d.toISOString().slice(0, 10);
}

/** Nombre de jours entre deux dates AAAA-MM-JJ (négatif si l'échéance précède l'émission). */
export const daysBetween = (from: string, to: string) => Math.round((Date.parse(`${to}T12:00:00Z`) - Date.parse(`${from}T12:00:00Z`)) / 86_400_000);

export type InvoiceLineInput = { quantity: number; unitPrice: number; discountPercent: number };
/** Montant d'une ligne après remise, arrondi au franc. */
export const lineAmount = (l: InvoiceLineInput) => Math.round(l.quantity * l.unitPrice * (1 - l.discountPercent / 100));
/** Sous-total (avant remises), remises et total d'une facture. */
export function invoiceTotals(lines: InvoiceLineInput[]) {
  const subtotal = lines.reduce((n, l) => n + l.quantity * l.unitPrice, 0);
  const total = lines.reduce((n, l) => n + lineAmount(l), 0);
  return { subtotal, discount: subtotal - total, total };
}

const invoiceLine = z.object({
  description: z.string().trim().min(2, "Désignation requise").max(200, "200 caractères au maximum"),
  quantity: z.number({ error: "Quantité invalide" }).int("Quantité entière").min(1, "Quantité requise").max(10000, "Quantité trop élevée"),
  unitPrice: z.number({ error: "Prix invalide" }).int("Prix entier").min(0, "Prix invalide").max(10_000_000_000, "Prix trop élevé"),
  discountPercent: z.number({ error: "Remise invalide" }).min(0, "Remise invalide").max(100, "100 % au maximum"),
});

export const createInvoiceSchema = z.object({
  payerRef: z.string().regex(/^(learner|company):[0-9a-f-]{36}$/i, "Choisissez un client"),
  courseId: z.string().optional().transform((v) => v ?? ""),
  subject: z.string().trim().min(2, "Objet requis").max(200, "200 caractères au maximum"),
  issuedDate: z.string().trim().regex(DAY, "Date d’émission requise"),
  dueDate: z.string().trim().regex(DAY, "Date d’échéance requise"),
  paymentTerms: z.enum(Object.keys(PAYMENT_TERMS) as [PaymentTerms, ...PaymentTerms[]], { error: "Conditions requises" }),
  acceptedMethods: z.array(z.enum(["mobile_money", "bank_transfer", "card", "cash", "cheque"])).max(5),
  lines: z.array(invoiceLine).min(1, "Ajoutez au moins une ligne").max(30, "30 lignes au maximum"),
  note: optionalText(500),
  sendEmail: z.enum(["0", "1"]).optional().transform((v) => v === "1"),
  clientEmail: z.string().trim().toLowerCase().max(254, "Adresse trop longue").optional().transform((v) => v ?? ""),
  intent: z.enum(["draft", "issue"]).optional().transform((v) => v ?? "issue"),
  files: z.array(z.object({ path: z.string().max(300), name: z.string().max(200), size: z.number().int().positive().max(INVOICE_FILE_MAX_MB * 1024 * 1024) })).max(10, "10 fichiers au maximum"),
}).superRefine((d, ctx) => {
  if (d.courseId && !UUID.test(d.courseId)) ctx.addIssue({ code: "custom", path: ["courseId"], message: "Formation invalide" });
  if (d.dueDate < d.issuedDate) ctx.addIssue({ code: "custom", path: ["dueDate"], message: "L’échéance précède l’émission" });
  if (invoiceTotals(d.lines).total < 1) ctx.addIssue({ code: "custom", path: ["lines"], message: "Le total de la facture doit être positif" });
  if (d.sendEmail && !z.string().email().safeParse(d.clientEmail).success) ctx.addIssue({ code: "custom", path: ["clientEmail"], message: "Adresse e-mail valide requise" });
}).transform((d) => {
  const [kind, id] = d.payerRef.split(":");
  const t = invoiceTotals(d.lines);
  return { ...d, payer: kind as "learner" | "company", payerId: id, total: t.total, issuedAt: new Date(`${d.issuedDate}T12:00:00Z`) };
});

export const createRefundSchema = z.object({
  type: z.enum(["refund", "credit"], { error: "Type requis" }),
  invoiceId: z.string().regex(UUID, "Choisissez une facture"),
  amount,
  reason: z.string().trim().min(2, "Motif requis (2 caractères au minimum)").max(500, "500 caractères au maximum"),
});
