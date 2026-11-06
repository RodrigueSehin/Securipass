import { z } from "zod";

/** Catalogue des certifications géré par l'administration : filtres, libellés et validation (pur : testé unitairement). */

export const CERTIFICATION_STATUSES = ["active", "review", "inactive"] as const;
export type CertificationStatus = (typeof CERTIFICATION_STATUSES)[number];
export const CERTIFICATION_STATUS_UI: Record<CertificationStatus, { label: string; tone: string }> = {
  active: { label: "Active", tone: "bg-success/15 text-success" },
  review: { label: "En révision", tone: "bg-warning/15 text-warning" },
  inactive: { label: "Inactive", tone: "bg-line text-brand-dark" },
};

export const CERTIFICATION_TABS = ["all", "active", "inactive"] as const;
export type CertificationTab = (typeof CERTIFICATION_TABS)[number];

export type CertificationFilters = { q: string; category: string; status: string; tab: CertificationTab };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Valeurs de filtre acceptées : tout le reste est ignoré. */
export function parseCertificationFilters(sp: { q?: string; categorie?: string; statut?: string; onglet?: string }): CertificationFilters {
  return {
    q: sp.q?.trim().slice(0, 100) ?? "",
    category: sp.categorie && UUID.test(sp.categorie) ? sp.categorie : "",
    status: (CERTIFICATION_STATUSES as readonly string[]).includes(sp.statut ?? "") ? sp.statut! : "",
    tab: (CERTIFICATION_TABS as readonly string[]).includes(sp.onglet ?? "") ? (sp.onglet as CertificationTab) : "all",
  };
}

export type CertificationRow = {
  id: string; name: string; code: string; status: CertificationStatus; validity_months: number | null; created_at: string;
  course_id: string; course_title: string; category_name: string | null; category_icon: string | null; category_color: string | null; delivered: number;
};

type Block = { count: number; month?: number; prev?: number };
export type CertificationStats = {
  created: Block; active: number; inactive: number; delivered: Block; learners: Block; success: { passed: number; results: number };
};
export type CertificationOptions = {
  categories: { id: string; name: string }[]; all_categories: { id: string; name: string }[]; templates: { id: string; name: string; title: string }[]; courses: { id: string; title: string; validity_months: number | null }[] };

/** « 3 ans », « 18 mois », « Illimitée ». */
export function validityLabel(months: number | null): string {
  if (months === null) return "Illimitée";
  if (months % 12 === 0) return `${months / 12} an${months / 12 > 1 ? "s" : ""}`;
  return `${months} mois`;
}


export const LEVELS = { beginner: "Débutant", intermediate: "Intermédiaire", professional: "Professionnel", expert: "Expert" } as const;
export const EVALUATION_TYPES = { qcm: "Examen (QCM)", practical: "Évaluation pratique", qcm_practical: "Examen (QCM + Pratique)", continuous: "Contrôle continu" } as const;
export const DELIVERY_MODES = { automatic: "Automatique (après réussite)", manual: "Sur validation d’un administrateur" } as const;
export const DESCRIPTION_MAX = 500;

const toggle = z.enum(["0", "1"]).optional().transform((v) => v === "1");
const int = (msg: string, min: number, max: number) => z.string().trim().min(1, msg).transform(Number).pipe(z.number({ error: msg }).int(msg).min(min, msg).max(max, msg));

/** Validité saisie (nombre + unité) → mois ; vide = illimitée. */
export function validityToMonths(value: string, unit: string): number | null {
  const n = Number(value);
  if (!value.trim() || !Number.isFinite(n) || n <= 0) return null;
  return unit === "months" ? Math.round(n) : Math.round(n * 12);
}

export const createCertificationSchema = z.object({
  name: z.string().trim().min(2, "Titre requis (2 caractères au minimum)").max(200, "200 caractères au maximum"),
  code: z.string().trim().toUpperCase().min(1, "Code requis")
    .refine((v) => /^[A-Z0-9]+(-[A-Z0-9]+)*$/.test(v) && v.length >= 3 && v.length <= 30, "Lettres, chiffres et tirets (3 à 30 caractères)"),
  categoryId: z.string().uuid("Catégorie requise"),
  level: z.enum(Object.keys(LEVELS) as [keyof typeof LEVELS, ...(keyof typeof LEVELS)[]], { error: "Niveau requis" }),
  description: z.string().trim().min(2, "Description requise").max(DESCRIPTION_MAX, `${DESCRIPTION_MAX} caractères au maximum`),
  coverUrl: z.string().trim().optional().transform((v) => v || null).refine((v) => v === null || /^https:\/\/\S+$/.test(v), "Visuel invalide"),
  courseId: z.string().uuid("Formation requise"),
  evaluationType: z.enum(Object.keys(EVALUATION_TYPES) as [keyof typeof EVALUATION_TYPES, ...(keyof typeof EVALUATION_TYPES)[]], { error: "Type requis" }),
  passingScore: int("Score requis (0 à 100)", 0, 100),
  maxAttempts: int("Tentatives requises (1 à 10)", 1, 10),
  validityValue: z.string().trim().optional().transform((v) => v ?? ""),
  validityUnit: z.enum(["years", "months"]).optional().transform((v) => v ?? "years"),
  deliveryMode: z.enum(["automatic", "manual"], { error: "Mode requis" }),
  autoPdf: toggle,
  templateId: z.string().uuid("Modèle requis"),
  numberPrefix: z.string().trim().toUpperCase().optional().transform((v) => v || null).refine((v) => v === null || /^[A-Z0-9]{2,10}$/.test(v), "2 à 10 lettres ou chiffres"),
  showPublic: toggle, allowVerification: toggle, requireProof: toggle,
  status: z.enum(CERTIFICATION_STATUSES).optional().transform((v) => v ?? "active"),
}).superRefine((d, ctx) => {
  if (d.validityValue && validityToMonths(d.validityValue, d.validityUnit) === null) ctx.addIssue({ code: "custom", path: ["validityValue"], message: "Durée invalide" });
  const months = validityToMonths(d.validityValue, d.validityUnit);
  if (months !== null && months > 240) ctx.addIssue({ code: "custom", path: ["validityValue"], message: "20 ans au maximum" });
}).transform((d) => ({ ...d, validity: validityToMonths(d.validityValue, d.validityUnit) }));
