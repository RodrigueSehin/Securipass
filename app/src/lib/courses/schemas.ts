import { z } from "zod";
import { splitLines } from "./slug";
import { fromDatetimeLocal } from "@/lib/format";

const optionalText = (max = 4000) =>
  z.string().trim().max(max).optional().transform((v) => (v ? v : undefined));

/** Champ texte facultatif qui peut être effacé : absent → undefined (inchangé), vide → null (effacé). */
const clearableText = (max: number) =>
  z.string().trim().max(max).optional().transform((v) => (v === undefined ? undefined : v === "" ? null : v));

/** Case à cocher envoyée en « 0 » / « 1 » : absente → inchangé. */
const flag = () => z.enum(["0", "1"]).optional().transform((v) => (v === undefined ? undefined : v === "1"));

const optionalInt2 = (min: number, max: number, message: string) =>
  z.union([z.literal("").transform(() => undefined), z.coerce.number(message).int(message).min(min, message).max(max, message)]).optional();

const EVALUATION_KINDS = ["quiz", "assignment", "case_study", "practical"] as const;
export const PAYMENT_METHODS = ["mobile_money", "card", "bank_transfer"] as const;
export const PAYMENT_METHOD_LABELS: Record<(typeof PAYMENT_METHODS)[number], string> = {
  mobile_money: "Mobile Money (Orange Money, MTN Money)",
  card: "Carte bancaire",
  bank_transfer: "Virement bancaire",
};

export const CERTIFICATE_DISPLAY = ["holder_name", "course_title", "issue_date", "qr", "trainer_signature", "issuer_signature", "number"] as const;

const AUDIENCE_TYPES = ["individuals", "companies", "administrations", "partners"] as const;

const optionalInt = (min: number, max: number) =>
  z
    .union([z.literal(""), z.coerce.number().int("Nombre entier").min(min, `Minimum ${min}`).max(max, `Maximum ${max}`)])
    .optional()
    .transform((v) => (v === "" || v === undefined ? undefined : v));

export const courseFields = z.object({
  title: z.string().trim().min(5, "Titre requis (5 caractères minimum)").max(150),
  categoryId: z.string().uuid("Choisissez une catégorie"),
  description: z.string().trim().min(30, "Décrivez la formation (30 caractères minimum)").max(5000),
  objectives: z.string().max(4000).transform(splitLines),
  targetAudience: optionalText(2000),
  prerequisites: optionalText(2000),
  prerequisiteCourseId: z.string().uuid().optional().or(z.literal("").transform(() => undefined)),
  competencies: z.string().max(4000).optional().transform(splitLines),
  level: z.enum(["beginner", "intermediate", "advanced"], { error: "Niveau invalide" }),
  deliveryMode: z.enum(["onsite", "online", "hybrid"], { error: "Format invalide" }),
  durationHours: z.coerce.number("Durée requise").positive("La durée doit être positive").max(2000, "Durée trop longue"),
  priceAmount: z.coerce.number("Prix requis").int("Prix en FCFA entiers").min(0, "Prix invalide").max(100_000_000),
  language: z.enum(["fr", "en"]).default("fr"),
  evaluationModalities: optionalText(3000),
  certificateConditions: optionalText(3000),
  certificateValidityMonths: optionalInt(1, 240),
  cancellationPolicy: optionalText(3000),
  accessibility: optionalText(2000),
  coverUrl: z.string().url().startsWith("https://").optional().or(z.literal("").transform(() => undefined)),
  subtitle: clearableText(150),
  courseCode: clearableText(40),
  externalReference: clearableText(120),
  certificateTemplateId: z.string().uuid("Modèle de certificat invalide").optional().or(z.literal("").transform(() => null)),
  audienceTypes: z.array(z.enum(AUDIENCE_TYPES, { error: "Public invalide" })).max(4).optional(),
  keywords: z.array(z.string().trim().min(1).max(40, "Mot-clé trop long")).max(20, "20 mots-clés au maximum").optional(),
  defaultCapacity: z.union([
    z.literal("").transform(() => null),
    z.coerce.number("Nombre de places invalide").int("Nombre entier").min(1, "Au moins 1 place").max(10000, "Maximum 10 000 places"),
  ]).optional(),
  languageRequirement: z.enum(["basic", "intermediate", "fluent"], { error: "Niveau de langue invalide" }).optional()
    .or(z.literal("").transform(() => null)),
  evaluationEnabled: flag(),
  evaluationTypes: z.array(z.enum(EVALUATION_KINDS, { error: "Type d’évaluation invalide" })).max(4).optional(),
  passMarkPercent: optionalInt2(0, 100, "Note minimale de réussite : entre 0 et 100 %"),
  gradingScale: z.enum(["10", "20", "100"], { error: "Type de notation invalide" }).optional().transform((v) => (v === undefined ? undefined : Number(v))),
  gradeRounding: z.enum(["none", "nearest", "up", "down"], { error: "Arrondi invalide" }).optional(),
  defaultAttempts: optionalInt2(1, 10, "Tentatives : entre 1 et 10"),
  showResults: flag(),
  allowRetake: flag(),
  certificateEnabled: flag(),
  certificateTitle: clearableText(200),
  certificateDescription: clearableText(500),
  certificateDisplay: z.array(z.enum(CERTIFICATE_DISPLAY, { error: "Élément de certificat invalide" })).max(7).optional(),
  featured: flag(),
  registrationsOpen: flag(),
  publicationMode: z.enum(["draft", "publish", "scheduled"], { error: "Mode de publication invalide" }).optional(),
  publishAt: z.string().trim().optional().transform((v) => (v ? v : undefined)),
  paymentMethods: z.array(z.enum(PAYMENT_METHODS, { error: "Moyen de paiement invalide" })).max(3).optional(),
  allowInstallments: flag(),
  allowDownloads: flag(),
  forumEnabled: flag(),
  allowDiscussions: flag(),
  showProgress: flag(),
  notifyInstructor: flag(),
  autoCertificate: flag(),
  parentCourseId: z.string().uuid("Formation parent invalide").optional().or(z.literal("").transform(() => null)),
  enrollmentMode: z.enum(["free", "approval", "code"], { error: "Mode d’inscription invalide" }).optional(),
  accessCode: z.string().trim().max(40, "40 caractères au maximum").optional()
    .transform((v) => (v === undefined ? undefined : v === "" ? null : v)),
});

const accessCodeRule = (d: { enrollmentMode?: string; accessCode?: string | null }, ctx: z.RefinementCtx) => {
  if (d.enrollmentMode === "code" && (!d.accessCode || d.accessCode.length < 4)) {
    ctx.addIssue({ code: "custom", path: ["accessCode"], message: "Saisissez un code d’accès d’au moins 4 caractères" });
  }
};

export const courseSchema = courseFields.superRefine(accessCodeRule);
export type CourseInput = z.infer<typeof courseSchema>;

/** Étape 3 de l'assistant : évaluation et certification. */
export const evaluationStepSchema = courseFields.pick({
  evaluationEnabled: true, evaluationTypes: true, passMarkPercent: true, gradingScale: true, gradeRounding: true,
  defaultAttempts: true, showResults: true, allowRetake: true, certificateEnabled: true, certificateTemplateId: true,
  certificateTitle: true, certificateDescription: true, certificateDisplay: true, certificateValidityMonths: true,
});

/** Étape 5 de l'assistant : paramètres de publication. */
export const publicationStepSchema = courseFields.pick({ publicationMode: true, publishAt: true, featured: true, registrationsOpen: true })
  .superRefine((d, ctx) => {
    if (d.publicationMode === "scheduled" && !fromDatetimeLocal(d.publishAt ?? "")) {
      ctx.addIssue({ code: "custom", path: ["publishAt"], message: "Choisissez la date et l’heure de publication" });
    }
  });

/** Étape 4 de l'assistant : paramètres (inscription, publics, annulation, accessibilité, mots-clés). */
export const settingsStepSchema = courseFields.pick({
  publicationMode: true, publishAt: true, priceAmount: true, paymentMethods: true, allowInstallments: true,
  allowDownloads: true, forumEnabled: true, allowDiscussions: true, showProgress: true, notifyInstructor: true, autoCertificate: true,
  parentCourseId: true,
  enrollmentMode: true, accessCode: true, audienceTypes: true, prerequisiteCourseId: true,
  cancellationPolicy: true, accessibility: true, keywords: true, externalReference: true,
}).superRefine(accessCodeRule).superRefine((d, ctx) => {
  if (d.publicationMode === "scheduled" && !fromDatetimeLocal(d.publishAt ?? "")) {
    ctx.addIssue({ code: "custom", path: ["publishAt"], message: "Choisissez la date et l’heure de publication" });
  }
});

export const AUDIENCE_LABELS: Record<(typeof AUDIENCE_TYPES)[number], string> = {
  individuals: "Particuliers / grand public",
  companies: "Entreprises",
  administrations: "Administrations",
  partners: "Organismes partenaires",
};

export const moduleSchema = z.object({
  title: z.string().trim().min(2, "Titre requis").max(200),
  description: optionalText(2000),
});

export const contentSchema = z
  .object({
    title: z.string().trim().min(2, "Titre requis").max(200),
    contentType: z.enum(["video", "pdf", "presentation", "link", "text", "practice"], { error: "Type invalide" }),
    description: optionalText(2000),
    body: optionalText(20000),
    externalUrl: z.string().trim().url("Lien invalide").startsWith("https://", "Le lien doit commencer par https://").optional().or(z.literal("").transform(() => undefined)),
    filePath: optionalText(500),
    durationMinutes: z.coerce.number().int().min(0).max(10000).default(0),
    status: z.enum(["draft", "published"]).default("draft"),
  })
  .superRefine((d, ctx) => {
    const needsMedia = !["text", "practice"].includes(d.contentType);
    if (needsMedia && !d.filePath && !d.externalUrl) {
      ctx.addIssue({ code: "custom", path: ["externalUrl"], message: "Ajoutez un fichier ou un lien https://" });
    }
    if (d.contentType === "text" && !d.body) {
      ctx.addIssue({ code: "custom", path: ["body"], message: "Le contenu texte est requis" });
    }
    if (d.contentType === "practice" && !d.description && !d.body) {
      ctx.addIssue({ code: "custom", path: ["description"], message: "Décrivez l’activité pratique" });
    }
  });

/** Contrôle avant soumission à la validation pédagogique : retourne les éléments manquants. */
export type ReadinessInput = {
  categoryId?: string | null;
  description?: string | null;
  objectives: string[];
  targetAudience?: string | null;
  durationMinutes: number;
  evaluationModalities?: string | null;
  modules: { publishedContents: number }[];
};

export function courseReadiness(c: ReadinessInput): string[] {
  const missing: string[] = [];
  if (!c.categoryId) missing.push("Choisissez une catégorie");
  if ((c.description ?? "").trim().length < 50) missing.push("Rédigez une description d’au moins 50 caractères");
  if (c.objectives.length === 0) missing.push("Ajoutez au moins un objectif pédagogique");
  if (!c.targetAudience?.trim()) missing.push("Précisez le public cible");
  if (c.durationMinutes <= 0) missing.push("Indiquez la durée de la formation");
  if (!c.evaluationModalities?.trim()) missing.push("Décrivez les modalités d’évaluation");
  if (c.modules.length === 0) missing.push("Ajoutez au moins un module au programme");
  else if (!c.modules.some((m) => m.publishedContents > 0)) missing.push("Publiez au moins un contenu dans le programme");
  return missing;
}
