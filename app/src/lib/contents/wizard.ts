import { toDatetimeLocal } from "@/lib/format";

/** Assistant « Ajouter un contenu pédagogique » : étapes, adresses et valeurs initiales (pur : testé unitairement). */

export const CONTENT_STEPS = ["Type et informations", "Contenu et fichier", "Paramètres pédagogiques", "Aperçu"] as const;
export const CONTENT_STEP_COUNT = CONTENT_STEPS.length;

export function parseContentStep(value: string | undefined): number {
  const n = Math.floor(Number(value));
  return Number.isFinite(n) && n >= 1 && n <= CONTENT_STEP_COUNT ? n : 1;
}

/** Destination après l'enregistrement d'une étape : une étape (« 2 »), la bibliothèque (« list »), ou l'étape suivante par défaut. */
export function contentWizardUrl(contentId: string, next: string | undefined | null, fallbackStep = 2): string {
  if (next === "list") return "/formateur/contenus";
  const n = Math.floor(Number(next));
  const step = Number.isFinite(n) && n >= 1 && n <= CONTENT_STEP_COUNT ? n : fallbackStep;
  return `/formateur/contenus/nouveau/${contentId}?etape=${step}`;
}

/** Types de contenu de l'étape 1, avec leur sous-titre et les formats de fichier acceptés. */
export const TYPE_CARDS = {
  document: { label: "Document", hint: "PDF, Word, PPT…" },
  video: { label: "Vidéo", hint: "MP4, YouTube…" },
  quiz: { label: "Quiz", hint: "Quiz en ligne" },
  case_study: { label: "Étude de cas", hint: "Situation réelle" },
  practice: { label: "Activité pratique", hint: "Exercice terrain" },
} as const;

/** Types MIME acceptés pour le fichier principal selon le type de contenu. */
export const MAIN_FILE_TYPES: Record<string, string[]> = {
  document: [
    "application/pdf", "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.ms-powerpoint", "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    "application/vnd.ms-excel", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ],
  video: ["video/mp4", "video/webm"],
  case_study: ["application/pdf", "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "image/jpeg", "image/png"],
  practice: ["application/pdf", "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "image/jpeg", "image/png"],
};

/** Le type exige un fichier ou un lien pour être publié (quiz : une activité ; étude de cas et activité : un énoncé). */
export const NEEDS_MEDIA = new Set(["document", "video", "pdf", "presentation", "link"]);

export const MAX_FILE_MB = 100;

/** Nom d'affichage d'un fichier stocké : le chemin porte un identifiant devant le nom d'origine. */
export function displayFileName(path: string | null | undefined, name?: string | null): string {
  if (name) return name;
  if (!path) return "";
  return (path.split("/").pop() ?? "").replace(/^[0-9a-f-]{36}-/, "");
}

export type WizardContent = Partial<{
  module_id: string; content_type: string; title: string; description: string | null; body: string | null;
  external_url: string | null; file_path: string | null; file_name: string | null; file_size_bytes: number | null; file_mime: string | null;
  evaluation_id: string | null; duration_minutes: number; position: number; required_level: string;
  prerequisite_content_id: string | null; is_required: boolean; counts_in_progress: boolean; allow_download: boolean;
  allow_comments: boolean; show_in_outline: boolean; is_visible: boolean; notify_learners: boolean;
  publish_at: string | null; available_until: string | null; status: string;
}>;

const flag = (value: boolean | undefined, fallback: boolean) => ((value ?? fallback) ? "1" : "0");

/** Valeurs initiales (texte) des formulaires de l'assistant. */
export function contentToValues(c: WizardContent): Record<string, string> {
  return {
    moduleId: c.module_id ?? "",
    contentType: c.content_type ?? "document",
    title: c.title ?? "",
    description: c.description ?? "",
    body: c.body ?? "",
    externalUrl: c.external_url ?? "",
    filePath: c.file_path ?? "",
    fileName: c.file_name ?? "",
    fileSize: c.file_size_bytes ? String(c.file_size_bytes) : "",
    fileMime: c.file_mime ?? "",
    evaluationId: c.evaluation_id ?? "",
    durationMinutes: c.duration_minutes ? String(c.duration_minutes) : "",
    position: c.position ? String(c.position) : "",
    requiredLevel: c.required_level ?? "beginner",
    prerequisiteContentId: c.prerequisite_content_id ?? "",
    isRequired: flag(c.is_required, true),
    countsInProgress: flag(c.counts_in_progress, true),
    allowDownload: flag(c.allow_download, true),
    allowComments: flag(c.allow_comments, true),
    showInOutline: flag(c.show_in_outline, true),
    isVisible: flag(c.is_visible, true),
    notifyLearners: flag(c.notify_learners, false),
    publishAt: c.publish_at ? toDatetimeLocal(c.publish_at) : "",
    availableUntil: c.available_until ? toDatetimeLocal(c.available_until) : "",
  };
}
