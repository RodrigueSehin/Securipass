"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Paperclip, Plus, Upload } from "lucide-react";
import { addSupportFile } from "@/lib/admin/support-actions";
import { FILE_MAX_MB, isAllowedFile } from "@/lib/admin/support";
import { createClient } from "@/lib/supabase/browser";
import { cn } from "@/lib/utils";

/**
 * Dépose un fichier dans le stockage privé (dossier de l'administrateur) puis l'attache au ticket.
 * `variant` : « panel » (bouton pleine largeur sous la liste) ou « inline » (bouton du formulaire de réponse).
 */
export function AttachFileButton({ ticketId, disabled, variant }: { ticketId: string; disabled?: boolean; variant: "panel" | "inline" | "primary" }) {
  const router = useRouter();
  const ref = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function pick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (ref.current) ref.current.value = "";
    if (!file) return;
    setMsg(null);
    if (!isAllowedFile(file.type, file.size)) return setMsg(`PDF, image (JPG, PNG, WebP) ou texte de ${FILE_MAX_MB} Mo maximum.`);
    setBusy(true);
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("auth");
      const path = `${user.id}/${crypto.randomUUID()}-${file.name.replace(/[^\w.-]+/g, "_").slice(-80)}`;
      const up = await supabase.storage.from("support-files").upload(path, file, { contentType: file.type, upsert: false });
      if (up.error) throw up.error;
      const res = await addSupportFile(ticketId, path, file.name.slice(0, 200), file.size, file.type);
      if (res.error) {
        await supabase.storage.from("support-files").remove([path]);
        return setMsg(res.error);
      }
      router.refresh();
    } catch {
      setMsg("Impossible d’envoyer le fichier. Réessayez.");
    } finally {
      setBusy(false);
    }
  }

  const base = variant === "panel"
    ? "flex w-full items-center justify-center gap-2 rounded-lg border border-brand bg-white px-4 py-2.5 text-sm font-semibold text-brand hover:bg-brand-soft"
    : variant === "primary"
    ? "inline-flex items-center gap-2 rounded-lg bg-brand px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-dark"
    : "inline-flex items-center gap-2 rounded-lg border border-line bg-white px-4 py-2.5 text-sm font-semibold text-brand hover:bg-brand-soft";
  return (
    <div className={variant === "panel" ? "w-full" : undefined}>
      <button type="button" disabled={disabled || busy} onClick={() => ref.current?.click()} className={cn(base, (disabled || busy) && "cursor-not-allowed opacity-50")}>
        {variant === "panel" ? <Plus className="h-4 w-4" aria-hidden /> : variant === "primary" ? <Upload className="h-4 w-4" aria-hidden /> : <Paperclip className="h-4 w-4" aria-hidden />}
        {busy ? "Envoi en cours…" : variant !== "inline" ? "Ajouter une pièce jointe" : "Joindre un fichier"}
      </button>
      <input ref={ref} type="file" accept="application/pdf,image/jpeg,image/png,image/webp,text/plain" onChange={pick} className="sr-only" tabIndex={-1} aria-hidden />
      {msg && <p role="alert" className="mt-1 text-xs text-danger">{msg}</p>}
    </div>
  );
}
