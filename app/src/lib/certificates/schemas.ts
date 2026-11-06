import { z } from "zod";

const uuid = z.string().uuid();

/** Saisie du formulaire d'émission. Les champs vides prennent la valeur du modèle. */
export const issueSchema = z.object({
  enrollmentId: uuid,
  templateId: uuid,
  title: z.string().trim().max(200).optional().transform((v) => v || undefined),
  body: z.string().trim().max(2000).optional().transform((v) => v || undefined),
  signatoryName: z.string().trim().max(120).optional().transform((v) => v || ""),
  signatoryRole: z.string().trim().max(120).optional().transform((v) => v || ""),
  validityMonths: z.string().optional().transform((v) => (v ? Number(v) : undefined))
    .pipe(z.number().int().min(1).max(120).optional()),
});

export const reissueSchema = issueSchema.omit({ enrollmentId: true }).extend({
  certificateId: uuid,
  reason: z.string().trim().min(3, "Indiquez le motif de la réémission.").max(500),
});

export const statusSchema = z.object({
  certificateId: uuid,
  action: z.enum(["suspend", "reinstate", "revoke"]),
  reason: z.string().trim().max(500).optional().transform((v) => v || undefined),
});

/** Codes d'erreur des fonctions SQL → messages utilisateur. */
const MESSAGES: Record<string, string> = {
  not_eligible: "Le certificat ne peut pas être émis : les conditions de la formation ne sont pas remplies.",
  forbidden: "Vous n’êtes pas autorisé à gérer les certificats de cette formation.",
  template_not_available: "Ce modèle n’est pas publié.",
  template_required: "Choisissez un modèle.",
  enrollment_not_found: "Inscription introuvable.",
  certificate_not_found: "Certificat introuvable.",
  certificate_revoked: "Ce certificat est déjà révoqué.",
  reason_required: "Indiquez un motif d’au moins trois caractères.",
  invalid_transition: "Cette action n’est pas possible pour l’état actuel du certificat.",
  certificates_one_active: "Un certificat valide existe déjà pour cette inscription. Réémettez-le plutôt que d’en créer un second.",
};

export function certificateErrorMessage(message: string | undefined): string {
  const code = Object.keys(MESSAGES).find((k) => message?.includes(k));
  return code ? MESSAGES[code] : "L’opération a échoué. Réessayez ; si le problème persiste, contactez le support.";
}
