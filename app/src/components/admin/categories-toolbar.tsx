"use client";

import { useRef } from "react";
import Link from "next/link";
import { RotateCcw, Search } from "lucide-react";
import { CATEGORY_SORTS, CATEGORY_STATUS, type CategoryFilters, type CategoryStatus } from "@/lib/admin/categories";

const select = "w-full rounded-lg border border-line bg-white px-3 py-2.5 text-sm text-brand-dark";
const label = "mb-1 block text-xs font-semibold text-brand-dark";

/** Filtres de la liste des catégories : les listes s'appliquent dès le choix, la recherche à la touche Entrée. */
export function CategoriesFilters({ values, hidden }: { values: CategoryFilters; hidden: Record<string, string> }) {
  const form = useRef<HTMLFormElement>(null);
  const apply = () => form.current?.requestSubmit();
  return (
    <form ref={form} role="search" className="grid items-end gap-3 md:grid-cols-[minmax(0,1.8fr)_minmax(0,1fr)_minmax(0,1.2fr)_auto]">
      {Object.entries(hidden).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-brand" aria-hidden />
        <input name="q" type="search" defaultValue={values.q} placeholder="Rechercher une catégorie (nom, description…)" aria-label="Rechercher une catégorie"
          className="w-full rounded-lg border border-line bg-white py-2.5 pl-9 pr-3 text-sm" />
      </div>
      <div>
        <label htmlFor="f-statut" className={label}>Statut</label>
        <select id="f-statut" name="statut" defaultValue={values.status} onChange={apply} className={select}>
          <option value="">Tous les statuts</option>
          {(Object.keys(CATEGORY_STATUS) as CategoryStatus[]).map((k) => <option key={k} value={k}>{CATEGORY_STATUS[k].label}</option>)}
        </select>
      </div>
      <div>
        <label htmlFor="f-tri" className={label}>Trier par</label>
        <select id="f-tri" name="tri" defaultValue={values.sort} onChange={apply} className={select}>
          {CATEGORY_SORTS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
        </select>
      </div>
      <Link href="/admin/categories" className="inline-flex items-center justify-center gap-2 rounded-lg bg-brand-soft px-4 py-2.5 text-sm font-semibold text-brand hover:bg-brand-soft/70">
        <RotateCcw className="h-4 w-4" aria-hidden /> Réinitialiser
      </Link>
    </form>
  );
}
