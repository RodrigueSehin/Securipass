import { z } from "zod";
import { requiredPhone } from "../validation";

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email("Adresse e-mail invalide"),
  password: z.string().min(1, "Mot de passe requis"),
});

/** Version des conditions acceptées à l'inscription (à incrémenter quand le texte juridique change). */
export const TERMS_VERSION = "2026-10";
export const MIN_AGE = 16;

export const SITUATIONS = {
  individual: "Particulier",
  employee: "Salarié d’une entreprise",
  security_pro: "Professionnel de la sécurité",
  jobseeker: "En recherche d’emploi",
  student: "Étudiant",
  other: "Autre",
} as const;

/** Âge révolu à une date donnée, à partir d'une date « AAAA-MM-JJ ». Retourne null si la date est invalide. */
export function ageOn(birthDate: string, today: Date = new Date()): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(birthDate);
  if (!m) return null;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const probe = new Date(Date.UTC(y, mo - 1, d));
  if (probe.getUTCFullYear() !== y || probe.getUTCMonth() !== mo - 1 || probe.getUTCDate() !== d) return null; // ex. 31/02
  let age = today.getUTCFullYear() - y;
  if (today.getUTCMonth() + 1 < mo || (today.getUTCMonth() + 1 === mo && today.getUTCDate() < d)) age -= 1;
  return age;
}

const phone = requiredPhone();

const birthDate = z.string().superRefine((v, ctx) => {
  if (!v) return ctx.addIssue({ code: "custom", message: "Date de naissance requise" });
  const age = ageOn(v);
  if (age === null) return ctx.addIssue({ code: "custom", message: "Date de naissance invalide" });
  if (age < 0) return ctx.addIssue({ code: "custom", message: "La date de naissance ne peut pas être dans le futur" });
  if (age < MIN_AGE) return ctx.addIssue({ code: "custom", message: `Vous devez avoir au moins ${MIN_AGE} ans` });
  if (age > 110) return ctx.addIssue({ code: "custom", message: "Date de naissance invalide" });
});

const step1Shape = {
  fullName: z.string().trim().min(2, "Nom complet requis").max(120, "120 caractères maximum"),
  birthDate,
  email: z.string().trim().toLowerCase().email("Adresse e-mail invalide").max(200),
  phone,
  password: z
    .string()
    .min(10, "10 caractères minimum")
    .regex(/[A-Za-z]/, "Au moins une lettre")
    .regex(/[0-9]/, "Au moins un chiffre"),
  confirmPassword: z.string(),
  acceptTerms: z.literal("on", { error: "Vous devez accepter les conditions d’utilisation" }),
};

const step2Shape = {
  situation: z.enum(Object.keys(SITUATIONS) as [keyof typeof SITUATIONS, ...(keyof typeof SITUATIONS)[]]).default("individual"),
  interests: z.array(z.string().regex(/^[a-z0-9-]{1,80}$/)).max(10).default([]),
  notifyEmail: z.string().optional().transform((v) => v === "on"),
  notifySms: z.string().optional().transform((v) => v === "on"),
};

const samePassword = (d: { password: string; confirmPassword: string }) => d.password === d.confirmPassword;
const samePasswordIssue = { path: ["confirmPassword"], message: "Les mots de passe ne correspondent pas" };

export const registerStep1Schema = z.object(step1Shape).refine(samePassword, samePasswordIssue);
export const registerStep2Schema = z.object(step2Shape);
export const registerSchema = z.object({ ...step1Shape, ...step2Shape }).refine(samePassword, samePasswordIssue);
export type RegisterInput = z.infer<typeof registerSchema>;

/** Champs à valeurs multiples d'un formulaire (case à cocher répétées). */
const MULTI = new Set(["interests"]);

/** Convertit un FormData en objet en conservant les valeurs multiples (Object.fromEntries les écraserait). */
export function formDataToRecord(fd: FormData): Record<string, string | string[]> {
  const out: Record<string, string | string[]> = {};
  for (const key of new Set(fd.keys())) {
    const values = fd.getAll(key).filter((v): v is string => typeof v === "string");
    out[key] = MULTI.has(key) ? values : (values[0] ?? "");
  }
  return out;
}

/** Métadonnées transmises à l'authentification ; le déclencheur SQL les valide à nouveau (le client est non fiable). */
export function buildSignupMetadata(d: RegisterInput) {
  return {
    full_name: d.fullName,
    phone: d.phone,
    birth_date: d.birthDate,
    situation: d.situation,
    interests: d.interests,
    notify_email: d.notifyEmail,
    notify_sms: d.notifySms,
    terms_accepted: true,
    terms_version: TERMS_VERSION,
  };
}

/** N'autorise que des redirections internes (évite l'open redirect). */
export function safeRedirect(target: string | null | undefined, fallback: string): string {
  if (!target || !target.startsWith("/") || target.startsWith("//") || target.includes("\\")) return fallback;
  return target;
}
