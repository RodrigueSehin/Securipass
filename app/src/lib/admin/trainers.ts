import { z } from "zod";
import { PHONE_CODES } from "@/lib/learners/wizard";
import { isValidPhone } from "@/lib/validation";

/** Gestion des formateurs : libellés, filtres, types et validation (pur : testé unitairement). */

export const TRAINER_STATUS = {
  active: { label: "Actif", tone: "bg-success/15 text-success" },
  suspended: { label: "Inactif", tone: "bg-danger/10 text-danger" },
  deletion_requested: { label: "Suppression demandée", tone: "bg-warning/15 text-warning" },
} as const;
export type TrainerStatus = keyof typeof TRAINER_STATUS;

export const CONTRACTS = {
  internal: { label: "Interne", tone: "bg-brand-soft text-brand" },
  external: { label: "Externe", tone: "bg-cta/15 text-cta-dark" },
} as const;
export type ContractType = keyof typeof CONTRACTS;

export const SORTS = ["recent", "old", "rating_desc", "rating_asc"] as const;
export type TrainerSort = (typeof SORTS)[number];

export type TrainerFilters = { q: string; category: string; status: string; contract: string; sort: TrainerSort };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Valeurs de filtre acceptées : tout le reste est ignoré. */
export function parseTrainerFilters(sp: { q?: string; specialite?: string; statut?: string; contrat?: string; tri?: string }): TrainerFilters {
  return {
    q: sp.q?.trim().slice(0, 100) ?? "",
    category: sp.specialite && UUID.test(sp.specialite) ? sp.specialite : "",
    status: sp.statut && sp.statut in TRAINER_STATUS ? sp.statut : "",
    contract: sp.contrat && sp.contrat in CONTRACTS ? sp.contrat : "",
    sort: (SORTS as readonly string[]).includes(sp.tri ?? "") ? (sp.tri as TrainerSort) : "recent",
  };
}

export type TrainerRow = {
  id: string; full_name: string; email: string; phone: string | null; avatar_url: string | null; status: TrainerStatus;
  added_at: string; contract_type: ContractType; specialties: string[]; courses: number; learners: number;
  rating: number | null; reviews: number;
};

type StatBlock = { count: number; month: number; prev: number };
export const BIO_MAX = 500;

const uuidList = z.array(z.string().uuid("Identifiant invalide")).max(200);
const tagList = (what: string) => z.array(z.string().trim().min(1).max(60, "60 caractères au maximum")).max(10, `10 ${what} au maximum`);

export const createTrainerSchema = z.object({
  fullName: z.string().trim().min(2, "Nom complet requis").max(120, "120 caractères au maximum"),
  gender: z.enum(["male", "female", "other"], { error: "Genre requis" }),
  birthDate: z.string().trim().optional().transform((v) => v || null)
    .refine((v) => v === null || (/^\d{4}-\d{2}-\d{2}$/.test(v) && v >= "1900-01-01" && v <= new Date().toISOString().slice(0, 10)), "Date invalide"),
  email: z.string().trim().toLowerCase().min(1, "E-mail requis").email("Adresse e-mail invalide").max(254, "Adresse trop longue"),
  phoneCode: z.enum(PHONE_CODES.map(([c]) => c) as [string, ...string[]], { error: "Indicatif invalide" }),
  phoneNumber: z.string().trim().min(1, "Téléphone requis").max(20, "Numéro trop long"),
  photoPath: z.string().trim().max(300).optional().transform((v) => v || null),
  jobTitle: z.string().trim().min(2, "Poste requis").max(120, "120 caractères au maximum"),
  mainCategory: z.string().uuid("Spécialité principale requise"),
  extraCategories: uuidList.max(10),
  organizationId: z.string().optional().transform((v) => v ?? "").pipe(z.union([z.literal(""), z.string().uuid("Organisation invalide")])),
  contract: z.enum(["internal", "external"], { error: "Type de contrat requis" }),
  experience: z.coerce.number({ error: "Expérience requise" }).int("Nombre entier attendu").min(0, "0 au minimum").max(60, "60 au maximum"),
  city: z.string().trim().max(120, "120 caractères au maximum").optional().transform((v) => v || null),
  bio: z.string().trim().min(10, "10 caractères au minimum").max(BIO_MAX, `${BIO_MAX} caractères au maximum`),
  skills: tagList("compétences"),
  diplomas: tagList("diplômes"),
  courseIds: uuidList,
  passwordMode: z.enum(["auto", "manual"]),
  password: z.string().optional().transform((v) => v ?? ""),
}).superRefine((d, ctx) => {
  if (!isValidPhone(`${d.phoneCode} ${d.phoneNumber}`)) ctx.addIssue({ code: "custom", path: ["phoneNumber"], message: "Numéro de téléphone invalide" });
  if (d.city && d.city.length < 2) ctx.addIssue({ code: "custom", path: ["city"], message: "2 caractères au minimum" });
  if (d.passwordMode === "manual") {
    if (d.password.length < 10) ctx.addIssue({ code: "custom", path: ["password"], message: "10 caractères minimum" });
    else if (!/[A-Za-z]/.test(d.password)) ctx.addIssue({ code: "custom", path: ["password"], message: "Au moins une lettre" });
    else if (!/[0-9]/.test(d.password)) ctx.addIssue({ code: "custom", path: ["password"], message: "Au moins un chiffre" });
  }
});

export type TrainerStats = {
  total: StatBlock; active: StatBlock; on_mission: number; specialties: number; rating_avg: number | null; rating_count: number;
};
