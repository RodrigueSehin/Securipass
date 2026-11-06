import { z } from "zod";
import { optionalPhone } from "../validation";

export const TIMEZONES = ["Africa/Abidjan", "Africa/Dakar", "Africa/Lagos", "Africa/Douala", "Europe/Paris", "UTC"] as const;

export const profileSchema = z.object({
  fullName: z.string().trim().min(2, "Nom complet requis").max(120),
  phone: optionalPhone(),
  timezone: z.enum(TIMEZONES, { error: "Fuseau horaire invalide" }),
});

export const passwordSchema = z
  .object({
    currentPassword: z.string().min(1, "Mot de passe actuel requis"),
    newPassword: z
      .string()
      .min(10, "10 caractères minimum")
      .regex(/[A-Za-z]/, "Au moins une lettre")
      .regex(/[0-9]/, "Au moins un chiffre"),
    confirmPassword: z.string(),
  })
  .refine((d) => d.newPassword === d.confirmPassword, {
    path: ["confirmPassword"],
    message: "Les mots de passe ne correspondent pas",
  })
  .refine((d) => d.newPassword !== d.currentPassword, {
    path: ["newPassword"],
    message: "Le nouveau mot de passe doit être différent de l’actuel",
  });

/** Valeur texte facultative : vide = absente ; sinon bornée et sans espaces superflus. */
const optionalText = (min: number, max: number, message: string) =>
  z.string().trim().max(max, message).optional().transform((v) => v || undefined)
    .refine((v) => v === undefined || v.length >= min, { message });

export const GENDERS = { female: "Femme", male: "Homme", other: "Autre", prefer_not_say: "Préfère ne pas préciser" } as const;
export const EXPERIENCE = { under_2: "Moins de 2 ans", "2_to_5": "2 à 5 ans", "5_to_10": "5 à 10 ans", over_10: "Plus de 10 ans" } as const;
export const EDUCATION = {
  primary: "Primaire", secondary: "Secondaire", baccalaureate: "Baccalauréat", bachelor: "Licence", master: "Master ou plus", other: "Autre",
} as const;
export const AVAILABILITY = { full_time: "Temps plein", part_time: "Temps partiel", evenings: "Soirs", weekends: "Week-ends" } as const;
export const LANGUAGES = { fr: "Français", en: "Anglais", ar: "Arabe", es: "Espagnol", pt: "Portugais", wo: "Wolof", dyu: "Dioula" } as const;

const pick = <T extends Record<string, string>>(map: T) => z.enum(Object.keys(map) as [keyof T & string, ...string[]]);

export const personalSchema = z.object({
  fullName: z.string().trim().min(2, "Nom complet requis").max(120),
  phone: optionalPhone(),
  timezone: z.enum(TIMEZONES, { error: "Fuseau horaire invalide" }),
  gender: pick(GENDERS).optional().or(z.literal("").transform(() => undefined)),
  nationality: optionalText(2, 60, "60 caractères maximum"),
  locality: optionalText(2, 120, "Au moins 2 caractères"),
  address: optionalText(2, 200, "Au moins 2 caractères"),
});

export const professionalSchema = z.object({
  profession: optionalText(2, 120, "Au moins 2 caractères"),
  employer: optionalText(2, 120, "Au moins 2 caractères"),
  experienceBand: pick(EXPERIENCE).optional().or(z.literal("").transform(() => undefined)),
  educationLevel: pick(EDUCATION).optional().or(z.literal("").transform(() => undefined)),
  languages: z.array(pick(LANGUAGES)).max(10).default([]),
  availability: pick(AVAILABILITY).optional().or(z.literal("").transform(() => undefined)),
  trainingGoal: optionalText(2, 300, "Au moins 2 caractères"),
});

export const preferencesSchema = z.object({
  notifyEmail: z.preprocess((v) => v === "on" || v === "true", z.boolean()),
  notifySms: z.preprocess((v) => v === "on" || v === "true", z.boolean()),
});

export const PHOTO_MAX_BYTES = 2 * 1024 * 1024;
export const PHOTO_TYPES = ["image/jpeg", "image/png"] as const;
