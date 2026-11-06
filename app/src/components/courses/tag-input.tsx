"use client";

import { useState } from "react";
import { ChevronDown, Search, X, type LucideIcon } from "lucide-react";

/**
 * Saisie par étiquettes. `lines` envoie une seule valeur (un élément par ligne, pour les champs texte existants) ;
 * `multi` envoie une valeur par étiquette (pour les listes, ex. mots-clés). Un champ vide est toujours envoyé,
 * pour qu'on puisse effacer toute la liste.
 *
 * `variant="search"` : champ de recherche avec suggestions, les étiquettes s'affichent en dessous.
 */
export function TagInput({ name, label, initial, mode, placeholder, hint, max = 20, errors, suggestions, icon: Icon, variant = "box" }: {
  name: string; label: string; initial: string[]; mode: "lines" | "multi";
  placeholder?: string; hint?: string; max?: number; errors?: string[];
  /** Propositions affichées pendant la saisie ; une saisie libre reste possible. */
  suggestions?: string[];
  /** Icône affichée à gauche du champ. */
  icon?: LucideIcon;
  variant?: "box" | "search";
}) {
  const [tags, setTags] = useState(initial);
  const [draft, setDraft] = useState("");
  const id = `tags-${name}`;
  const err = errors?.[0];

  function add(value = draft) {
    const t = value.trim();
    if (!t || tags.includes(t) || tags.length >= max) return;
    setTags([...tags, t]);
    setDraft("");
  }

  const chips = tags.map((t) => (
    <span key={t} className="inline-flex items-center gap-1 rounded-md bg-brand-soft px-2 py-1 text-xs font-semibold text-brand">
      {t}
      <button type="button" aria-label={`Retirer ${t}`} onClick={() => setTags(tags.filter((x) => x !== t))} className="rounded p-0.5 hover:bg-brand/10">
        <X className="h-3 w-3" aria-hidden />
      </button>
    </span>
  ));

  const input = (
    <input
      id={id}
      value={draft}
      onChange={(e) => {
        setDraft(e.target.value);
        // Un choix dans la liste de suggestions s'ajoute directement.
        if (suggestions?.includes(e.target.value)) add(e.target.value);
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === ",") { e.preventDefault(); add(); }
      }}
      placeholder={variant === "search" || tags.length === 0 ? placeholder : undefined}
      maxLength={200}
      list={suggestions ? `${id}-list` : undefined}
      className="min-w-40 flex-1 bg-transparent px-1 py-1 text-sm outline-none"
    />
  );

  const datalist = suggestions && (
    <datalist id={`${id}-list`}>
      {suggestions.filter((s) => !tags.includes(s)).map((s) => <option key={s} value={s} />)}
    </datalist>
  );

  return (
    <div>
      <label htmlFor={id} className={variant === "search" ? "sr-only" : "mb-1 block text-sm font-medium text-brand-dark"}>{label}</label>
      {variant === "search" ? (
        <>
          <div className={`flex items-center gap-2 rounded-lg border bg-white px-3 py-1.5 ${err ? "border-danger" : "border-line"}`}>
            <Search className="h-4 w-4 shrink-0 text-muted" aria-hidden />
            {input}
            <ChevronDown className="h-4 w-4 shrink-0 text-muted" aria-hidden />
            {datalist}
          </div>
          {tags.length > 0 && <div className="mt-3 flex flex-wrap gap-2">{chips}</div>}
        </>
      ) : (
        <div className={`flex flex-wrap items-center gap-2 rounded-lg border bg-white p-2 ${err ? "border-danger" : "border-line"}`}>
          {Icon && <Icon className="ml-1 h-4 w-4 shrink-0 text-brand" aria-hidden />}
          {chips}
          {input}
          <button type="button" onClick={() => add()} className="rounded-md border border-brand px-2.5 py-1 text-xs font-semibold text-brand hover:bg-brand-soft">
            + Ajouter
          </button>
          {datalist}
        </div>
      )}
      {mode === "lines"
        ? <input type="hidden" name={name} value={tags.join("\n")} />
        : <>
            <input type="hidden" name={name} value="" />
            {tags.map((t) => <input key={t} type="hidden" name={name} value={t} />)}
          </>}
      {hint && !err && <p className="mt-1 text-xs text-muted">{hint}</p>}
      {err && <p role="alert" className="mt-1 text-xs text-danger">{err}</p>}
    </div>
  );
}
