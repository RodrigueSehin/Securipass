import { z } from "zod";
import { fromDatetimeLocal } from "@/lib/format";

const flag = () => z.enum(["0", "1"]).optional().transform((v) => (v === undefined ? undefined : v === "1"));

const clearable = (max: number, message?: string) =>
  z.string().trim().max(max, message).optional().transform((v) => (v === undefined ? undefined : v === "" ? null : v));

const optionalUuid = (message: string) => z.string().uuid(message).optional().or(z.literal("").transform(() => null));

/** Date saisie en heure d'Abidjan (« 2026-10-12T08:00 ») : absente → inchangée, vide → effacée, sinon valide. */
const dateField = z.string().trim().optional().transform((v) => (v === undefined ? undefined : v));

export const CONTENT_TYPE_VALUES = ["document", "video", "quiz", "case_study", "practice", "pdf", "presentation", "link", "text"] as const;

export const contentFields = z.object({
  moduleId: z.string().uuid("Choisissez un module"),
  contentType: z.enum(CONTENT_TYPE_VALUES, { error: "Choisissez un type de contenu" }),
  title: z.string().trim().min(2, "Titre requis (2 caractères minimum)").max(200, "200 caractères au maximum"),
  description: clearable(1000, "1 000 caractères au maximum"),
  body: clearable(2000, "2 000 caractères au maximum"),
  externalUrl: z.string().trim().url("Lien invalide").startsWith("https://", "Le lien doit commencer par https://").optional().or(z.literal("").transform(() => null)),
  filePath: clearable(500),
  fileName: clearable(255),
  fileSize: z.union([z.literal("").transform(() => null), z.coerce.number().int().min(0)]).optional(),
  fileMime: clearable(150),
  evaluationId: optionalUuid("Quiz invalide"),
  durationMinutes: z.coerce.number("Durée requise").int("Nombre entier").min(1, "Indiquez une durée d’au moins 1 minute").max(10000, "10 000 minutes au maximum"),
  position: z.union([z.literal("").transform(() => undefined), z.coerce.number().int("Nombre entier").min(1, "Position : 1 au minimum")]).optional(),
  requiredLevel: z.enum(["beginner", "intermediate", "advanced"], { error: "Niveau invalide" }).optional(),
  prerequisiteContentId: optionalUuid("Prérequis invalide"),
  isRequired: flag(),
  countsInProgress: flag(),
  allowDownload: flag(),
  allowComments: flag(),
  showInOutline: flag(),
  isVisible: flag(),
  notifyLearners: flag(),
  publishAt: dateField,
  availableUntil: dateField,
});

/** Les dates saisies doivent être valides ; la période de disponibilité doit se terminer après la publication. */
function dateRule(d: { publishAt?: string; availableUntil?: string }, ctx: z.RefinementCtx) {
  const start = d.publishAt ? fromDatetimeLocal(d.publishAt) : null;
  const end = d.availableUntil ? fromDatetimeLocal(d.availableUntil) : null;
  if (d.publishAt && !start) ctx.addIssue({ code: "custom", path: ["publishAt"], message: "Date de publication invalide" });
  if (d.availableUntil && !end) ctx.addIssue({ code: "custom", path: ["availableUntil"], message: "Date de fin invalide" });
  if (start && end && Date.parse(end) <= Date.parse(start)) {
    ctx.addIssue({ code: "custom", path: ["availableUntil"], message: "La fin de disponibilité doit suivre la date de publication" });
  }
}

/** Étape 1 : type, informations générales, fichier ou lien principal, réglages rapides. */
export const contentStep1Schema = contentFields.pick({
  moduleId: true, contentType: true, title: true, description: true, filePath: true, fileName: true, fileSize: true, fileMime: true,
  externalUrl: true, evaluationId: true, durationMinutes: true, requiredLevel: true, isRequired: true, allowDownload: true,
  countsInProgress: true, isVisible: true, allowComments: true,
});

/** Étape 2 : contenu textuel, fichier principal, quiz. */
export const contentStep2Schema = contentFields.pick({
  body: true, filePath: true, fileName: true, fileSize: true, fileMime: true, externalUrl: true, evaluationId: true,
});

/** Étape 3 : position, durée, niveau, prérequis, disponibilité et options. */
export const contentStep3Schema = contentFields.pick({
  moduleId: true, position: true, durationMinutes: true, requiredLevel: true, prerequisiteContentId: true, isRequired: true,
  publishAt: true, availableUntil: true, isVisible: true, allowDownload: true, allowComments: true, showInOutline: true,
  countsInProgress: true, notifyLearners: true,
}).superRefine(dateRule);

/** Lien complémentaire : adresse https et intitulé facultatif. */
export const attachmentLinkSchema = z.object({
  url: z.string().trim().url("Lien invalide").startsWith("https://", "Le lien doit commencer par https://"),
  name: z.string().trim().max(200).optional(),
});

export { fromDatetimeLocal };
