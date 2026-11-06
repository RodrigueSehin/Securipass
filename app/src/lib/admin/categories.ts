import { z } from "zod";

/** Gestion des catégories : libellés, filtres, icônes et types (pur : testé unitairement). */

export const CATEGORY_STATUS = {
  active: { label: "Active", tone: "bg-success/15 text-success" },
  pending: { label: "En attente", tone: "bg-warning/15 text-warning" },
  inactive: { label: "Inactive", tone: "bg-danger/10 text-danger" },
} as const;
export type CategoryStatus = keyof typeof CATEGORY_STATUS;

export const CATEGORY_SORTS = [
  ["recent", "Date de création (plus récente)"], ["old", "Date de création (plus ancienne)"],
  ["name_asc", "Nom (A → Z)"], ["name_desc", "Nom (Z → A)"],
  ["courses_desc", "Nombre de formations"], ["learners_desc", "Nombre d’apprenants"],
] as const;
export type CategorySort = (typeof CATEGORY_SORTS)[number][0];

export const CATEGORY_PAGE_SIZES = [20, 50, 100];

export type CategoryFilters = { q: string; status: string; sort: CategorySort };

/** Valeurs de filtre acceptées : tout le reste est ignoré. */
export function parseCategoryFilters(sp: { q?: string; statut?: string; tri?: string }): CategoryFilters {
  return {
    q: sp.q?.trim().slice(0, 100) ?? "",
    status: sp.statut && sp.statut in CATEGORY_STATUS ? sp.statut : "",
    sort: CATEGORY_SORTS.some(([k]) => k === sp.tri) ? (sp.tri as CategorySort) : "recent",
  };
}

/** Couleurs des pastilles d'icône (clés stockées en base). */
export const CATEGORY_COLORS: Record<string, string> = {
  blue: "bg-brand", green: "bg-success", orange: "bg-cta", purple: "bg-[#7c3aed]", red: "bg-danger",
  amber: "bg-warning", teal: "bg-[#0d9488]", slate: "bg-[#8b97aa]", brown: "bg-[#a16207]", pink: "bg-[#e11d48]",
};

export type CategoryRow = {
  id: string; name: string; slug: string; description: string | null; status: CategoryStatus; created_at: string;
  icon: string; color: string; courses: number; learners: number;
};

type StatBlock = { count: number; month: number; prev: number };
export type CategoryStats = {
  categories: StatBlock; courses: StatBlock & { categories: number }; learners: StatBlock; inactive: number;
};

export const SHORT_MAX = 200;
export const LONG_MAX = 2000;

const toggle = z.enum(["0", "1"]).optional().transform((v) => v !== "0");

export const createCategorySchema = z.object({
  name: z.string().trim().min(2, "Nom requis (2 caractères au minimum)").max(80, "80 caractères au maximum"),
  code: z.string().trim().toUpperCase().min(1, "Code requis").regex(/^[A-Z0-9]+(-[A-Z0-9]+)*$/, "Lettres, chiffres et tirets uniquement (ex. CAT-INC-001)")
    .refine((v) => v.length >= 3 && v.length <= 30, "3 à 30 caractères"),
  parentId: z.string().optional().transform((v) => v ?? "").pipe(z.union([z.literal(""), z.string().uuid("Catégorie parente invalide")])),
  order: z.string().trim().optional().transform((v) => (v ? Number(v) : 0)).pipe(z.number({ error: "Nombre attendu" }).int("Nombre entier attendu").min(0, "0 au minimum").max(9999, "9999 au maximum")),
  shortDescription: z.string().trim().min(10, "10 caractères au minimum").max(SHORT_MAX, `${SHORT_MAX} caractères au maximum`),
  longDescription: z.string().trim().max(LONG_MAX, `${LONG_MAX} caractères au maximum`).optional().transform((v) => v || null),
  icon: z.string().trim().min(2, "Icône requise").max(30),
  color: z.string().trim().regex(/^#[0-9a-fA-F]{6}$/, "Couleur invalide (ex. #EF4444)").transform((v) => v.toLowerCase()),
  coverUrl: z.string().trim().optional().transform((v) => v || null).refine((v) => v === null || /^https:\/\/\S+$/.test(v), "Image invalide"),
  status: z.enum(["active", "pending", "inactive"], { error: "Statut requis" }),
  visiblePlatform: toggle,
  visibleCatalogue: toggle,
});
