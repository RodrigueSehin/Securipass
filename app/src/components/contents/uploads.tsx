"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Download, FileText, Link as LinkIcon, Plus, Trash, UploadCloud } from "lucide-react";
import { addContentFile, addContentLink, deleteContentAttachment } from "@/lib/contents/actions";
import { MAIN_FILE_TYPES, MAX_FILE_MB, displayFileName } from "@/lib/contents/wizard";
import type { Attachment } from "@/lib/contents/queries";
import { formatBytes } from "@/lib/format";
import { createClient } from "@/lib/supabase/browser";
import { cn } from "@/lib/utils";

const ATTACHMENT_TYPES = [
  "application/pdf", "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-powerpoint", "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/vnd.ms-excel", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/zip", "application/x-zip-compressed", "image/jpeg", "image/png",
];

const safeName = (name: string) => name.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-zA-Z0-9._-]+/g, "_").slice(-80);

async function uploadToStorage(file: File): Promise<string> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("auth");
  const path = `${user.id}/${crypto.randomUUID()}-${safeName(file.name)}`;
  const { error } = await supabase.storage.from("course-files").upload(path, file, { contentType: file.type, upsert: false });
  if (error) throw error;
  return path;
}

const ext = (name: string) => (name.split(".").pop() ?? "").toUpperCase();

/**
 * Fichier principal d'un contenu : dépôt par glisser-déposer ou parcours, puis les champs cachés (chemin, nom, taille, type)
 * partent avec le formulaire de l'étape.
 */
export function MainFileUpload({ contentType, initial, onChange, compact = false }: {
  contentType: string; initial: { path: string; name: string; size: string; mime: string };
  onChange?: (file: { path: string; name: string } | null) => void; compact?: boolean;
}) {
  const [file, setFile] = useState(initial);
  const [status, setStatus] = useState<"idle" | "uploading">("idle");
  const [error, setError] = useState<string | null>(null);
  const [over, setOver] = useState(false);
  const accepted = MAIN_FILE_TYPES[contentType] ?? [];
  const has = Boolean(file.path);

  async function pick(files: FileList | File[]) {
    const f = files[0];
    if (!f) return;
    setError(null);
    if (accepted.length > 0 && !accepted.includes(f.type)) { setError("Format non accepté pour ce type de contenu."); return; }
    if (f.size > MAX_FILE_MB * 1024 * 1024) { setError(`Fichier trop volumineux (${MAX_FILE_MB} Mo maximum).`); return; }
    setStatus("uploading");
    try {
      const path = await uploadToStorage(f);
      const next = { path, name: f.name, size: String(f.size), mime: f.type };
      setFile(next);
      onChange?.({ path, name: f.name });
    } catch {
      setError("L’envoi a échoué. Vérifiez le fichier et votre connexion, puis réessayez.");
    } finally {
      setStatus("idle");
    }
  }

  return (
    <div>
      <input type="hidden" name="filePath" value={file.path} />
      <input type="hidden" name="fileName" value={file.name} />
      <input type="hidden" name="fileSize" value={file.size} />
      <input type="hidden" name="fileMime" value={file.mime} />
      <div className={cn("grid gap-3", !compact && "md:grid-cols-2")}>
        <label
          onDragOver={(e) => { e.preventDefault(); setOver(true); }}
          onDragLeave={() => setOver(false)}
          onDrop={(e) => { e.preventDefault(); setOver(false); void pick(e.dataTransfer.files); }}
          className={cn("flex cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed px-4 py-7 text-center text-sm focus-within:outline focus-within:outline-2 focus-within:outline-brand",
            over ? "border-brand bg-brand-soft" : "border-brand/40")}
        >
          <UploadCloud className="h-8 w-8 text-brand" aria-hidden />
          <span className="font-semibold text-brand-dark">{status === "uploading" ? "Envoi en cours…" : "Glissez-déposez votre fichier ici"}</span>
          <span className="text-brand-dark">ou <span className="underline">cliquez pour parcourir</span></span>
          <span className="text-xs text-muted">{contentType === "video" ? "MP4, WebM" : "PDF, DOC, PPT, XLS"} (max {MAX_FILE_MB} Mo)</span>
          <input type="file" className="sr-only" disabled={status === "uploading"} accept={accepted.length ? accepted.join(",") : undefined}
            onChange={(e) => { if (e.target.files?.length) void pick(e.target.files); e.target.value = ""; }} />
        </label>
        {has && (
          <div className="flex items-center gap-3 self-start rounded-xl border border-line p-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-danger/10 text-danger"><FileText className="h-5 w-5" aria-hidden /></span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-semibold text-brand-dark">{displayFileName(file.path, file.name)}</span>
              <span className="block text-xs text-muted">{ext(displayFileName(file.path, file.name))}{file.size ? ` · ${formatBytes(Number(file.size))}` : ""}</span>
              <span className="mt-1 block h-1.5 overflow-hidden rounded-full bg-surface" aria-hidden><span className="block h-full w-full rounded-full bg-success" /></span>
            </span>
            <CheckCircle2 className="h-5 w-5 shrink-0 text-success" aria-label="Fichier envoyé" />
            <button type="button" aria-label="Retirer le fichier" onClick={() => { setFile({ path: "", name: "", size: "", mime: "" }); onChange?.(null); }}
              className="rounded p-1.5 text-danger hover:bg-danger/10"><Trash className="h-4 w-4" aria-hidden /></button>
          </div>
        )}
      </div>
      {error && <p role="alert" className="mt-2 text-xs text-danger">{error}</p>}
    </div>
  );
}

/** Fichiers et liens complémentaires : ajout et suppression sans formulaire imbriqué (appels directs aux actions serveur). */
export function Attachments({ contentId, items, allowFiles = true, allowLinks = false, allowDownloadLink = true }: {
  contentId: string; items: Attachment[]; allowFiles?: boolean; allowLinks?: boolean; allowDownloadLink?: boolean;
}) {
  const router = useRouter();
  const [, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [url, setUrl] = useState("");
  const [label, setLabel] = useState("");
  const fileInput = useRef<HTMLInputElement>(null);
  const files = items.filter((i) => i.kind === "file");
  const links = items.filter((i) => i.kind === "link");

  async function upload(list: FileList) {
    setError(null);
    setBusy(true);
    try {
      for (const f of Array.from(list)) {
        if (!ATTACHMENT_TYPES.includes(f.type)) { setError(`« ${f.name} » : format non accepté.`); continue; }
        if (f.size > MAX_FILE_MB * 1024 * 1024) { setError(`« ${f.name} » dépasse ${MAX_FILE_MB} Mo.`); continue; }
        const path = await uploadToStorage(f);
        const r = await addContentFile({ contentId, name: f.name, filePath: path, sizeBytes: f.size, mimeType: f.type });
        if (r.error) { setError(r.error); await createClient().storage.from("course-files").remove([path]); }
      }
      router.refresh();
    } catch {
      setError("L’envoi a échoué. Vérifiez le fichier et votre connexion, puis réessayez.");
    } finally {
      setBusy(false);
    }
  }

  function addLink() {
    setError(null);
    start(async () => {
      const fd = new FormData();
      fd.set("contentId", contentId);
      fd.set("url", url);
      fd.set("name", label);
      const r = await addContentLink({}, fd);
      if (r.error || r.fieldErrors) setError(r.error ?? r.fieldErrors?.url?.[0] ?? "Lien invalide.");
      else { setUrl(""); setLabel(""); router.refresh(); }
    });
  }

  function remove(id: string) {
    start(async () => {
      const fd = new FormData();
      fd.set("attachmentId", id);
      await deleteContentAttachment(fd);
      router.refresh();
    });
  }

  const row = (a: Attachment) => (
    <li key={a.id} className="flex items-center gap-3 rounded-lg border border-line p-3">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-soft text-brand">
        {a.kind === "link" ? <LinkIcon className="h-4 w-4" aria-hidden /> : <FileText className="h-4 w-4" aria-hidden />}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-semibold text-brand-dark">{a.name}</span>
        <span className="block truncate text-xs text-muted">{a.kind === "link" ? a.url : `${ext(a.name)} · ${formatBytes(a.size_bytes)}`}</span>
      </span>
      {a.kind === "file" && allowDownloadLink && <a href={`/formateur/contenus/pieces/${a.id}`} aria-label={`Télécharger ${a.name}`} className="rounded p-1.5 text-brand hover:bg-brand-soft"><Download className="h-4 w-4" aria-hidden /></a>}
      <button type="button" aria-label={`Supprimer ${a.name}`} onClick={() => remove(a.id)} className="rounded p-1.5 text-danger hover:bg-danger/10"><Trash className="h-4 w-4" aria-hidden /></button>
    </li>
  );

  return (
    <div className="space-y-4">
      {allowFiles && (
        <div>
          <div className="mb-2 flex items-center justify-between gap-3">
            <p className="text-sm font-semibold text-brand-dark">Fichiers complémentaires <span className="font-normal text-muted">(facultatif)</span></p>
            <button type="button" disabled={busy} onClick={() => fileInput.current?.click()}
              className="inline-flex items-center gap-1.5 rounded-lg border border-brand px-3 py-1.5 text-sm font-semibold text-brand hover:bg-brand-soft disabled:opacity-50">
              <Plus className="h-4 w-4" aria-hidden /> {busy ? "Envoi…" : "Ajouter un fichier"}
            </button>
            <input ref={fileInput} type="file" multiple className="sr-only" accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.zip,.jpg,.jpeg,.png"
              onChange={(e) => { if (e.target.files?.length) void upload(e.target.files); e.target.value = ""; }} />
          </div>
          {files.length === 0 ? <p className="text-sm text-muted">Aucun fichier complémentaire.</p> : <ul className="space-y-2">{files.map(row)}</ul>}
        </div>
      )}
      {allowLinks && (
        <div>
          <p className="mb-2 text-sm font-semibold text-brand-dark">Liens complémentaires <span className="font-normal text-muted">(facultatif)</span></p>
          <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,10rem)_auto]">
            <input value={url} onChange={(e) => setUrl(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addLink(); } }}
              aria-label="Adresse du lien" placeholder="https://exemple.com" inputMode="url"
              className="rounded-lg border border-line bg-white px-3 py-2.5 text-sm" />
            <input value={label} onChange={(e) => setLabel(e.target.value)} aria-label="Intitulé du lien (facultatif)" placeholder="Intitulé (facultatif)" maxLength={200}
              className="rounded-lg border border-line bg-white px-3 py-2.5 text-sm" />
            <button type="button" onClick={addLink} className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-brand px-3 py-2 text-sm font-semibold text-brand hover:bg-brand-soft">
              <Plus className="h-4 w-4" aria-hidden /> Ajouter un lien
            </button>
          </div>
          <p className="mt-1 text-xs text-muted">Ajoutez des liens vers des ressources utiles (articles, vidéos, sites web…).</p>
          {links.length > 0 && <ul className="mt-3 space-y-2">{links.map(row)}</ul>}
        </div>
      )}
      {error && <p role="alert" className="text-xs text-danger">{error}</p>}
    </div>
  );
}
