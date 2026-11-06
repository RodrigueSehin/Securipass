"use client";

import { useRef, useState } from "react";
import { Bold, Italic, Link as LinkIcon, List, ListOrdered, Underline } from "lucide-react";
import { setHeading, toggleList, wrapSelection, type Edit } from "@/lib/rich-text";
import { cn } from "@/lib/utils";

/**
 * Éditeur de texte enrichi : un champ texte avec barre d'outils (titre, gras, italique, souligné, listes, lien).
 * Le contenu reste du texte simple (voir lib/rich-text) : aucun HTML n'est produit.
 */
export function RichTextEditor({ name, label, defaultValue = "", max, rows = 9, error, required }: {
  name: string; label: string; defaultValue?: string; max: number; rows?: number; error?: string; required?: boolean;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const [value, setValue] = useState(defaultValue);
  const id = `rte-${name}`;

  function apply(fn: (v: string, s: number, e: number) => Edit) {
    const el = ref.current;
    if (!el) return;
    const edit = fn(el.value, el.selectionStart, el.selectionEnd);
    if (edit.value.length > max) return;
    setValue(edit.value);
    requestAnimationFrame(() => { el.focus(); el.setSelectionRange(edit.start, edit.end); });
  }

  function addLink() {
    const url = window.prompt("Adresse du lien (https://…)");
    if (!url || !/^https:\/\/\S+$/.test(url.trim())) return;
    apply((v, s, e) => wrapSelection(v, s, e, "[", `](${url.trim()})`, "texte du lien"));
  }

  const tool = "rounded p-1.5 text-brand-dark hover:bg-brand-soft";
  return (
    <div>
      <label htmlFor={id} className="sr-only">{label}</label>
      <div className={cn("overflow-hidden rounded-lg border bg-white", error ? "border-danger" : "border-line")}>
        <div className="flex flex-wrap items-center gap-1 border-b border-line bg-surface/60 px-2 py-1.5" role="toolbar" aria-label="Mise en forme">
          <select
            aria-label="Style de paragraphe"
            defaultValue=""
            onChange={(e) => { const v = e.target.value as "" | "##" | "###"; apply((t, s) => setHeading(t, s, v)); e.target.value = ""; }}
            className="rounded border border-line bg-white px-2 py-1 text-xs"
          >
            <option value="">Paragraphe</option>
            <option value="##">Titre</option>
            <option value="###">Sous-titre</option>
          </select>
          <button type="button" aria-label="Gras" title="Gras" onClick={() => apply((v, s, e) => wrapSelection(v, s, e, "**"))} className={tool}><Bold className="h-4 w-4" aria-hidden /></button>
          <button type="button" aria-label="Italique" title="Italique" onClick={() => apply((v, s, e) => wrapSelection(v, s, e, "*"))} className={tool}><Italic className="h-4 w-4" aria-hidden /></button>
          <button type="button" aria-label="Souligné" title="Souligné" onClick={() => apply((v, s, e) => wrapSelection(v, s, e, "++"))} className={tool}><Underline className="h-4 w-4" aria-hidden /></button>
          <span className="mx-1 h-5 w-px bg-line" aria-hidden />
          <button type="button" aria-label="Liste à puces" title="Liste à puces" onClick={() => apply((v, s, e) => toggleList(v, s, e, "ul"))} className={tool}><List className="h-4 w-4" aria-hidden /></button>
          <button type="button" aria-label="Liste numérotée" title="Liste numérotée" onClick={() => apply((v, s, e) => toggleList(v, s, e, "ol"))} className={tool}><ListOrdered className="h-4 w-4" aria-hidden /></button>
          <button type="button" aria-label="Insérer un lien" title="Insérer un lien" onClick={addLink} className={tool}><LinkIcon className="h-4 w-4" aria-hidden /></button>
        </div>
        <textarea
          ref={ref}
          id={id}
          name={name}
          rows={rows}
          required={required}
          maxLength={max}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          aria-invalid={!!error}
          className="block w-full resize-y bg-white px-3 py-3 text-sm outline-none"
        />
      </div>
      <p className="mt-1 text-right text-xs text-muted">{value.length}/{max}</p>
      {error && <p role="alert" className="text-xs text-danger">{error}</p>}
    </div>
  );
}
