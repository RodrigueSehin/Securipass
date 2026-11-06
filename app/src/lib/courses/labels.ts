export const LEVELS = { beginner: "Débutant", intermediate: "Intermédiaire", advanced: "Avancé" } as const;
export const MODES = { onsite: "Présentiel", online: "En ligne", hybrid: "Hybride" } as const;
export const CONTENT_TYPES = {
  document: "Document", video: "Vidéo", quiz: "Quiz", case_study: "Étude de cas", practice: "Activité pratique",
  pdf: "Document PDF", presentation: "Présentation", link: "Lien externe", text: "Texte",
} as const;

/** Types proposés par l'assistant « Ajouter un contenu » ; les autres existent pour les contenus créés auparavant. */
export const WIZARD_CONTENT_TYPES = ["document", "video", "quiz", "case_study", "practice"] as const;
export const LEGACY_CONTENT_TYPES = ["video", "pdf", "presentation", "link", "text", "practice"] as const;

export const REQUIRED_LEVELS = { beginner: "Débutant", intermediate: "Intermédiaire", advanced: "Avancé" } as const;

export const LANGUAGE_REQUIREMENTS = { basic: "Notions", intermediate: "Intermédiaire", fluent: "Courant" } as const;
export type Level = keyof typeof LEVELS;
export type Mode = keyof typeof MODES;
export type ContentType = keyof typeof CONTENT_TYPES;

export const COURSE_STATUS = {
  draft: { label: "Brouillon", tone: "neutral" },
  in_review: { label: "En révision", tone: "warning" },
  published: { label: "Publiée", tone: "success" },
  rejected: { label: "Rejetée", tone: "danger" },
  archived: { label: "Archivée", tone: "neutral" },
} as const;
export type CourseStatus = keyof typeof COURSE_STATUS;

export const ENROLLMENT_STATUS = {
  pending_payment: { label: "Paiement en attente", tone: "warning" },
  pending_approval: { label: "En attente de validation", tone: "warning" },
  confirmed: { label: "Confirmée", tone: "success" },
  waitlisted: { label: "Liste d’attente", tone: "info" },
  cancelled: { label: "Annulée", tone: "neutral" },
  completed: { label: "Terminée", tone: "success" },
  suspended: { label: "Suspendue", tone: "warning" },
  expired: { label: "Expirée", tone: "neutral" },
} as const;
export type EnrollmentStatus = keyof typeof ENROLLMENT_STATUS;

export const SESSION_STATUS = {
  draft: { label: "Brouillon", tone: "neutral" },
  scheduled: { label: "Planifiée", tone: "info" },
  cancelled: { label: "Annulée", tone: "danger" },
  completed: { label: "Terminée", tone: "success" },
} as const;
