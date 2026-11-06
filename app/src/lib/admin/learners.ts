import { z } from "zod";
import { SITUATIONS } from "@/lib/auth/schemas";
import { PHONE_CODES } from "@/lib/learners/wizard";
import { EDUCATION } from "@/lib/profile/schemas";
import { isValidPhone } from "@/lib/validation";

/** Gestion des apprenants par l'administration : onglets, filtres et types (pur : testé unitairement). */

export const LEARNER_TABS = ["all", "active", "training", "certified", "inactive"] as const;
export type LearnerTab = (typeof LEARNER_TABS)[number];

export const LEARNER_DISPLAY: Record<string, { label: string; tone: string; bar: string }> = {
  training: { label: "En formation", tone: "bg-brand-soft text-brand", bar: "bg-brand" },
  certified: { label: "Certifié", tone: "bg-success/15 text-success", bar: "bg-success" },
  completed: { label: "Terminé", tone: "bg-[#ede9fe] text-[#6d28d9]", bar: "bg-success" },
  pending: { label: "En attente", tone: "bg-warning/15 text-warning", bar: "bg-warning" },
  none: { label: "Sans inscription", tone: "bg-line text-muted", bar: "bg-line" },
};
export const LEARNER_DISPLAY_FILTERS = ["training", "certified", "completed", "pending", "none"] as const;

export type LearnerFilters = { q: string; tab: LearnerTab; course: string; org: string; status: string; sort: "recent" | "old" | "name" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Valeurs de filtre acceptées : tout le reste est ignoré. */
export function parseLearnerFilters(sp: { q?: string; onglet?: string; formation?: string; entreprise?: string; statut?: string; tri?: string }): LearnerFilters {
  return {
    q: sp.q?.trim().slice(0, 100) ?? "",
    tab: (LEARNER_TABS as readonly string[]).includes(sp.onglet ?? "") ? (sp.onglet as LearnerTab) : "all",
    course: sp.formation && UUID.test(sp.formation) ? sp.formation : "",
    org: sp.entreprise && UUID.test(sp.entreprise) ? sp.entreprise : "",
    status: (LEARNER_DISPLAY_FILTERS as readonly string[]).includes(sp.statut ?? "") ? sp.statut! : "",
    sort: sp.tri === "old" || sp.tri === "name" ? sp.tri : "recent",
  };
}

export type LearnerRow = {
  id: string; learner_code: string | null; full_name: string; avatar_url: string | null; email: string; phone: string | null;
  account_status: string; created_at: string; organization: string | null; display_status: string;
  course_id: string | null; course_title: string | null; progress: number | null; enrollments_count: number;
};

type StatBlock = { count: number; month?: number; prev?: number };
export type LearnerStats = Record<"total" | "active" | "inactive" | "training" | "certified", StatBlock>;
export type LearnerOptions = { courses: { id: string; title: string }[]; organizations: { id: string; name: string }[] };

export const CIVILITIES = { male: "M.", female: "Mme / Mlle", other: "Autre" } as const;
export const ID_TYPES = { cni: "CNI", passport: "Passeport", driving_licence: "Permis de conduire", consular_card: "Carte consulaire", other: "Autre" } as const;
export const LEARNER_STATUS_CHOICES = { confirmed: "Inscrit", pending: "En attente", none: "Non inscrit" } as const;
export const NOTES_MAX = 500;

/** Années d'expérience → tranche enregistrée dans le profil. */
export function experienceBand(years: number | null): "under_2" | "2_to_5" | "5_to_10" | "over_10" | null {
  if (years === null) return null;
  return years < 2 ? "under_2" : years < 5 ? "2_to_5" : years <= 10 ? "5_to_10" : "over_10";
}

const text = (max: number) => z.string().trim().max(max, `${max} caractères au maximum`).optional().transform((v) => v || null);
const country = z.enum(PHONE_CODES.map(([, name]) => name) as [string, ...string[]], { error: "Nationalité requise" });

export const createLearnerSchema = z.object({
  civility: z.enum(["male", "female", "other"], { error: "Civilité requise" }),
  lastName: z.string().trim().min(2, "Nom requis").max(80, "80 caractères au maximum"),
  firstName: z.string().trim().min(2, "Prénom requis").max(80, "80 caractères au maximum"),
  birthDate: z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/, "Date de naissance requise")
    .refine((v) => v >= "1900-01-01" && v <= new Date().toISOString().slice(0, 10), "Date de naissance invalide"),
  birthPlace: text(120),
  nationality: country,
  phoneCode: z.enum(PHONE_CODES.map(([c]) => c) as [string, ...string[]], { error: "Indicatif invalide" }),
  phoneNumber: z.string().trim().min(1, "Téléphone requis").max(20, "Numéro trop long"),
  email: z.string().trim().toLowerCase().min(1, "E-mail requis").email("Adresse e-mail invalide").max(254, "Adresse trop longue"),
  address: text(200),
  photoPath: z.string().trim().max(300).optional().transform((v) => v || null),
  password: z.string().optional().transform((v) => v ?? ""),
  situation: z.enum(Object.keys(SITUATIONS) as [keyof typeof SITUATIONS, ...(keyof typeof SITUATIONS)[]], { error: "Situation requise" }),
  organizationId: z.string().optional().transform((v) => v ?? "").pipe(z.union([z.literal(""), z.string().uuid("Entreprise invalide")])),
  jobTitle: text(120),
  experienceYears: z.string().trim().optional().transform((v) => (v ? Number(v) : null))
    .pipe(z.number({ error: "Nombre invalide" }).int("Nombre entier attendu").min(0, "0 au minimum").max(60, "60 au maximum").nullable()),
  courseIds: z.array(z.string().uuid("Formation invalide")).min(1, "Choisissez au moins une formation").max(10, "10 formations au maximum"),
  sessionId: z.string().optional().transform((v) => v ?? "").pipe(z.union([z.literal(""), z.string().uuid("Session invalide")])),
  enrollment: z.enum(["confirmed", "pending", "none"], { error: "Statut requis" }),
  educationLevel: z.enum(Object.keys(EDUCATION) as [keyof typeof EDUCATION, ...(keyof typeof EDUCATION)[]]).optional().or(z.literal("").transform(() => undefined)),
  idType: z.enum(Object.keys(ID_TYPES) as [keyof typeof ID_TYPES, ...(keyof typeof ID_TYPES)[]]).optional().or(z.literal("").transform(() => undefined)),
  idNumber: text(60),
  idValidUntil: z.string().trim().optional().transform((v) => v || null).refine((v) => v === null || /^\d{4}-\d{2}-\d{2}$/.test(v), "Date invalide"),
  notes: z.string().trim().max(NOTES_MAX, `${NOTES_MAX} caractères au maximum`).optional().transform((v) => v || null),
}).superRefine((d, ctx) => {
  if (!isValidPhone(`${d.phoneCode} ${d.phoneNumber}`)) ctx.addIssue({ code: "custom", path: ["phoneNumber"], message: "Numéro de téléphone invalide" });
  if (d.password) {
    if (d.password.length < 10) ctx.addIssue({ code: "custom", path: ["password"], message: "10 caractères minimum" });
    else if (!/[A-Za-z]/.test(d.password)) ctx.addIssue({ code: "custom", path: ["password"], message: "Au moins une lettre" });
    else if (!/[0-9]/.test(d.password)) ctx.addIssue({ code: "custom", path: ["password"], message: "Au moins un chiffre" });
  }
  if (d.enrollment !== "none" && !d.sessionId) ctx.addIssue({ code: "custom", path: ["sessionId"], message: "Choisissez une session pour inscrire l’apprenant" });
});
