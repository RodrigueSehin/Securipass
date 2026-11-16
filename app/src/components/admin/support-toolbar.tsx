"use client";

import { useRef } from "react";
import Link from "next/link";
import { RotateCcw, Search } from "lucide-react";
import {
  SUPPORT_CATEGORIES, SUPPORT_PRIORITIES, SUPPORT_STATUS, type SupportCategory, type SupportFilters, type SupportPriority, type SupportStatus,
} from "@/lib/admin/support";

const select = "w-full rounded-lg border border-line bg-white px-3 py-2.5 text-sm text-brand-dark";
const label = "mb-1 block text-xs font-semibold text-brand-dark";

/** Filtres de la liste des tickets : les listes s'appliquent dès le choix, la recherche à la touche Entrée. */
export function SupportFilters({ values, hidden, reset }: { values: SupportFilters; hidden: Record<string, string>; reset: string }) {
  const form = useRef<HTMLFormElement>(null);
  const apply = () => form.current?.requestSubmit();
  return (
    <form ref={form} role="search" className="grid items-end gap-3 md:grid-cols-[minmax(0,1.6fr)_repeat(3,minmax(0,1fr))_auto]">
      {Object.entries(hidden).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-brand" aria-hidden />
        <input name="q" type="search" defaultValue={values.q} placeholder="Rechercher un ticket (référence, sujet, utilisateur…)" aria-label="Rechercher un ticket"
          className="w-full rounded-lg border border-line bg-white py-2.5 pl-9 pr-3 text-sm" />
      </div>
      <div>
        <label htmlFor="f-categorie" className={label}>Catégorie</label>
        <select id="f-categorie" name="categorie" defaultValue={values.category} onChange={apply} className={select}>
          <option value="">Toutes les catégories</option>
          {(Object.keys(SUPPORT_CATEGORIES) as SupportCategory[]).map((k) => <option key={k} value={k}>{SUPPORT_CATEGORIES[k]}</option>)}
        </select>
      </div>
      <div>
        <label htmlFor="f-statut" className={label}>Statut</label>
        <select id="f-statut" name="statut" defaultValue={values.status} onChange={apply} className={select}>
          <option value="">Tous les statuts</option>
          {(Object.keys(SUPPORT_STATUS) as SupportStatus[]).map((k) => <option key={k} value={k}>{SUPPORT_STATUS[k].label}</option>)}
        </select>
      </div>
      <div>
        <label htmlFor="f-priorite" className={label}>Priorité</label>
        <select id="f-priorite" name="priorite" defaultValue={values.priority} onChange={apply} className={select}>
          <option value="">Toutes</option>
          {(Object.keys(SUPPORT_PRIORITIES) as SupportPriority[]).map((k) => <option key={k} value={k}>{SUPPORT_PRIORITIES[k].label}</option>)}
        </select>
      </div>
      <Link href={reset} className="inline-flex items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-sm font-semibold text-brand hover:bg-brand-soft">
        <RotateCcw className="h-4 w-4" aria-hidden /> Réinitialiser
      </Link>
    </form>
  );
}
