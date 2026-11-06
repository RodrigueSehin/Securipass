import { z } from "zod";
import { isValidPhone } from "@/lib/validation";

/** Assistant « Ajouter un apprenant » : étapes, validations et sélection des sessions (pur : testé unitairement). */

export const LEARNER_STEPS = ["Informations de l’apprenant", "Sélection des sessions", "Options d’inscription", "Confirmation"] as const;
export const LEARNER_STEP_COUNT = LEARNER_STEPS.length;
export const MAX_SESSIONS = 20;

export function parseLearnerStep(value: string | undefined): number {
  const n = Math.floor(Number(value));
  return Number.isFinite(n) && n >= 1 && n <= LEARNER_STEP_COUNT ? n : 1;
}

export function learnerWizardUrl(id: string, next: string | undefined | null, fallbackStep = 2): string {
  if (next === "list") return "/formateur/apprenants";
  const n = Math.floor(Number(next));
  const step = Number.isFinite(n) && n >= 1 && n <= LEARNER_STEP_COUNT ? n : fallbackStep;
  return `/formateur/apprenants/nouveau/${id}?etape=${step}`;
}

export const PHONE_CODES = [
  ["+225", "Côte d’Ivoire"], ["+221", "Sénégal"], ["+223", "Mali"], ["+226", "Burkina Faso"], ["+228", "Togo"],
  ["+229", "Bénin"], ["+233", "Ghana"], ["+237", "Cameroun"], ["+241", "Gabon"], ["+33", "France"],
] as const;

export const GENDERS = { male: "Homme", female: "Femme", other: "Autre", prefer_not_say: "Ne souhaite pas répondre" } as const;

/** Sépare un numéro enregistré (« +225 07 01 02 03 04 ») en indicatif et numéro local. */
export function splitPhone(phone: string | undefined): { code: string; number: string } {
  const p = (phone ?? "").trim();
  const code = PHONE_CODES.map(([c]) => c).sort((a, b) => b.length - a.length).find((c) => p.startsWith(c));
  return code ? { code, number: p.slice(code.length).trim() } : { code: "+225", number: p };
}

const optional = (max: number, msg: string) => z.string().trim().max(max, msg).optional().transform((v) => v || null);

export const learnerStep1Schema = z.object({
  firstName: z.string().trim().min(1, "Prénom requis").max(80, "80 caractères au maximum"),
  lastName: z.string().trim().min(1, "Nom requis").max(80, "80 caractères au maximum"),
  email: z.string().trim().toLowerCase().min(1, "E-mail requis").email("Adresse e-mail invalide").max(254, "Adresse trop longue"),
  phoneCode: z.enum(PHONE_CODES.map(([c]) => c) as [string, ...string[]], { error: "Indicatif invalide" }),
  phoneNumber: z.string().trim().min(1, "Téléphone requis").max(20, "Numéro trop long"),
  birthDate: z.string().optional().transform((v, ctx) => {
    if (!v) return null;
    const d = new Date(`${v}T00:00:00Z`);
    if (Number.isNaN(d.getTime()) || v < "1900-01-01" || v > new Date().toISOString().slice(0, 10)) {
      ctx.addIssue({ code: "custom", message: "Date de naissance invalide" });
    }
    return v;
  }),
  gender: z.enum(["male", "female", "other", "prefer_not_say", ""]).optional().transform((v) => v || null),
  company: optional(120, "120 caractères au maximum"),
  jobTitle: optional(120, "120 caractères au maximum"),
  address: optional(200, "200 caractères au maximum"),
  notes: optional(500, "500 caractères au maximum"),
  photoPath: z.string().trim().max(300).optional().transform((v) => v || null),
}).superRefine((d, ctx) => {
  if (!isValidPhone(`${d.phoneCode} ${d.phoneNumber}`)) ctx.addIssue({ code: "custom", path: ["phoneNumber"], message: "Numéro de téléphone invalide" });
});

export const learnerStep2Schema = z.object({
  sessionIds: z.array(z.string().uuid("Session invalide")).min(1, "Sélectionnez au moins une session").max(MAX_SESSIONS, "20 sessions au maximum"),
});

export const learnerStep3Schema = z.object({ notify: z.enum(["0", "1"]) });

export type SessionPick = {
  id: string; capacity: number; taken: number; waitlist_enabled: boolean; status: string; end_at: string; start_at: string;
};

export type SessionAvailability = "open" | "waitlist" | "full";

/** Disponibilité d'une session pour une inscription manuelle (la date limite d'inscription ne s'applique pas au formateur). */
export function sessionAvailability(s: Pick<SessionPick, "capacity" | "taken" | "waitlist_enabled">): SessionAvailability {
  if (s.taken < s.capacity) return "open";
  return s.waitlist_enabled ? "waitlist" : "full";
}

/** Une session est proposable si elle est planifiée, non terminée et non complète sans liste d'attente. */
export function isSelectable(s: SessionPick, now: number): boolean {
  return s.status === "scheduled" && Date.parse(s.end_at) > now && sessionAvailability(s) !== "full";
}

export const AVAILABILITY_LABEL: Record<SessionAvailability, string> = { open: "Ouverte", waitlist: "Liste d’attente", full: "Complète" };

export type LearnerDraft = {
  firstName: string; lastName: string; email: string; phone: string; birthDate: string | null; gender: string | null;
  company: string | null; jobTitle: string | null; address: string | null; notes: string | null; photoPath: string | null;
  sessionIds: string[]; notify: boolean;
};

export const fullName = (d: Pick<LearnerDraft, "firstName" | "lastName">) => `${d.firstName} ${d.lastName}`.trim();

/** Résumé du résultat d'inscription renvoyé par la base. */
export function summarizeResult(r: { status?: string; enrolled?: number; failed?: unknown[] } | null | undefined) {
  const failed = Array.isArray(r?.failed) ? r!.failed.length : 0;
  return { pending: r?.status === "pending", enrolled: r?.enrolled ?? 0, failed };
}
