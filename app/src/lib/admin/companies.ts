import { z } from "zod";
/** Gestion des entreprises : libellés, filtres et types (pur : testé unitairement). */

export const COMPANY_STATUS = {
  active: { label: "Active", tone: "bg-success/15 text-success" },
  pending: { label: "En attente", tone: "bg-warning/15 text-warning" },
  suspended: { label: "Inactive", tone: "bg-danger/10 text-danger" },
} as const;
export type CompanyStatus = keyof typeof COMPANY_STATUS;

export const SORTS = ["recent", "old", "status"] as const;
export type CompanySort = (typeof SORTS)[number];

export type CompanyFilters = { q: string; industry: string; status: string; city: string; sort: CompanySort };

/** Valeurs de filtre acceptées : tout le reste est ignoré. */
export function parseCompanyFilters(sp: { q?: string; secteur?: string; statut?: string; ville?: string; tri?: string }): CompanyFilters {
  return {
    q: sp.q?.trim().slice(0, 100) ?? "",
    industry: sp.secteur?.trim().slice(0, 100) ?? "",
    status: sp.statut && sp.statut in COMPANY_STATUS ? sp.statut : "",
    city: sp.ville?.trim().slice(0, 100) ?? "",
    sort: (SORTS as readonly string[]).includes(sp.tri ?? "") ? (sp.tri as CompanySort) : "recent",
  };
}

export type CompanyRow = {
  id: string; name: string; industry: string | null; city: string | null; status: CompanyStatus; created_at: string;
  contact_name: string | null; contact_email: string | null; contact_phone: string | null; learners: number; courses: number;
};

type StatBlock = { count: number; month: number; prev: number };
export type CompanyStats = {
  total: StatBlock; active: StatBlock;
  in_training: { companies: number; learners: number };
  completed: { count: number; month: number; prev: number; rating_avg: number | null };
  new: { month: number; prev: number };
};
export type CompanyOptions = { industries: string[]; cities: string[] };

/** Couleur stable d'une pastille de secteur (même secteur, même couleur). */
export function industryTone(name: string, tones: readonly string[]): string {
  let h = 0;
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return tones[h % tones.length];
}

export const LEGAL_FORMS = ["Société Anonyme (SA)", "SARL", "SAS", "SASU", "Entreprise individuelle", "GIE", "Association", "ONG", "Établissement public", "Autre"] as const;
export const SECTORS = ["Sécurité – Gardiennage", "Industrie", "BTP", "Mines et énergie", "Transport et logistique", "Commerce", "Banque et assurance", "Santé", "Hôtellerie et restauration", "Éducation", "Administration publique", "Services", "Autre"] as const;
export const COUNTRIES = [["CI", "Côte d’Ivoire"], ["SN", "Sénégal"], ["ML", "Mali"], ["BF", "Burkina Faso"], ["GN", "Guinée"], ["GH", "Ghana"], ["TG", "Togo"], ["BJ", "Bénin"], ["FR", "France"]] as const;
export const PARTNERSHIPS = { client: "Client", partner: "Partenaire", employer: "Employeur" } as const;
export const DESCRIPTION_MAX = 500;

const toggle = z.enum(["0", "1"]).optional().transform((v) => v === "1");
const opt = (max: number) => z.string().trim().max(max, `${max} caractères au maximum`).optional().transform((v) => v || null);
const color = z.string().trim().optional().transform((v) => v || null).refine((v) => v === null || /^#[0-9a-fA-F]{6}$/.test(v), "Couleur invalide");
const phone = z.string().trim().regex(/^\+?[0-9 ().-]{6,30}$/, "Téléphone invalide");
const email = z.string().trim().toLowerCase().email("Adresse e-mail invalide").max(200);

export const createCompanySchema = z.object({
  name: z.string().trim().min(2, "Raison sociale requise").max(150, "150 caractères au maximum"),
  shortName: opt(60),
  legalForm: z.enum(LEGAL_FORMS, { error: "Forme juridique requise" }),
  registration: z.string().trim().min(3, "N° RCCM requis").max(60, "60 caractères au maximum"),
  taxId: z.string().trim().min(3, "N° d’identification fiscale requis").max(40, "40 caractères au maximum"),
  sector: z.enum(SECTORS, { error: "Secteur requis" }),
  description: z.string().trim().max(DESCRIPTION_MAX, `${DESCRIPTION_MAX} caractères au maximum`).optional().transform((v) => v || null),
  country: z.enum(COUNTRIES.map((c) => c[0]) as [string, ...string[]], { error: "Pays requis" }),
  city: z.string().trim().min(2, "Ville requise").max(100, "100 caractères au maximum"),
  commune: opt(100),
  address: z.string().trim().min(3, "Adresse requise").max(300, "300 caractères au maximum"),
  logoUrl: z.string().trim().optional().transform((v) => v || null).refine((v) => v === null || /^https:\/\/\S+$/.test(v), "Logo invalide"),
  primaryColor: color, secondaryColor: color,
  contactName: z.string().trim().min(2, "Nom requis").max(120), contactRole: z.string().trim().min(2, "Fonction requise").max(120),
  contactPhone: phone, contactEmail: email,
  hasSecondary: toggle,
  contact2Name: opt(120), contact2Role: opt(120), contact2Phone: z.string().trim().optional().transform((v) => v || null), contact2Email: z.string().trim().toLowerCase().optional().transform((v) => v || null),
  status: z.enum(["active", "pending", "suspended"], { error: "Statut requis" }),
  partnership: z.enum(["client", "partner", "employer"], { error: "Type de partenariat requis" }),
  allowEnrollments: toggle, invoicing: toggle,
}).superRefine((d, ctx) => {
  if (!d.hasSecondary) return;
  if (!d.contact2Name || d.contact2Name.length < 2) ctx.addIssue({ code: "custom", path: ["contact2Name"], message: "Nom requis" });
  if (d.contact2Phone && !phone.safeParse(d.contact2Phone).success) ctx.addIssue({ code: "custom", path: ["contact2Phone"], message: "Téléphone invalide" });
  if (d.contact2Email && !email.safeParse(d.contact2Email).success) ctx.addIssue({ code: "custom", path: ["contact2Email"], message: "Adresse e-mail invalide" });
});
