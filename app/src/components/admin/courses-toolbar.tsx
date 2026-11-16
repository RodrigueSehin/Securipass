"use client";

import { useRef } from "react";
import Link from "next/link";
import { RotateCcw, Search } from "lucide-react";
import { COURSE_STATUS, MODES, type CourseStatus, type Mode } from "@/lib/courses/labels";
import type { CourseFilters } from "@/lib/admin/courses";

const select = "w-full rounded-lg border border-line bg-white px-3 py-2.5 text-sm text-brand-dark";
const label = "mb-1 block text-xs font-semibold text-brand-dark";

/** Filtres de la liste des formations : les listes s'appliquent dès le choix, la recherche à la touche Entrée. */
export function CoursesFilters({ values, categories, hidden }: {
  values: CourseFilters; categories: { id: string; name: string }[]; hidden: Record<string, string>;
}) {
  const form = useRef<HTMLFormElement>(null);
  const apply = () => form.current?.requestSubmit();
  return (
    <form ref={form} role="search" className="grid items-end gap-3 md:grid-cols-[minmax(0,1.6fr)_repeat(3,minmax(0,1fr))_auto]">
      {Object.entries(hidden).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-brand" aria-hidden />
        <input name="q" type="search" defaultValue={values.q} placeholder="Rechercher une formation (titre, description, formateur…)" aria-label="Rechercher une formation"
          className="w-full rounded-lg border border-line bg-white py-2.5 pl-9 pr-3 text-sm" />
      </div>
      <div>
        <label htmlFor="f-categorie" className={label}>Catégorie</label>
        <select id="f-categorie" name="categorie" defaultValue={values.category} onChange={apply} className={select}>
          <option value="">Toutes les catégories</option>
          {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>
      <div>
        <label htmlFor="f-statut" className={label}>Statut</label>
        <select id="f-statut" name="statut" defaultValue={values.status} onChange={apply} className={select}>
          <option value="">Tous les statuts</option>
          {(Object.keys(COURSE_STATUS) as CourseStatus[]).map((k) => <option key={k} value={k}>{COURSE_STATUS[k].label}</option>)}
        </select>
      </div>
      <div>
        <label htmlFor="f-mode" className={label}>Mode</label>
        <select id="f-mode" name="mode" defaultValue={values.mode} onChange={apply} className={select}>
          <option value="">Tous les modes</option>
          {(Object.keys(MODES) as Mode[]).map((k) => <option key={k} value={k}>{MODES[k]}</option>)}
        </select>
      </div>
      <Link href="/admin/formations" className="inline-flex items-center justify-center gap-2 rounded-lg bg-brand-soft px-4 py-2.5 text-sm font-semibold text-brand hover:bg-brand-soft/70">
        <RotateCcw className="h-4 w-4" aria-hidden /> Réinitialiser
      </Link>
    </form>
  );
}
