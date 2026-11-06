"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import type { FormState } from "@/lib/auth/actions";
import { contentSchema, courseReadiness, courseSchema, evaluationStepSchema, moduleSchema, publicationStepSchema, settingsStepSchema } from "./schemas";
import { wizardUrl } from "./wizard";
import { syncEvaluationTexts } from "./evaluation-sync";
import { fromDatetimeLocal } from "@/lib/format";
import { slugify, withSuffix } from "./slug";

const uuid = z.string().uuid();

const entries = (fd: FormData) => Object.fromEntries(fd) as Record<string, string>;
const stringValues = (fd: FormData) =>
  Object.fromEntries([...fd.entries()].filter(([, v]) => typeof v === "string")) as Record<string, string>;

async function auth() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return { supabase, user };
}

function dbPayload(d: ReturnType<typeof courseSchema.parse>) {
  return {
    title: d.title,
    category_id: d.categoryId,
    description: d.description,
    objectives: d.objectives,
    target_audience: d.targetAudience ?? null,
    prerequisites: d.prerequisites ?? null,
    prerequisite_course_id: d.prerequisiteCourseId ?? null,
    competencies: d.competencies,
    level: d.level,
    delivery_mode: d.deliveryMode,
    duration_minutes: Math.round(d.durationHours * 60),
    price_amount: d.priceAmount,
    language: d.language,
    evaluation_modalities: d.evaluationModalities ?? null,
    certificate_conditions: d.certificateConditions ?? null,
    certificate_validity_months: d.certificateValidityMonths ?? null,
    cancellation_policy: d.cancellationPolicy ?? null,
    accessibility: d.accessibility ?? null,
    cover_url: d.coverUrl ?? null,
    subtitle: d.subtitle,
    course_code: d.courseCode,
    external_reference: d.externalReference,
    certificate_template_id: d.certificateTemplateId,
    audience_types: d.audienceTypes,
    keywords: d.keywords,
    default_capacity: d.defaultCapacity,
    language_requirement: d.languageRequirement,
    enrollment_mode: d.enrollmentMode,
  };
}

/** Le code d'accès vit dans une table à part (jamais lisible publiquement) : créé, remplacé ou supprimé selon le mode choisi. */
async function saveAccessCode(supabase: Awaited<ReturnType<typeof createClient>>, courseId: string, d: { enrollmentMode?: string; accessCode?: string | null }) {
  if (d.enrollmentMode === undefined) return;
  if (d.enrollmentMode === "code" && d.accessCode) {
    await supabase.from("course_access_codes").upsert({ course_id: courseId, code: d.accessCode }, { onConflict: "course_id" });
  } else if (d.enrollmentMode !== "code") {
    await supabase.from("course_access_codes").delete().eq("course_id", courseId);
  }
}

/** Champs à valeurs multiples (cases à cocher, mots-clés). Absents du formulaire → undefined : la valeur reste inchangée. */
function listFields(fd: FormData) {
  return {
    audienceTypes: fd.has("audienceTypes") ? fd.getAll("audienceTypes").map(String).filter(Boolean) : undefined,
    keywords: fd.has("keywords") ? fd.getAll("keywords").map(String).filter(Boolean) : undefined,
    evaluationTypes: fd.has("evaluationTypes") ? fd.getAll("evaluationTypes").map(String).filter(Boolean) : undefined,
    certificateDisplay: fd.has("certificateDisplay") ? fd.getAll("certificateDisplay").map(String).filter(Boolean) : undefined,
    paymentMethods: fd.has("paymentMethods") ? fd.getAll("paymentMethods").map(String).filter(Boolean) : undefined,
  };
}

/** Création (sans id) ou mise à jour (avec id) d'une formation par son formateur. */
export async function saveCourse(_prev: FormState, formData: FormData): Promise<FormState> {
  const lists = listFields(formData);
  const values = {
    ...stringValues(formData),
    keywords: (lists.keywords ?? []).join("\n"),
    audienceTypes: (lists.audienceTypes ?? []).join(","),
  };
  const { supabase, user } = await auth();
  if (!user) return { error: "Session expirée. Reconnectez-vous." };

  const parsed = courseSchema.safeParse({ ...entries(formData), ...lists });
  if (!parsed.success) return { fieldErrors: parsed.error.flatten().fieldErrors, values };
  const payload = dbPayload(parsed.data);

  const idRaw = formData.get("id")?.toString();

  const next = formData.get("next")?.toString();
  // À la création (et à l'étape 1 de l'assistant), on exige le code, le public cible et (s'il existe des modèles publiés) le certificat délivré.
  if (!idRaw || formData.get("wizard") === "1") {
    const missing: Record<string, string[]> = {};
    if (!parsed.data.courseCode) missing.courseCode = ["Le code de la formation est requis"];
    if (!parsed.data.targetAudience) missing.targetAudience = ["Précisez le public cible"];
    const { count: templates } = await supabase.from("certificate_templates").select("id", { count: "exact", head: true }).eq("status", "published");
    if ((templates ?? 0) > 0 && !parsed.data.certificateTemplateId) missing.certificateTemplateId = ["Choisissez le certificat délivré"];
    if (Object.keys(missing).length) return { fieldErrors: missing, values };
  }
  if (idRaw) {
    const id = uuid.safeParse(idRaw);
    if (!id.success) return { error: "Formation introuvable.", values };
    const before = await supabase.from("courses").select("status").eq("id", id.data).maybeSingle();
    const { data, error } = await supabase.from("courses").update(payload).eq("id", id.data).select("status").maybeSingle();
    if (error || !data) return { error: "Impossible d’enregistrer la formation.", values };
    await saveAccessCode(supabase, id.data, parsed.data);
    revalidatePath(`/formateur/formations/${id.data}`, "layout");
    if (next) redirect(wizardUrl(id.data, next));
    const resent = before.data?.status === "published" && data.status === "in_review";
    return {
      message: resent
        ? "Modifications enregistrées. Cette formation publiée est renvoyée en validation pédagogique : elle n’apparaîtra plus au catalogue tant qu’elle n’est pas revalidée."
        : "Modifications enregistrées.",
      values,
    };
  }

  const base = slugify(parsed.data.title);
  for (let attempt = 0; attempt < 4; attempt++) {
    const { data, error } = await supabase
      .from("courses")
      .insert({ ...payload, instructor_id: user.id, slug: withSuffix(base, attempt), status: "draft" })
      .select("id")
      .single();
    if (!error && data) {
      await saveAccessCode(supabase, data.id, parsed.data);
      revalidatePath("/formateur/formations");
      redirect(wizardUrl(data.id, next ?? "2"));
    }
    if (error?.code !== "23505") return { error: "Impossible de créer la formation. Vérifiez vos droits formateur.", values };
  }
  return { error: "Impossible de générer un identifiant unique pour cette formation. Modifiez le titre.", values };
}

/** Enregistrement d'une étape de l'assistant qui ne porte que sur une partie de la formation (étapes 3 et 4). */
export async function saveCourseStep(_prev: FormState, formData: FormData): Promise<FormState> {
  const id = uuid.safeParse(formData.get("courseId"));
  const step = formData.get("step")?.toString();
  const next = formData.get("next")?.toString();
  if (!id.success || (step !== "3" && step !== "4" && step !== "5")) return { error: "Formation introuvable." };
  const lists = listFields(formData);
  const values = {
    ...stringValues(formData),
    keywords: (lists.keywords ?? []).join("\n"),
    audienceTypes: (lists.audienceTypes ?? []).join(","),
    evaluationTypes: (lists.evaluationTypes ?? []).join(","),
    certificateDisplay: (lists.certificateDisplay ?? []).join(","),
    paymentMethods: (lists.paymentMethods ?? []).join(","),
  };
  const { supabase, user } = await auth();
  if (!user) return { error: "Session expirée. Reconnectez-vous." };
  const input = { ...entries(formData), ...lists };

  let payload: Record<string, unknown>;
  let accessCode: { enrollmentMode?: string; accessCode?: string | null } | null = null;
  if (step === "3") {
    const parsed = evaluationStepSchema.safeParse(input);
    if (!parsed.success) return { fieldErrors: parsed.error.flatten().fieldErrors, values };
    payload = {
      evaluation_enabled: parsed.data.evaluationEnabled,
      evaluation_types: parsed.data.evaluationTypes,
      pass_mark_percent: parsed.data.passMarkPercent,
      grading_scale: parsed.data.gradingScale,
      grade_rounding: parsed.data.gradeRounding,
      default_attempts: parsed.data.defaultAttempts,
      show_results: parsed.data.showResults,
      allow_retake: parsed.data.allowRetake,
      certificate_enabled: parsed.data.certificateEnabled,
      certificate_template_id: parsed.data.certificateTemplateId,
      certificate_title: parsed.data.certificateTitle,
      certificate_description: parsed.data.certificateDescription,
      certificate_display: parsed.data.certificateDisplay,
      certificate_validity_months: parsed.data.certificateValidityMonths ?? null,
    };
  } else if (step === "5") {
    const parsed = publicationStepSchema.safeParse(input);
    if (!parsed.success) return { fieldErrors: parsed.error.flatten().fieldErrors, values };
    payload = {
      publication_mode: parsed.data.publicationMode,
      publish_at: parsed.data.publicationMode === undefined ? undefined : parsed.data.publicationMode === "scheduled" ? fromDatetimeLocal(parsed.data.publishAt ?? "") : null,
      featured: parsed.data.featured,
      registrations_open: parsed.data.registrationsOpen,
    };
  } else {
    const parsed = settingsStepSchema.safeParse(input);
    if (!parsed.success) return { fieldErrors: parsed.error.flatten().fieldErrors, values };
    if (formData.get("priceMode") === "paid" && (parsed.data.priceAmount ?? 0) <= 0) {
      return { fieldErrors: { priceAmount: ["Indiquez un prix supérieur à 0 pour une formation payante"] }, values };
    }
    const scheduled = parsed.data.publicationMode === "scheduled";
    payload = {
      publication_mode: parsed.data.publicationMode,
      // La date est saisie en heure d'Abidjan ; hors planification, aucune date n'est conservée.
      publish_at: parsed.data.publicationMode === undefined ? undefined : scheduled ? fromDatetimeLocal(parsed.data.publishAt ?? "") : null,
      price_amount: parsed.data.priceAmount,
      payment_methods: parsed.data.paymentMethods,
      allow_installments: parsed.data.allowInstallments,
      allow_downloads: parsed.data.allowDownloads,
      forum_enabled: parsed.data.forumEnabled,
      allow_discussions: parsed.data.allowDiscussions,
      show_progress: parsed.data.showProgress,
      notify_instructor: parsed.data.notifyInstructor,
      auto_certificate: parsed.data.autoCertificate,
      parent_course_id: parsed.data.parentCourseId,
      enrollment_mode: parsed.data.enrollmentMode,
      audience_types: parsed.data.audienceTypes,
      prerequisite_course_id: parsed.data.prerequisiteCourseId ?? null,
      cancellation_policy: parsed.data.cancellationPolicy ?? null,
      accessibility: parsed.data.accessibility ?? null,
      keywords: parsed.data.keywords,
      external_reference: parsed.data.externalReference,
    };
    accessCode = parsed.data;
  }

  const { data, error } = await supabase.from("courses").update(payload).eq("id", id.data).select("id").maybeSingle();
  if (error || !data) return { error: "Impossible d’enregistrer cette étape.", values };
  if (accessCode) await saveAccessCode(supabase, id.data, accessCode);
  if (step === "3") await syncEvaluationTexts(supabase, id.data);
  revalidatePath("/formateur/formations", "layout");
  if (next) redirect(wizardUrl(id.data, next));
  return { message: "Modifications enregistrées.", values };
}

type Transition = "submit" | "withdraw" | "archive" | "restore";

const TARGET: Record<Transition, string> = { submit: "in_review", withdraw: "draft", archive: "archived", restore: "draft" };

export async function courseTransition(_prev: FormState, formData: FormData): Promise<FormState> {
  const id = uuid.safeParse(formData.get("courseId"));
  const action = formData.get("action")?.toString() as Transition;
  if (!id.success || !(action in TARGET)) return { error: "Action invalide." };
  const { supabase, user } = await auth();
  if (!user) return { error: "Session expirée. Reconnectez-vous." };

  if (action === "submit") {
    const { data: c } = await supabase
      .from("courses")
      .select("category_id, description, objectives, target_audience, duration_minutes, evaluation_modalities, publication_mode, course_modules(id, learning_contents(status))")
      .eq("id", id.data)
      .maybeSingle();
    if (!c) return { error: "Formation introuvable." };
    if (c.publication_mode === "draft") {
      return { error: "Cette formation est réglée en brouillon. Choisissez « Publiée » ou « Planifiée » à l’étape 4 (Paramètres) pour la soumettre." };
    }
    const modules = (c.course_modules as unknown as { learning_contents: { status: string }[] }[]) ?? [];
    const missing = courseReadiness({
      categoryId: c.category_id,
      description: c.description,
      objectives: c.objectives ?? [],
      targetAudience: c.target_audience,
      durationMinutes: c.duration_minutes,
      evaluationModalities: c.evaluation_modalities,
      modules: modules.map((m) => ({ publishedContents: m.learning_contents.filter((l) => l.status === "published").length })),
    });
    if (missing.length) return { error: "Complétez la formation avant de la soumettre :", list: missing };
  }

  const { data, error } = await supabase.from("courses").update({ status: TARGET[action] }).eq("id", id.data).select("status").maybeSingle();
  if (error || !data) return { error: "Cette action n’est pas possible dans l’état actuel de la formation." };
  revalidatePath("/formateur/formations", "layout");
  const messages: Record<Transition, string> = {
    submit: "Formation soumise à la validation pédagogique.",
    withdraw: "Formation retirée de la validation : elle repasse en brouillon.",
    archive: "Formation archivée.",
    restore: "Formation remise en brouillon.",
  };
  return { message: messages[action] };
}

export async function duplicateCourse(formData: FormData): Promise<void> {
  const id = uuid.safeParse(formData.get("courseId"));
  if (!id.success) redirect("/formateur/formations");
  const { supabase } = await auth();
  const { data, error } = await supabase.rpc("duplicate_course", { p_course: id.data });
  if (error || !data) redirect("/formateur/formations?resultat=erreur");
  revalidatePath("/formateur/formations");
  redirect(`/formateur/formations/${data}?resultat=copie`);
}

/** Archivage depuis la liste : même transition que le panneau de la fiche (`courseTransition`, action « archive »). */
export async function archiveCourse(formData: FormData): Promise<void> {
  const id = uuid.safeParse(formData.get("courseId"));
  if (!id.success) redirect("/formateur/formations");
  const { supabase } = await auth();
  const { error } = await supabase.from("courses").update({ status: "archived" }).eq("id", id.data);
  revalidatePath("/formateur/formations", "layout");
  redirect(`/formateur/formations?resultat=${error ? "erreur" : "archivee"}`);
}

// ---------- Programme : modules et contenus ----------

const refresh = (courseId: string) => {
  revalidatePath(`/formateur/formations/${courseId}/programme`);
  revalidatePath("/formateur/contenus");
};

async function nextPosition(supabase: Awaited<ReturnType<typeof createClient>>, table: "course_modules" | "learning_contents", column: string, parent: string) {
  const { data } = await supabase.from(table).select("position").eq(column, parent).order("position", { ascending: false }).limit(1);
  return (data?.[0]?.position ?? 0) + 1;
}

export async function addModule(_prev: FormState, formData: FormData): Promise<FormState> {
  const courseId = uuid.safeParse(formData.get("courseId"));
  const parsed = moduleSchema.safeParse(entries(formData));
  if (!courseId.success) return { error: "Formation introuvable." };
  if (!parsed.success) return { fieldErrors: parsed.error.flatten().fieldErrors, values: stringValues(formData) };
  const { supabase } = await auth();
  const position = await nextPosition(supabase, "course_modules", "course_id", courseId.data);
  const { error } = await supabase.from("course_modules").insert({
    course_id: courseId.data, title: parsed.data.title, description: parsed.data.description ?? null, position,
  });
  if (error) return { error: "Impossible d’ajouter le module." };
  refresh(courseId.data);
  return { message: "Module ajouté." };
}

/** Ajoute un module depuis l'assistant puis le sélectionne. */
export async function addModuleAndSelect(_prev: FormState, formData: FormData): Promise<FormState> {
  const courseId = uuid.safeParse(formData.get("courseId"));
  const parsed = moduleSchema.safeParse(entries(formData));
  if (!courseId.success) return { error: "Formation introuvable." };
  if (!parsed.success) return { fieldErrors: parsed.error.flatten().fieldErrors, values: stringValues(formData) };
  const { supabase } = await auth();
  const position = await nextPosition(supabase, "course_modules", "course_id", courseId.data);
  const { data, error } = await supabase.from("course_modules").insert({
    course_id: courseId.data, title: parsed.data.title, description: parsed.data.description ?? null, position,
  }).select("id").single();
  if (error || !data) return { error: "Impossible d’ajouter le module.", values: stringValues(formData) };
  refresh(courseId.data);
  redirect(`/formateur/formations/nouveau/${courseId.data}?etape=2&module=${data.id}`);
}

export async function updateModule(_prev: FormState, formData: FormData): Promise<FormState> {
  const id = uuid.safeParse(formData.get("moduleId"));
  const courseId = uuid.safeParse(formData.get("courseId"));
  const parsed = moduleSchema.safeParse(entries(formData));
  if (!id.success || !courseId.success) return { error: "Module introuvable." };
  if (!parsed.success) return { fieldErrors: parsed.error.flatten().fieldErrors, values: stringValues(formData) };
  const { supabase } = await auth();
  const { data, error } = await supabase.from("course_modules")
    .update({ title: parsed.data.title, description: parsed.data.description ?? null }).eq("id", id.data).select("id").maybeSingle();
  if (error || !data) return { error: "Impossible de modifier le module." };
  const position = Number(formData.get("position"));
  if (Number.isInteger(position) && position >= 1) await moveToPosition(supabase, "course_modules", "course_id", courseId.data, id.data, position);
  refresh(courseId.data);
  return { message: "Module enregistré." };
}

export async function deleteModule(formData: FormData): Promise<void> {
  const id = uuid.safeParse(formData.get("moduleId"));
  const courseId = uuid.safeParse(formData.get("courseId"));
  if (!id.success || !courseId.success) return;
  const { supabase } = await auth();
  await supabase.from("course_modules").delete().eq("id", id.data);
  refresh(courseId.data);
}

function contentDb(d: ReturnType<typeof contentSchema.parse>) {
  return {
    title: d.title, content_type: d.contentType, description: d.description ?? null, body: d.body ?? null,
    external_url: d.externalUrl ?? null, file_path: d.filePath ?? null, duration_minutes: d.durationMinutes, status: d.status,
  };
}

export async function addContent(_prev: FormState, formData: FormData): Promise<FormState> {
  const moduleId = uuid.safeParse(formData.get("moduleId"));
  const courseId = uuid.safeParse(formData.get("courseId"));
  const parsed = contentSchema.safeParse(entries(formData));
  if (!moduleId.success || !courseId.success) return { error: "Module introuvable." };
  if (!parsed.success) return { fieldErrors: parsed.error.flatten().fieldErrors, values: stringValues(formData) };
  const { supabase } = await auth();
  const position = await nextPosition(supabase, "learning_contents", "module_id", moduleId.data);
  const { error } = await supabase.from("learning_contents").insert({ ...contentDb(parsed.data), module_id: moduleId.data, position });
  if (error) return { error: "Impossible d’ajouter le contenu.", values: stringValues(formData) };
  refresh(courseId.data);
  return { message: "Contenu ajouté." };
}

export async function updateContent(_prev: FormState, formData: FormData): Promise<FormState> {
  const id = uuid.safeParse(formData.get("contentId"));
  const courseId = uuid.safeParse(formData.get("courseId"));
  const parsed = contentSchema.safeParse(entries(formData));
  if (!id.success || !courseId.success) return { error: "Contenu introuvable." };
  if (!parsed.success) return { fieldErrors: parsed.error.flatten().fieldErrors, values: stringValues(formData) };
  const { supabase } = await auth();
  const { data, error } = await supabase.from("learning_contents").update(contentDb(parsed.data)).eq("id", id.data).select("id").maybeSingle();
  if (error || !data) return { error: "Impossible de modifier le contenu." };
  refresh(courseId.data);
  return { message: "Contenu enregistré." };
}

export async function deleteContent(formData: FormData): Promise<void> {
  const id = uuid.safeParse(formData.get("contentId"));
  const courseId = uuid.safeParse(formData.get("courseId"));
  if (!id.success || !courseId.success) return;
  const { supabase } = await auth();
  await supabase.from("learning_contents").delete().eq("id", id.data);
  refresh(courseId.data);
}

/** Copie d'un contenu dans le même module : brouillon, placé à la fin de la liste. */
export async function duplicateContent(formData: FormData): Promise<void> {
  const id = uuid.safeParse(formData.get("contentId"));
  const courseId = uuid.safeParse(formData.get("courseId"));
  if (!id.success || !courseId.success) return;
  const { supabase } = await auth();
  const { data: src } = await supabase.from("learning_contents")
    .select("module_id, title, content_type, description, body, external_url, file_path, duration_minutes")
    .eq("id", id.data)
    .maybeSingle<{
      module_id: string; title: string; content_type: string; description: string | null; body: string | null;
      external_url: string | null; file_path: string | null; duration_minutes: number;
    }>();
  if (!src) return;
  const position = await nextPosition(supabase, "learning_contents", "module_id", src.module_id);
  await supabase.from("learning_contents").insert({
    module_id: src.module_id,
    title: `${src.title.slice(0, 190)} (copie)`,
    content_type: src.content_type,
    description: src.description,
    body: src.body,
    external_url: src.external_url,
    file_path: src.file_path,
    duration_minutes: src.duration_minutes,
    position,
    status: "draft",
  });
  refresh(courseId.data);
}

/** Renumérote les éléments d'un parent selon l'ordre donné (positions 1, 2, 3…). */
async function applyOrder(supabase: Awaited<ReturnType<typeof createClient>>, table: "course_modules" | "learning_contents", ids: string[]) {
  await Promise.all(ids.map((rowId, i) => supabase.from(table).update({ position: i + 1 }).eq("id", rowId)));
}

/** Place un élément à une position donnée parmi ses frères. */
async function moveToPosition(
  supabase: Awaited<ReturnType<typeof createClient>>, table: "course_modules" | "learning_contents", parentCol: string, parentId: string, id: string, position: number,
) {
  const { data: siblings } = await supabase.from(table).select("id").eq(parentCol, parentId).order("position").order("id");
  const order = (siblings ?? []).map((s) => s.id).filter((x) => x !== id);
  order.splice(Math.min(Math.max(position, 1), order.length + 1) - 1, 0, id);
  await applyOrder(supabase, table, order);
}

/** Réordonne les modules d'une formation ou les contenus d'un module (glisser-déposer). L'ordre doit contenir exactement les éléments existants. */
export async function reorderItems(kind: "module" | "content", parentId: string, courseId: string, orderedIds: string[]): Promise<{ error?: string }> {
  const parent = uuid.safeParse(parentId);
  const course = uuid.safeParse(courseId);
  const ids = z.array(uuid).max(500).safeParse(orderedIds);
  if (!parent.success || !course.success || !ids.success || (kind !== "module" && kind !== "content")) return { error: "Ordre invalide." };
  const { supabase } = await auth();
  const table = kind === "module" ? "course_modules" : "learning_contents";
  const parentCol = kind === "module" ? "course_id" : "module_id";
  const { data: siblings } = await supabase.from(table).select("id").eq(parentCol, parent.data);
  const existing = new Set((siblings ?? []).map((s) => s.id));
  if (existing.size !== ids.data.length || ids.data.some((x) => !existing.has(x))) return { error: "La liste a changé : rechargez la page." };
  await applyOrder(supabase, table, ids.data);
  refresh(course.data);
  return {};
}

/** Publie ou repasse en brouillon un contenu (interrupteur de la liste des leçons). */
export async function setContentStatus(formData: FormData): Promise<void> {
  const id = uuid.safeParse(formData.get("contentId"));
  const courseId = uuid.safeParse(formData.get("courseId"));
  const status = formData.get("status") === "published" ? "published" : "draft";
  if (!id.success || !courseId.success) return;
  const { supabase } = await auth();
  await supabase.from("learning_contents").update({ status }).eq("id", id.data);
  refresh(courseId.data);
}

/** Déclare un fichier déjà envoyé dans le stockage comme ressource d'un module. */
export async function addModuleResource(input: {
  courseId: string; moduleId: string; name: string; filePath: string; sizeBytes: number; mimeType: string;
}): Promise<{ error?: string }> {
  const parsed = z.object({
    courseId: uuid, moduleId: uuid, name: z.string().trim().min(1).max(200),
    filePath: z.string().min(3).max(500), sizeBytes: z.number().int().min(0).max(104_857_600), mimeType: z.string().max(150),
  }).safeParse(input);
  if (!parsed.success) return { error: "Fichier invalide." };
  const { supabase, user } = await auth();
  if (!user) return { error: "Session expirée. Reconnectez-vous." };
  // Le fichier doit se trouver dans le dossier du formateur (règle du stockage) : on refuse tout autre chemin.
  if (!parsed.data.filePath.startsWith(`${user.id}/`) || parsed.data.filePath.includes("..")) return { error: "Fichier invalide." };
  const { error } = await supabase.from("module_resources").insert({
    module_id: parsed.data.moduleId, name: parsed.data.name, file_path: parsed.data.filePath,
    size_bytes: parsed.data.sizeBytes, mime_type: parsed.data.mimeType,
  });
  if (error) return { error: "La ressource n’a pas pu être enregistrée." };
  refresh(parsed.data.courseId);
  return {};
}

export async function deleteModuleResource(formData: FormData): Promise<void> {
  const id = uuid.safeParse(formData.get("resourceId"));
  const courseId = uuid.safeParse(formData.get("courseId"));
  if (!id.success || !courseId.success) return;
  const { supabase } = await auth();
  const { data } = await supabase.from("module_resources").select("file_path").eq("id", id.data).maybeSingle<{ file_path: string }>();
  await supabase.from("module_resources").delete().eq("id", id.data);
  if (data?.file_path) await supabase.storage.from("course-files").remove([data.file_path]);
  refresh(courseId.data);
}

/** Déplace un module ou un contenu d'un cran (positions renumérotées). */
export async function moveItem(formData: FormData): Promise<void> {
  const kind = formData.get("kind")?.toString();
  const id = uuid.safeParse(formData.get("id"));
  const courseId = uuid.safeParse(formData.get("courseId"));
  const dir = formData.get("direction")?.toString() === "up" ? -1 : 1;
  if (!id.success || !courseId.success || (kind !== "module" && kind !== "content")) return;
  const { supabase } = await auth();

  const table = kind === "module" ? "course_modules" : "learning_contents";
  const parentCol = kind === "module" ? "course_id" : "module_id";
  const { data: self } = await supabase.from(table).select(`id, ${parentCol}`).eq("id", id.data).maybeSingle();
  if (!self) return;
  const parent = (self as unknown as Record<string, string>)[parentCol];
  const { data: siblings } = await supabase.from(table).select("id").eq(parentCol, parent).order("position").order("id");
  const order = (siblings ?? []).map((s) => s.id);
  const i = order.indexOf(id.data);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= order.length) return;
  [order[i], order[j]] = [order[j], order[i]];
  await Promise.all(order.map((sid, idx) => supabase.from(table).update({ position: idx + 1 }).eq("id", sid)));
  refresh(courseId.data);
}
