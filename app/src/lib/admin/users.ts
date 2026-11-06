import { z } from "zod";
import { PHONE_CODES } from "@/lib/learners/wizard";
import { isValidPhone } from "@/lib/validation";

/** Gestion des utilisateurs : libellés, filtres et validation (pur : testé unitairement). */

export const ROLE_LABEL = {
  learner: "Apprenant", instructor: "Formateur", company: "Entreprise", admin: "Administrateur",
  pedagogy_manager: "Resp. pédagogique", certification_manager: "Resp. certification", support: "Support",
} as const;
export type RoleCode = keyof typeof ROLE_LABEL;
export const ROLE_CODES = Object.keys(ROLE_LABEL) as RoleCode[];

export const ROLE_TONE: Record<RoleCode, string> = {
  learner: "bg-brand-soft text-brand", instructor: "bg-cta/15 text-cta-dark", company: "bg-[#ede9fe] text-[#6d28d9]", admin: "bg-danger/10 text-danger",
  pedagogy_manager: "bg-warning/15 text-warning", certification_manager: "bg-warning/15 text-warning", support: "bg-[#ccfbf1] text-[#0f766e]",
};

export const USER_STATUS = {
  active: { label: "Actif", tone: "bg-success/15 text-success" },
  suspended: { label: "Inactif", tone: "bg-danger/10 text-danger" },
  deletion_requested: { label: "Suppression demandée", tone: "bg-warning/15 text-warning" },
} as const;
export type UserStatus = keyof typeof USER_STATUS;

export const PERIODS = [["7d", "7 derniers jours"], ["30d", "30 derniers jours"], ["90d", "90 derniers jours"], ["365d", "12 derniers mois"]] as const;
export const PAGE_SIZES = [10, 20, 50, 100];

export type UserFilters = { q: string; role: string; status: string; period: string; asc: boolean };

/** Valeurs de filtre acceptées : tout le reste est ignoré. */
export function parseUserFilters(sp: { q?: string; role?: string; statut?: string; periode?: string; tri?: string }): UserFilters {
  return {
    q: sp.q?.trim().slice(0, 100) ?? "",
    role: ROLE_CODES.includes(sp.role as RoleCode) ? sp.role! : "",
    status: sp.statut && sp.statut in USER_STATUS ? sp.statut : "",
    period: PERIODS.some(([k]) => k === sp.periode) ? sp.periode! : "",
    asc: sp.tri === "asc",
  };
}

export type UserRow = {
  id: string; full_name: string; email: string; phone: string | null; avatar_url: string | null; status: UserStatus;
  created_at: string; last_sign_in_at: string | null; roles: RoleCode[]; organization: string | null;
};

/** Pages affichées dans la pagination : 1 2 3 4 5 … dernière, centrées sur la page courante. */
export function pageWindow(page: number, pages: number): (number | "…")[] {
  if (pages <= 7) return Array.from({ length: pages }, (_, i) => i + 1);
  const out: (number | "…")[] = [1];
  const start = Math.max(2, Math.min(page - 1, pages - 4));
  const end = Math.min(pages - 1, Math.max(page + 1, 5));
  if (start > 2) out.push("…");
  for (let n = start; n <= end; n++) out.push(n);
  if (end < pages - 1) out.push("…");
  out.push(pages);
  return out;
}

export const GENDER_OPTIONS = { "": "Non précisé", male: "Masculin", female: "Féminin", other: "Autre" } as const;

/** Rôles proposés à la création (cartes) : les autres s'attribuent depuis la fiche du compte. */
export const CREATION_ROLES: { code: RoleCode; hint: string }[] = [
  { code: "learner", hint: "Suivre des formations et passer des évaluations" },
  { code: "instructor", hint: "Créer et animer des formations" },
  { code: "company", hint: "Gérer les collaborateurs et les formations" },
  { code: "admin", hint: "Gestion complète de la plateforme" },
  { code: "support", hint: "Traitement des demandes d’assistance" },
];

export const createUserSchema = z.object({
  fullName: z.string().trim().min(2, "Nom complet requis").max(120, "120 caractères au maximum"),
  gender: z.enum(["", "male", "female", "other"]).optional().transform((v) => v || null),
  email: z.string().trim().toLowerCase().min(1, "E-mail requis").email("Adresse e-mail invalide").max(254, "Adresse trop longue"),
  phoneCode: z.enum(PHONE_CODES.map(([c]) => c) as [string, ...string[]], { error: "Indicatif invalide" }),
  phoneNumber: z.string().trim().min(1, "Téléphone requis").max(20, "Numéro trop long"),
  photoPath: z.string().trim().max(300).optional().transform((v) => v || null),
  organizationId: z.string().optional().transform((v) => v ?? "").pipe(z.union([z.literal(""), z.string().uuid("Organisation invalide")])),
  jobTitle: z.string().trim().max(120, "120 caractères au maximum").optional().transform((v) => v || null),
  department: z.string().trim().max(120, "120 caractères au maximum").optional().transform((v) => v || null),
  roles: z.array(z.enum(ROLE_CODES as [RoleCode, ...RoleCode[]])).min(1, "Choisissez au moins un rôle"),
  status: z.enum(["active", "suspended"], { error: "Statut invalide" }),
  passwordMode: z.enum(["auto", "manual"]),
  password: z.string().optional().transform((v) => v ?? ""),
}).superRefine((d, ctx) => {
  if (!isValidPhone(`${d.phoneCode} ${d.phoneNumber}`)) ctx.addIssue({ code: "custom", path: ["phoneNumber"], message: "Numéro de téléphone invalide" });
  if (d.jobTitle && d.jobTitle.length < 2) ctx.addIssue({ code: "custom", path: ["jobTitle"], message: "2 caractères au minimum" });
  if (d.department && d.department.length < 2) ctx.addIssue({ code: "custom", path: ["department"], message: "2 caractères au minimum" });
  if (d.passwordMode === "manual") {
    if (d.password.length < 10) ctx.addIssue({ code: "custom", path: ["password"], message: "10 caractères minimum" });
    else if (!/[A-Za-z]/.test(d.password)) ctx.addIssue({ code: "custom", path: ["password"], message: "Au moins une lettre" });
    else if (!/[0-9]/.test(d.password)) ctx.addIssue({ code: "custom", path: ["password"], message: "Au moins un chiffre" });
  }
});

/** Mot de passe provisoire lisible (sans caractères ambigus), généré avec le hasard cryptographique. */
export function temporaryPassword(random: (n: number) => Uint8Array, length = 14): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
  const bytes = random(length);
  const body = Array.from(bytes, (b) => alphabet[b % alphabet.length]).join("");
  return `${body}#7`; // garantit un chiffre et un caractère spécial
}
