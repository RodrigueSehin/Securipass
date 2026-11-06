import { z } from "zod";
import { isValidPhone } from "@/lib/validation";

/** Gestion des inscriptions par l'administration : filtres et types (pur : testé unitairement). */

export const ENROLLMENT_GROUPS = ["pending", "validated", "refused", "waitlisted", "suspended", "expired"] as const;

export const ENROLLMENT_STATUS_UI: Record<string, { label: string; tone: string }> = {
  pending: { label: "En attente", tone: "bg-warning/15 text-warning" },
  validated: { label: "Validée", tone: "bg-success/15 text-success" },
  refused: { label: "Refusée", tone: "bg-danger/10 text-danger" },
  waitlisted: { label: "Liste d’attente", tone: "bg-brand-soft text-brand" },
  suspended: { label: "Suspendue", tone: "bg-line text-brand-dark" },
  expired: { label: "Expirée", tone: "bg-line text-muted" },
};

/** Statut précis d'une inscription, plus fin que le groupe affiché (ex. paiement attendu). */
export const RAW_STATUS_LABEL: Record<string, string> = {
  pending_approval: "En attente de validation", pending_payment: "Paiement attendu", confirmed: "Validée", completed: "Terminée",
  cancelled: "Refusée ou annulée", waitlisted: "Liste d’attente", suspended: "Suspendue", expired: "Expirée",
};

/** Groupe de statuts affiché (miroir de public._enrollment_group). */
export function enrollmentGroup(status: string): string {
  if (status === "pending_approval" || status === "pending_payment") return "pending";
  if (status === "confirmed" || status === "completed") return "validated";
  if (status === "cancelled") return "refused";
  return status;
}

export type EnrollmentFilters = { q: string; course: string; session: string; status: string; from: string; to: string; asc: boolean };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DAY = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;

/** Valeurs de filtre acceptées : tout le reste est ignoré ; une période inversée est remise dans l'ordre. */
export function parseEnrollmentFilters(sp: { q?: string; formation?: string; session?: string; statut?: string; du?: string; au?: string; tri?: string }): EnrollmentFilters {
  let from = sp.du && DAY.test(sp.du) ? sp.du : "";
  let to = sp.au && DAY.test(sp.au) ? sp.au : "";
  if (from && to && from > to) [from, to] = [to, from];
  return {
    q: sp.q?.trim().slice(0, 100) ?? "",
    course: sp.formation && UUID.test(sp.formation) ? sp.formation : "",
    session: sp.session && UUID.test(sp.session) ? sp.session : "",
    status: (ENROLLMENT_GROUPS as readonly string[]).includes(sp.statut ?? "") ? sp.statut! : "",
    from, to, asc: sp.tri === "asc",
  };
}

export type EnrollmentRow = {
  id: string; reference: string; payment_status: keyof typeof PAYMENT_STATUS_UI | null; status: string; enrolled_at: string;
  learner_id: string; learner_name: string; learner_avatar: string | null; learner_phone: string | null; learner_email: string;
  course_id: string; course_title: string; session_id: string | null; session_title: string | null; session_timezone: string | null;
};

type StatBlock = { count: number; month: number; prev: number };
export type EnrollmentStats = Record<"total" | "pending" | "validated" | "refused", StatBlock>;

export const ENROLLMENT_SOURCES = { administration: "Administration", phone: "Téléphone", onsite: "Sur place", company: "Entreprise", online: "En ligne" } as const;
export const PAYMENT_STATUS_UI = {
  pending: { label: "En attente", tone: "bg-warning/15 text-warning" },
  to_verify: { label: "À vérifier", tone: "bg-warning/15 text-warning" },
  paid: { label: "Payé", tone: "bg-success/15 text-success" },
  unpaid: { label: "Non payé", tone: "bg-danger/10 text-danger" },
} as const;
export const PAYMENT_METHODS = { cash: "Espèces", mobile_money: "Mobile Money", bank_transfer: "Virement bancaire", card: "Carte bancaire", cheque: "Chèque" } as const;
export const NOTES_MAX = 500;
export const DOC_MAX_MB = 5;

const money = (msg: string) => z.string().trim().optional().transform((v) => (v ? Number(v.replace(/\s/g, "")) : 0))
  .pipe(z.number({ error: msg }).int(msg).min(0, msg).max(1_000_000_000, msg));

/** Création d'une inscription : apprenant existant ou nouveau, session, détails, paiement saisi et notes. */
export const createEnrollmentSchema = z.object({
  mode: z.enum(["existing", "new"]),
  learnerId: z.string().optional().transform((v) => v ?? ""),
  lastName: z.string().trim().optional().transform((v) => v ?? ""),
  firstName: z.string().trim().optional().transform((v) => v ?? ""),
  gender: z.enum(["", "male", "female", "other"]).optional().transform((v) => v || null),
  birthDate: z.string().trim().optional().transform((v) => v || null).refine((v) => v === null || (/^\d{4}-\d{2}-\d{2}$/.test(v) && v >= "1900-01-01" && v <= new Date().toISOString().slice(0, 10)), "Date de naissance invalide"),
  phoneCode: z.string().trim().optional().transform((v) => v ?? "+225"),
  phoneNumber: z.string().trim().optional().transform((v) => v ?? ""),
  email: z.string().trim().toLowerCase().optional().transform((v) => v ?? ""),
  photoPath: z.string().trim().max(300).optional().transform((v) => v || null),
  courseId: z.string().uuid("Formation requise"),
  sessionId: z.string().uuid("Session requise"),
  status: z.enum(["pending", "confirmed"], { error: "Statut requis" }),
  date: z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/, "Date requise"),
  source: z.enum(Object.keys(ENROLLMENT_SOURCES) as [keyof typeof ENROLLMENT_SOURCES, ...(keyof typeof ENROLLMENT_SOURCES)[]], { error: "Source requise" }),
  amountDue: money("Montant invalide"),
  amountPaid: money("Montant invalide"),
  paymentStatus: z.enum(["pending", "to_verify", "paid", "unpaid"], { error: "Statut de paiement requis" }),
  paymentMethod: z.enum(["", ...Object.keys(PAYMENT_METHODS)]).optional().transform((v) => v || null),
  notes: z.string().trim().max(NOTES_MAX, `${NOTES_MAX} caractères au maximum`).optional().transform((v) => v || null),
  documents: z.array(z.object({ path: z.string().max(300), name: z.string().max(200), size: z.number().int().positive().max(DOC_MAX_MB * 1024 * 1024) })).max(10, "10 fichiers au maximum"),
}).superRefine((d, ctx) => {
  if (d.mode === "existing") {
    if (!z.string().uuid().safeParse(d.learnerId).success) ctx.addIssue({ code: "custom", path: ["learnerId"], message: "Choisissez un apprenant" });
  } else {
    if (d.lastName.length < 2) ctx.addIssue({ code: "custom", path: ["lastName"], message: "Nom requis" });
    if (d.firstName.length < 2) ctx.addIssue({ code: "custom", path: ["firstName"], message: "Prénom requis" });
    if (!isValidPhone(`${d.phoneCode} ${d.phoneNumber}`)) ctx.addIssue({ code: "custom", path: ["phoneNumber"], message: "Numéro de téléphone invalide" });
    if (!z.string().email().max(254).safeParse(d.email).success) ctx.addIssue({ code: "custom", path: ["email"], message: "Adresse e-mail valide requise pour créer le compte" });
  }
  if (d.amountPaid > d.amountDue) ctx.addIssue({ code: "custom", path: ["amountPaid"], message: "Le montant payé dépasse le montant dû" });
});
