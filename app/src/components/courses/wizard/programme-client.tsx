"use client";

import { useActionState, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { UploadCloud } from "lucide-react";
import { addModuleAndSelect, addModuleResource, reorderItems, updateModule } from "@/lib/courses/actions";
import type { FormState } from "@/lib/auth/actions";
import { Alert } from "@/components/ui/feedback";
import { Field } from "@/components/ui/field";
import { RichTextEditor } from "@/components/ui/rich-text-editor";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/browser";

/**
 * Liste réordonnable par glisser-déposer (modules d'une formation ou leçons d'un module). L'ordre est enregistré en base ;
 * le clavier passe par les actions « Monter » / « Descendre » du menu de chaque élément.
 */
export function SortableList({ kind, parentId, courseId, items, className }: {
  kind: "module" | "content"; parentId: string; courseId: string; className?: string;
  items: { id: string; node: React.ReactNode; selected?: boolean }[];
}) {
  const serverKey = items.map((i) => i.id).join(",");
  const [local, setLocal] = useState<{ key: string; order: string[] } | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [, start] = useTransition();
  const order = local && local.key === serverKey ? local.order : items.map((i) => i.id);
  const byId = new Map(items.map((i) => [i.id, i]));

  function drop(targetId: string) {
    if (!dragId || dragId === targetId) return;
    const next = order.filter((x) => x !== dragId);
    next.splice(next.indexOf(targetId) + (order.indexOf(dragId) < order.indexOf(targetId) ? 1 : 0), 0, dragId);
    setLocal({ key: serverKey, order: next });
    setError(null);
    start(async () => {
      const r = await reorderItems(kind, parentId, courseId, next);
      if (r.error) setError(r.error);
    });
  }

  return (
    <>
      {error && <p role="alert" className="mb-2 text-xs text-danger">{error}</p>}
      <ul className={className}>
        {order.map((id) => {
          const item = byId.get(id);
          if (!item) return null;
          return (
            <li
              key={id}
              draggable
              onDragStart={() => setDragId(id)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => { drop(id); setDragId(null); }}
              onDragEnd={() => setDragId(null)}
              className={dragId === id ? "opacity-50" : undefined}
            >
              {item.node}
            </li>
          );
        })}
      </ul>
    </>
  );
}

/** Bouton « Ajouter un module » : déplie un champ titre, crée le module puis le sélectionne. */
export function AddModuleForm({ courseId }: { courseId: string }) {
  const [state, action, pending] = useActionState<FormState, FormData>(addModuleAndSelect, {});
  return (
    <details className="group">
      <summary className="flex cursor-pointer list-none items-center justify-center gap-2 rounded-lg bg-brand px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-dark [&::-webkit-details-marker]:hidden">
        <span aria-hidden>+</span> Ajouter un module
      </summary>
      <form action={action} className="mt-3 space-y-2 rounded-xl border border-line bg-white p-3" noValidate>
        <input type="hidden" name="courseId" value={courseId} />
        {state.error && <Alert>{state.error}</Alert>}
        <Field label="Titre du module" name="title" id="new-module-title" required defaultValue={state.values?.title} errors={state.fieldErrors?.title} />
        <Button type="submit" disabled={pending} className="w-full">{pending ? "Création…" : "Créer le module"}</Button>
      </form>
    </details>
  );
}

/** Informations du module sélectionné : titre, ordre, description (la durée est la somme de ses leçons). */
export function ModuleEditor({ courseId, module, count, durationLabel }: {
  courseId: string; module: { id: string; title: string; description: string | null; position: number }; count: number; durationLabel: string;
}) {
  const [state, action, pending] = useActionState<FormState, FormData>(updateModule, {});
  const fe = state.fieldErrors;
  return (
    <form action={action} className="space-y-4" noValidate>
      <input type="hidden" name="courseId" value={courseId} />
      <input type="hidden" name="moduleId" value={module.id} />
      {state.error && <Alert>{state.error}</Alert>}
      {state.message && <Alert tone="success">{state.message}</Alert>}
      <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_10rem_7rem]">
        <Field label="Titre du module *" name="title" id={`mt-${module.id}`} required defaultValue={state.values?.title ?? module.title} errors={fe?.title} />
        <div>
          <span className="mb-1 block text-sm font-medium text-brand-dark">Durée estimée</span>
          <p className="rounded-lg border border-line bg-surface px-3 py-2.5 text-sm text-brand-dark" aria-label="Durée estimée (somme des leçons)">{durationLabel}</p>
        </div>
        <div>
          <label htmlFor={`mo-${module.id}`} className="mb-1 block text-sm font-medium text-brand-dark">Ordre</label>
          <select id={`mo-${module.id}`} name="position" defaultValue={module.position} className="w-full rounded-lg border border-line bg-white px-3 py-2.5 text-sm">
            {Array.from({ length: count }, (_, i) => <option key={i} value={i + 1}>{i + 1}</option>)}
          </select>
        </div>
      </div>
      <div>
        <p className="mb-1 text-sm font-medium text-brand-dark">Description du module</p>
        <RichTextEditor name="description" label="Description du module" max={1000} rows={5} defaultValue={state.values?.description ?? module.description ?? ""} error={fe?.description?.[0]} />
      </div>
      <Button type="submit" disabled={pending}>{pending ? "Enregistrement…" : "Enregistrer le module"}</Button>
    </form>
  );
}

const RESOURCE_TYPES = [
  "application/pdf", "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-powerpoint", "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/vnd.ms-excel", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/zip", "application/x-zip-compressed",
];
const RESOURCE_MAX_MB = 100;

/** Zone de dépôt des ressources d'un module : envoi dans le stockage privé puis enregistrement de la ressource. */
export function ResourceUpload({ courseId, moduleId }: { courseId: string; moduleId: string }) {
  const router = useRouter();
  const [status, setStatus] = useState<"idle" | "uploading">("idle");
  const [error, setError] = useState<string | null>(null);
  const [over, setOver] = useState(false);

  async function upload(files: FileList | File[]) {
    setError(null);
    setStatus("uploading");
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("auth");
      for (const file of Array.from(files)) {
        if (!RESOURCE_TYPES.includes(file.type)) { setError(`« ${file.name} » : format non accepté (PDF, Word, PowerPoint, Excel, ZIP).`); continue; }
        if (file.size > RESOURCE_MAX_MB * 1024 * 1024) { setError(`« ${file.name} » dépasse ${RESOURCE_MAX_MB} Mo.`); continue; }
        const safe = file.name.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-zA-Z0-9._-]+/g, "_").slice(-80);
        const path = `${user.id}/${crypto.randomUUID()}-${safe}`;
        const { error: upErr } = await supabase.storage.from("course-files").upload(path, file, { contentType: file.type, upsert: false });
        if (upErr) throw upErr;
        const r = await addModuleResource({ courseId, moduleId, name: file.name, filePath: path, sizeBytes: file.size, mimeType: file.type });
        if (r.error) { await supabase.storage.from("course-files").remove([path]); setError(r.error); }
      }
      router.refresh();
    } catch {
      setError("L’envoi a échoué. Vérifiez le fichier et votre connexion, puis réessayez.");
    } finally {
      setStatus("idle");
    }
  }

  return (
    <div>
      <label
        onDragOver={(e) => { e.preventDefault(); setOver(true); }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => { e.preventDefault(); setOver(false); if (e.dataTransfer.files.length) void upload(e.dataTransfer.files); }}
        className={`flex cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed px-4 py-8 text-center text-sm focus-within:outline focus-within:outline-2 focus-within:outline-brand ${over ? "border-brand bg-brand-soft" : "border-brand/40"}`}
      >
        <UploadCloud className="h-8 w-8 text-brand" aria-hidden />
        <span className="font-semibold text-brand-dark">{status === "uploading" ? "Envoi en cours…" : "Glissez-déposez vos fichiers ici"}</span>
        <span className="text-brand-dark">ou <span className="underline">cliquez pour parcourir</span></span>
        <span className="text-xs text-muted">PDF, DOC, PPT, XLS, ZIP (max {RESOURCE_MAX_MB} Mo)</span>
        <input type="file" multiple accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.zip" className="sr-only" disabled={status === "uploading"}
          onChange={(e) => { if (e.target.files?.length) void upload(e.target.files); e.target.value = ""; }} />
      </label>
      {error && <p role="alert" className="mt-2 text-xs text-danger">{error}</p>}
    </div>
  );
}
