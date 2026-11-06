"use client";

import { useState } from "react";
import Image from "next/image";
import { Camera } from "lucide-react";
import { createClient } from "@/lib/supabase/browser";

type Props = {
  /** Nom du champ caché envoyé avec le formulaire. */
  name: string;
  label: string;
  bucket: "course-covers" | "course-files" | "category-covers" | "session-covers" | "company-logos" | "certification-covers" | "blog-covers";
  accept: string[];
  maxMb: number;
  /** "url" : stocke l'URL publique (images) ; "path" : stocke le chemin privé du fichier. */
  store: "url" | "path";
  defaultValue?: string;
  hint?: string;
  /** "cover" : grand aperçu avec le bouton « Changer l'image » en surimpression. */
  variant?: "default" | "cover";
  /** Appelé avec la nouvelle valeur (adresse ou chemin), ou une chaîne vide quand le fichier est retiré. */
  onValueChange?: (value: string) => void;
};

export function FileUpload({ name, label, bucket, accept, maxMb, store, defaultValue, hint, variant = "default", onValueChange }: Props) {
  const [value, setValueState] = useState(defaultValue ?? "");
  const setValue = (v: string) => { setValueState(v); onValueChange?.(v); };
  const [state, setState] = useState<"idle" | "uploading" | "error">("idle");
  const [message, setMessage] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);

  async function onChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!accept.includes(file.type)) {
      setState("error"); setMessage("Type de fichier non autorisé."); return;
    }
    if (file.size > maxMb * 1024 * 1024) {
      setState("error"); setMessage(`Fichier trop volumineux (${maxMb} Mo maximum).`); return;
    }
    setState("uploading"); setMessage(null);
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("auth");
      const safe = file.name.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-zA-Z0-9._-]+/g, "_").slice(-80);
      const path = `${user.id}/${crypto.randomUUID()}-${safe}`;
      const { error } = await supabase.storage.from(bucket).upload(path, file, { contentType: file.type, upsert: false });
      if (error) throw error;
      setValue(store === "url" ? supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl : path);
      setFileName(file.name);
      setState("idle");
    } catch {
      setState("error"); setMessage("L’envoi a échoué. Vérifiez le fichier et votre connexion, puis réessayez.");
    }
  }

  if (variant === "cover") {
    return (
      <div>
        <input type="hidden" name={name} value={value} />
        <div className="relative aspect-[16/9] overflow-hidden rounded-xl bg-[linear-gradient(135deg,#092a66,#0639d9)]">
          {value && <Image src={value} alt="Aperçu de l’image de couverture" fill sizes="(min-width: 1280px) 40vw, 100vw" unoptimized className="object-cover" />}
          <label className="absolute bottom-3 right-3 flex cursor-pointer items-center gap-2 rounded-lg bg-white px-3 py-2 text-sm font-semibold text-brand shadow hover:bg-brand-soft focus-within:outline focus-within:outline-2 focus-within:outline-brand">
            <Camera className="h-4 w-4" aria-hidden />
            {state === "uploading" ? "Envoi en cours…" : value ? "Changer l’image" : "Choisir l’image"}
            <input type="file" aria-label={label} accept={accept.join(",")} onChange={onChange} className="sr-only" disabled={state === "uploading"} />
          </label>
        </div>
        {hint && !message && <p className="mt-1 text-xs text-muted">{hint}</p>}
        {message && <p role="alert" className="mt-1 text-xs text-danger">{message}</p>}
        {value && state !== "uploading" && (
          <button type="button" onClick={() => { setValue(""); setFileName(null); }} className="mt-1 text-xs text-danger hover:underline">Retirer l’image</button>
        )}
      </div>
    );
  }

  const isImage = store === "url" && value;
  return (
    <div>
      <p className="mb-1 text-sm font-medium text-brand-dark">{label}</p>
      <input type="hidden" name={name} value={value} />
      <div className="flex flex-wrap items-center gap-3">
        {isImage && <Image src={value} alt="Aperçu" width={96} height={64} unoptimized className="h-16 w-24 rounded-lg border border-line object-cover" />}
        <label className="cursor-pointer rounded-lg border border-line bg-white px-3 py-2 text-sm font-medium text-brand-dark hover:bg-brand-soft focus-within:outline focus-within:outline-2 focus-within:outline-brand">
          {value ? "Remplacer le fichier" : "Choisir un fichier"}
          <input type="file" accept={accept.join(",")} onChange={onChange} className="sr-only" disabled={state === "uploading"} />
        </label>
        {state === "uploading" && <span className="text-sm text-muted" role="status">Envoi en cours…</span>}
        {value && state !== "uploading" && (
          <>
            <span className="text-sm text-success" role="status">{fileName ? `Envoyé : ${fileName}` : "Fichier enregistré"}</span>
            <button type="button" onClick={() => { setValue(""); setFileName(null); }} className="text-sm text-danger hover:underline">Retirer</button>
          </>
        )}
      </div>
      {hint && !message && <p className="mt-1 text-xs text-muted">{hint}</p>}
      {message && <p role="alert" className="mt-1 text-xs text-danger">{message}</p>}
    </div>
  );
}

export const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];
export const LESSON_FILE_TYPES = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/vnd.ms-powerpoint",
  "video/mp4",
  "video/webm",
  "image/jpeg",
  "image/png",
];
