/** Commissions et versements : libellés, filtres et formats (pur : testé unitairement). */

export const COMMISSION_STATUS = {
  paid: { label: "Versée", tone: "bg-success/15 text-success" },
  pending: { label: "En attente", tone: "bg-warning/15 text-[#a16207]" },
} as const;
export type CommissionStatus = keyof typeof COMMISSION_STATUS;

export const COMMISSION_TABS = { commissions: "Commissions", versements: "Versements", parametres: "Paramètres" } as const;
export type CommissionTab = keyof typeof COMMISSION_TABS;

export const PAYOUT_METHODS = { mobile_money: "Mobile Money", bank_transfer: "Virement bancaire", cash: "Espèces", cheque: "Chèque" } as const;

export type CommissionFilters = { tab: CommissionTab; q: string; month: string; status: CommissionStatus | ""; instructor: string };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Valeurs de filtre acceptées (paramètres d'URL) : tout le reste est ignoré. */
export function parseCommissionFilters(sp: { onglet?: string; q?: string; mois?: string; statut?: string; formateur?: string }): CommissionFilters {
  return {
    tab: sp.onglet && sp.onglet in COMMISSION_TABS ? (sp.onglet as CommissionTab) : "commissions",
    q: sp.q?.trim().slice(0, 100) ?? "",
    month: sp.mois && /^\d{4}-(0[1-9]|1[0-2])$/.test(sp.mois) ? sp.mois : "",
    status: sp.statut && sp.statut in COMMISSION_STATUS ? (sp.statut as CommissionStatus) : "",
    instructor: sp.formateur && UUID.test(sp.formateur) ? sp.formateur : "",
  };
}

const monthName = (d: Date, style: "long" | "short") => new Intl.DateTimeFormat("fr-FR", { month: style, timeZone: "UTC" }).format(d);
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** « 2026-10 » → « Oct. 2026 » (court) ou « Octobre 2026 » (long). */
export function monthLabel(ym: string, style: "long" | "short" = "short"): string {
  const [y, m] = ym.split("-").map(Number);
  if (!y || !m) return ym;
  const d = new Date(Date.UTC(y, m - 1, 1));
  return `${cap(monthName(d, style))} ${y}`;
}

/** Libellé d'axe du graphique : « Oct ». */
export function monthShort(ym: string): string {
  const [y, m] = ym.split("-").map(Number);
  if (!y || !m) return ym;
  return cap(monthName(new Date(Date.UTC(y, m - 1, 1)), "short").replace(".", ""));
}

/** « Session Octobre 2026 » d'après le début de la session ; « Sans session » si la commission n'en a pas. */
export function sessionLabel(start: string | null): string {
  return start ? `Session ${monthLabel(start.slice(0, 7), "long")}` : "Sans session";
}

/** Taux affiché : « 15 % », « 12,5 % ». */
export function formatRate(rate: number): string {
  return `${new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 2 }).format(rate)} %`;
}

export type CommissionRow = {
  ord: number; instructor_id: string; instructor_name: string; instructor_avatar: string | null;
  course_id: string; course_title: string; session_id: string | null; session_title: string | null; session_start: string | null;
  revenue: number; amount: number; rate: number; pending_amount: number; status: CommissionStatus; last_at: string;
};
export type PayoutRow = {
  id: string; reference: string; amount: number; method: keyof typeof PAYOUT_METHODS | null; paid_at: string; note: string | null;
  instructor_name: string; instructor_avatar: string | null; commissions: number;
};
export type RecentPayout = { id: string; instructor_name: string; instructor_avatar: string | null; amount: number; paid_at: string };
export type CommissionStats = {
  rate: number; revenue: number; revenue_month: number; revenue_prev: number; commission: number; commission_month: number; commission_prev: number;
  pending: number; paid: number; paid_month: number; paid_prev: number; months: { month: string; amount: number }[];
};
export type CommissionOptions = { instructors: { id: string; name: string }[]; months: string[] };
