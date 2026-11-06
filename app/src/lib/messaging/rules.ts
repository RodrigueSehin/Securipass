/** Règles côté application pour les pièces jointes (doublées par les contrôles SQL de send_message). */
export const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;

export const ALLOWED_ATTACHMENTS: Record<string, string> = {
  "application/pdf": "PDF",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "Word",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation": "PowerPoint",
  "image/jpeg": "JPEG",
  "image/png": "PNG",
};

export const MAX_BODY_CHARS = 4000;

/** Nom de fichier sûr : sans chemin, sans caractères spéciaux, 120 caractères au plus. */
export function safeFileName(name: string): string {
  const base = name.split(/[\/]/).pop() ?? "fichier";
  const cleaned = base.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^A-Za-z0-9._-]+/g, "_").replace(/^[._]+/, "");
  return (cleaned || "fichier").slice(0, 120);
}

export function attachmentProblem(file: { size: number; type: string }): string | null {
  if (!ALLOWED_ATTACHMENTS[file.type]) return "Type de fichier non accepté : PDF, Word, PowerPoint, JPEG ou PNG.";
  if (file.size < 1 || file.size > MAX_ATTACHMENT_BYTES) return "Le fichier doit peser entre 1 octet et 10 Mo.";
  return null;
}

const MESSAGES: Record<string, string> = {
  not_enrolled: "Vous devez être inscrit à la formation pour écrire à son formateur.",
  forbidden: "Vous n’avez pas accès à cette conversation.",
  empty_message: "Écrivez un message ou joignez un fichier.",
  message_too_long: "Le message dépasse 4000 caractères.",
  attachment_invalid: "Le fichier n’est pas rattaché à cette conversation.",
  attachment_type_not_allowed: "Type de fichier non accepté : PDF, Word, PowerPoint, JPEG ou PNG.",
  attachment_too_large: "Le fichier dépasse 10 Mo.",
  not_authenticated: "Connectez-vous pour continuer.",
};

export function messagingErrorMessage(message: string | undefined): string {
  const code = Object.keys(MESSAGES).find((k) => message?.includes(k));
  return code ? MESSAGES[code] : "Le message n’a pas pu être envoyé. Réessayez.";
}
