import { toDatetimeLocal } from "@/lib/format";

/** Assistant de création d'une formation : étapes, adresses et valeurs initiales des formulaires (pur : testé unitairement). */

export const WIZARD_STEPS = ["Informations générales", "Contenu et programme", "Évaluation et certification", "Paramètres", "Aperçu et publication"] as const;

export const WIZARD_DESCRIPTIONS = [
  "Renseignez les informations de votre formation.",
  "Définissez le contenu et le programme de votre formation.",
  "Configurez les évaluations et la certification de votre formation.",
  "Configurez les paramètres de votre formation.",
  "Vérifiez l’aperçu et soumettez votre formation.",
] as const;

export const WIZARD_STEP_COUNT = WIZARD_STEPS.length;

/** Étape demandée dans l'adresse (« ?etape=3 »), ramenée entre 1 et 5. */
export function parseStep(value: string | undefined): number {
  const n = Math.floor(Number(value));
  return Number.isFinite(n) && n >= 1 && n <= WIZARD_STEP_COUNT ? n : 1;
}

/** Destination après l'enregistrement d'une étape : une étape (« 2 »), la liste (« list »), ou l'étape 2 par défaut. */
export function wizardUrl(courseId: string, next: string | undefined | null): string {
  if (next === "list") return "/formateur/formations";
  const n = Math.floor(Number(next));
  const step = Number.isFinite(n) && n >= 1 && n <= WIZARD_STEP_COUNT ? n : 2;
  return `/formateur/formations/nouveau/${courseId}?etape=${step}`;
}

/** Formation telle que lue en base : tous les champs sont facultatifs (valeurs par défaut appliquées à la conversion). */
export type WizardCourse = Partial<{
  title: string;
  subtitle?: string | null;
  category_id: string | null;
  course_code?: string | null;
  level: string;
  delivery_mode: string;
  duration_minutes: number;
  price_amount: number;
  language: string;
  certificate_template_id?: string | null;
  target_audience: string | null;
  prerequisites: string | null;
  default_capacity?: number | null;
  language_requirement?: string | null;
  description: string | null;
  objectives: string[];
  competencies: string[];
  cover_url: string | null;
  evaluation_modalities: string | null;
  certificate_conditions: string | null;
  certificate_validity_months: number | null;
  prerequisite_course_id: string | null;
  cancellation_policy: string | null;
  accessibility: string | null;
  keywords?: string[];
  audience_types?: string[];
  external_reference?: string | null;
  enrollment_mode?: string;
  evaluation_enabled: boolean;
  evaluation_types: string[];
  pass_mark_percent: number;
  grading_scale: number;
  grade_rounding: string;
  default_attempts: number;
  show_results: boolean;
  allow_retake: boolean;
  certificate_enabled: boolean;
  certificate_title: string | null;
  certificate_description: string | null;
  certificate_display: string[];
  publication_mode: string;
  publish_at: string | null;
  payment_methods: string[];
  allow_installments: boolean;
  allow_downloads: boolean;
  forum_enabled: boolean;
  allow_discussions: boolean;
  show_progress: boolean;
  notify_instructor: boolean;
  auto_certificate: boolean;
  parent_course_id: string | null;
  featured: boolean;
  registrations_open: boolean;
}>;

/** Valeurs initiales (texte) des champs de l'assistant, au format que lisent les composants d'étape. */
export function courseToValues(c: WizardCourse, accessCode = ""): Record<string, string> {
  const minutes = c.duration_minutes ?? 0;
  const hours = minutes / 60;
  return {
    title: c.title ?? "",
    subtitle: c.subtitle ?? "",
    categoryId: c.category_id ?? "",
    courseCode: c.course_code ?? "",
    level: c.level ?? "beginner",
    deliveryMode: c.delivery_mode ?? "onsite",
    durationHours: minutes > 0 ? String(Number(hours.toFixed(2))) : "",
    priceAmount: String(c.price_amount ?? 0),
    language: c.language ?? "fr",
    certificateTemplateId: c.certificate_template_id ?? "",
    targetAudience: c.target_audience ?? "",
    prerequisites: c.prerequisites ?? "",
    defaultCapacity: c.default_capacity ? String(c.default_capacity) : "",
    languageRequirement: c.language_requirement ?? "",
    description: c.description ?? "",
    objectives: (c.objectives ?? []).join("\n"),
    competencies: (c.competencies ?? []).join("\n"),
    coverUrl: c.cover_url ?? "",
    evaluationModalities: c.evaluation_modalities ?? "",
    certificateConditions: c.certificate_conditions ?? "",
    certificateValidityMonths: c.certificate_validity_months ? String(c.certificate_validity_months) : "",
    prerequisiteCourseId: c.prerequisite_course_id ?? "",
    cancellationPolicy: c.cancellation_policy ?? "",
    accessibility: c.accessibility ?? "",
    keywords: (c.keywords ?? []).join("\n"),
    audienceTypes: (c.audience_types ?? []).join(","),
    externalReference: c.external_reference ?? "",
    enrollmentMode: c.enrollment_mode ?? "free",
    accessCode,
    evaluationEnabled: (c.evaluation_enabled ?? true) ? "1" : "0",
    evaluationTypes: (c.evaluation_types ?? []).join(","),
    passMarkPercent: String(c.pass_mark_percent ?? 70),
    gradingScale: String(c.grading_scale ?? 20),
    gradeRounding: c.grade_rounding ?? "none",
    defaultAttempts: String(c.default_attempts ?? 1),
    showResults: (c.show_results ?? true) ? "1" : "0",
    allowRetake: (c.allow_retake ?? false) ? "1" : "0",
    certificateEnabled: (c.certificate_enabled ?? true) ? "1" : "0",
    certificateTitle: c.certificate_title ?? "",
    certificateDescription: c.certificate_description ?? "",
    publicationMode: c.publication_mode ?? "publish",
    publishAt: c.publish_at ? toDatetimeLocal(c.publish_at) : "",
    paymentMethods: (c.payment_methods ?? []).join(","),
    allowInstallments: (c.allow_installments ?? false) ? "1" : "0",
    allowDownloads: (c.allow_downloads ?? true) ? "1" : "0",
    forumEnabled: (c.forum_enabled ?? true) ? "1" : "0",
    allowDiscussions: (c.allow_discussions ?? true) ? "1" : "0",
    showProgress: (c.show_progress ?? true) ? "1" : "0",
    notifyInstructor: (c.notify_instructor ?? true) ? "1" : "0",
    autoCertificate: (c.auto_certificate ?? false) ? "1" : "0",
    parentCourseId: c.parent_course_id ?? "",
    featured: (c.featured ?? false) ? "1" : "0",
    registrationsOpen: (c.registrations_open ?? true) ? "1" : "0",
    certificateDisplay: (c.certificate_display ?? ["holder_name", "course_title", "issue_date", "qr", "trainer_signature", "issuer_signature", "number"]).join(","),
  };
}
