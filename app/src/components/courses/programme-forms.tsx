"use client";

import { useActionState, useState } from "react";
import { addContent, addModule, updateContent, updateModule } from "@/lib/courses/actions";
import type { FormState } from "@/lib/auth/actions";
import { CONTENT_TYPES, type ContentType } from "@/lib/courses/labels";
import type { ProgrammeModule } from "@/lib/courses/instructor-queries";
import { Button } from "@/components/ui/button";
import { Field, SelectField, TextareaField } from "@/components/ui/field";
import { Alert } from "@/components/ui/feedback";
import { FileUpload, IMAGE_TYPES, LESSON_FILE_TYPES } from "@/components/ui/file-upload";

export function ModuleForm({ courseId, module }: { courseId: string; module?: ProgrammeModule }) {
  const [state, action, pending] = useActionState<FormState, FormData>(module ? updateModule : addModule, {});
  const fe = state.fieldErrors;
  return (
    <form action={action} className="space-y-3" noValidate>
      <input type="hidden" name="courseId" value={courseId} />
      {module && <input type="hidden" name="moduleId" value={module.id} />}
      {state.error && <Alert>{state.error}</Alert>}
      {state.message && <Alert tone="success">{state.message}</Alert>}
      <Field label="Titre du module" name="title" id={`mtitle-${module?.id ?? "new"}`} required defaultValue={state.values?.title ?? module?.title} errors={fe?.title} />
      <TextareaField label="Description (facultatif)" name="description" id={`mdesc-${module?.id ?? "new"}`} rows={2} defaultValue={state.values?.description ?? module?.description ?? ""} errors={fe?.description} />
      <Button type="submit" disabled={pending}>{pending ? "Enregistrement…" : module ? "Enregistrer le module" : "Ajouter le module"}</Button>
    </form>
  );
}

type Content = ProgrammeModule["contents"][number];

export function ContentForm({ courseId, moduleId, content }: { courseId: string; moduleId: string; content?: Content }) {
  const [state, action, pending] = useActionState<FormState, FormData>(content ? updateContent : addContent, {});
  const [type, setType] = useState<ContentType>(content?.content_type ?? "video");
  const fe = state.fieldErrors;
  const v = state.values;
  const needsMedia = !["text", "practice"].includes(type);
  const suffix = content?.id ?? `new-${moduleId}`;

  return (
    <form action={action} className="space-y-3" noValidate>
      <input type="hidden" name="courseId" value={courseId} />
      <input type="hidden" name="moduleId" value={moduleId} />
      {content && <input type="hidden" name="contentId" value={content.id} />}
      {state.error && <Alert>{state.error}</Alert>}
      {state.message && <Alert tone="success">{state.message}</Alert>}
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Titre" name="title" id={`title-${suffix}`} required defaultValue={v?.title ?? content?.title} errors={fe?.title} />
        <SelectField label="Type de contenu" name="contentType" id={`type-${suffix}`} value={type} onChange={(e) => setType(e.target.value as ContentType)} errors={fe?.contentType}>
          {Object.entries(CONTENT_TYPES).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
        </SelectField>
      </div>
      {needsMedia && (
        <>
          <FileUpload
            name="filePath" label="Fichier" bucket="course-files" store="path" maxMb={50}
            accept={type === "pdf" ? ["application/pdf"] : type === "presentation" ? LESSON_FILE_TYPES.filter((t) => t.includes("presentation") || t.includes("powerpoint")) : type === "video" ? ["video/mp4", "video/webm"] : IMAGE_TYPES}
            defaultValue={content?.file_path ?? undefined}
            hint="Stockage privé, 50 Mo maximum. Ou indiquez un lien ci-dessous."
          />
          <Field label="Ou lien externe (https://…)" name="externalUrl" id={`url-${suffix}`} type="url" defaultValue={v?.externalUrl ?? content?.external_url ?? ""} errors={fe?.externalUrl} />
        </>
      )}
      {type === "text" && <TextareaField label="Contenu" name="body" id={`body-${suffix}`} rows={6} defaultValue={v?.body ?? content?.body ?? ""} errors={fe?.body} />}
      <TextareaField label={type === "practice" ? "Consigne de l’activité" : "Description / instructions (facultatif)"} name="description" id={`desc-${suffix}`} rows={2} defaultValue={v?.description ?? content?.description ?? ""} errors={fe?.description} />
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Durée estimée (minutes)" name="durationMinutes" id={`dur-${suffix}`} type="number" min="0" defaultValue={v?.durationMinutes ?? String(content?.duration_minutes ?? 0)} errors={fe?.durationMinutes} />
        <SelectField label="Statut" name="status" id={`status-${suffix}`} defaultValue={v?.status ?? content?.status ?? "draft"} hint="Seuls les contenus publiés sont accessibles aux inscrits." errors={fe?.status}>
          <option value="draft">Brouillon</option>
          <option value="published">Publié</option>
        </SelectField>
      </div>
      <Button type="submit" disabled={pending}>{pending ? "Enregistrement…" : content ? "Enregistrer le contenu" : "Ajouter le contenu"}</Button>
    </form>
  );
}
