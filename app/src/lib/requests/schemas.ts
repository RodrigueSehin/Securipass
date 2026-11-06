import { z } from "zod";
import { optionalPhone, requiredPhone } from "../validation";

const base = {
  fullName: z.string().trim().min(2, "Nom requis").max(120),
  email: z.string().trim().toLowerCase().email("Adresse e-mail invalide").max(200),
  phone: optionalPhone(),
  message: z.string().trim().min(10, "10 caractères minimum").max(4000, "4000 caractères maximum"),
  // Champ piège : invisible pour les humains, rempli par les robots.
  website: z.string().max(0).optional().or(z.literal("")),
};

export const CONTACT_TOPICS = [
  { value: "particulier", label: "Particulier" },
  { value: "entreprise", label: "Entreprise" },
  { value: "institution", label: "Institution" },
  { value: "partenariat", label: "Partenariat" },
  { value: "autre", label: "Autre demande" },
] as const;

export const contactSchema = z.object({
  kind: z.literal("contact"),
  ...base,
  phone: requiredPhone("Téléphone requis"),
  requestType: z.enum(CONTACT_TOPICS.map((t) => t.value) as [string, ...string[]], { message: "Choisissez un type de demande" }),
  subject: z.string().trim().min(3, "Objet requis").max(150),
});

export const quoteSchema = z.object({
  kind: z.literal("quote"),
  ...base,
  organization: z.string().trim().min(2, "Nom de l’entreprise requis").max(150),
  headcount: z.coerce.number().int("Nombre entier").min(1, "Au moins 1").max(100000),
});

export const trainerSchema = z.object({
  kind: z.literal("trainer_application"),
  ...base,
  phone: requiredPhone("Téléphone requis pour être recontacté"),
  specialty: z.string().trim().min(3, "Spécialité requise").max(150),
  experienceYears: z.coerce.number().int("Nombre entier").min(0).max(60),
});

/** Inscription à la newsletter : seule l'adresse e-mail est demandée ; nom et message sont des valeurs techniques. */
export const newsletterSchema = z.object({
  kind: z.literal("newsletter"),
  email: base.email,
  fullName: z.string().default("Abonné newsletter"),
  message: z.string().default("Inscription à la newsletter du blog."),
  website: base.website,
});

export const requestSchema = z.discriminatedUnion("kind", [contactSchema, quoteSchema, trainerSchema, newsletterSchema]);
export type RequestKind = z.infer<typeof requestSchema>["kind"];

/** Limites anti-abus : requêtes autorisées par heure. */
export const RATE_LIMITS = { perEmail: 3, perIp: 8 } as const;

export function isRateLimited(counts: { byEmail: number; byIp: number }): boolean {
  return counts.byEmail >= RATE_LIMITS.perEmail || counts.byIp >= RATE_LIMITS.perIp;
}
