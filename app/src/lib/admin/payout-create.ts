import { z } from "zod";
import { PAYOUT_METHODS } from "./commissions";

/** Création d'un versement de commissions : règles de saisie et totaux (pur : testé unitairement). */

export type PayoutMethod = keyof typeof PAYOUT_METHODS;
export const PAYOUT_METHOD_KEYS = Object.keys(PAYOUT_METHODS) as [PayoutMethod, ...PayoutMethod[]];
export const PAYOUT_PROOF_MAX_MB = 10;

export const BANKS = ["Société Générale Côte d’Ivoire (SGCI)", "Ecobank Côte d’Ivoire", "NSIA Banque", "BICICI", "Banque Atlantique", "Coris Bank International", "SIB", "Autre établissement"] as const;
export const MOBILE_OPERATORS = ["Orange Money", "MTN MoMo", "Moov Money", "Wave"] as const;

/** Champs de coordonnées demandés selon le mode : virement (titulaire, banque, IBAN), Mobile Money (titulaire, opérateur, numéro), sinon aucun. */
export function payoutDetails(method: PayoutMethod | ""): { holder: boolean; bank: boolean; account: boolean; bankLabel: string; accountLabel: string } {
  if (method === "bank_transfer") return { holder: true, bank: true, account: true, bankLabel: "Établissement bancaire", accountLabel: "Numéro de compte / IBAN" };
  if (method === "mobile_money") return { holder: true, bank: true, account: true, bankLabel: "Opérateur", accountLabel: "Numéro Mobile Money" };
  return { holder: false, bank: false, account: false, bankLabel: "", accountLabel: "" };
}

/** Totaux affichés : nombre de lignes, montant des commissions, frais et net à verser (jamais négatif). */
export function payoutTotals(amounts: number[], fees: number) {
  const total = amounts.reduce((n, a) => n + a, 0);
  const f = Math.min(Math.max(0, Math.round(fees) || 0), total);
  return { count: amounts.length, total, fees: f, net: total - f };
}

const uuid = z.string().uuid();
const fees = z.string().trim().optional().transform((v) => (v ? Number(v.replace(/\s/g, "").replace(",", ".")) : 0))
  .pipe(z.number({ error: "Frais invalides" }).int("Montant entier attendu").min(0, "Frais invalides").max(10_000_000_000, "Frais invalides"));

export const createPayoutSchema = z.object({
  instructorId: z.string().uuid("Choisissez un formateur"),
  commissionIds: z.array(uuid).min(1, "Sélectionnez au moins une commission").max(500, "500 commissions au maximum"),
  method: z.enum(PAYOUT_METHOD_KEYS, { error: "Mode de versement requis" }),
  paidDate: z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/, "Date requise"),
  fees,
  holder: z.string().trim().max(120, "120 caractères au maximum").optional().transform((v) => v || null),
  bank: z.string().trim().max(120, "120 caractères au maximum").optional().transform((v) => v || null),
  account: z.string().trim().max(60, "60 caractères au maximum").optional().transform((v) => v || null),
  reason: z.string().trim().min(3, "Motif requis").max(200, "200 caractères au maximum"),
  proofPath: z.string().trim().max(300).optional().transform((v) => v || null),
}).superRefine((d, ctx) => {
  const need = payoutDetails(d.method);
  if (need.holder && !d.holder) ctx.addIssue({ code: "custom", path: ["holder"], message: "Titulaire requis" });
  if (need.bank && !d.bank) ctx.addIssue({ code: "custom", path: ["bank"], message: `${need.bankLabel} requis` });
  if (need.account && !d.account) ctx.addIssue({ code: "custom", path: ["account"], message: `${need.accountLabel} requis` });
});
export type CreatePayoutInput = z.output<typeof createPayoutSchema>;

/** Date du versement : le jour même garde l'heure courante, un jour passé est daté à midi (UTC) ; null si elle est dans le futur. */
export function payoutDate(day: string, now: Date = new Date()): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return null;
  const today = now.toISOString().slice(0, 10);
  if (day > today) return null;
  const d = day === today ? now : new Date(`${day}T12:00:00Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}

export type PayoutGroup = {
  course_id: string; course_title: string; cover_url: string | null; session_id: string | null; session_title: string | null;
  session_start: string | null; session_end: string | null; amount: number; ids: string[];
};
export type PayoutInstructor = { id: string; name: string; email: string; phone: string | null; avatar_url: string | null; groups: PayoutGroup[] };
