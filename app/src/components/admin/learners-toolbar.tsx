"use client";

import { useRef } from "react";
import Link from "next/link";
import { RotateCcw, Search } from "lucide-react";
import { LEARNER_DISPLAY, LEARNER_DISPLAY_FILTERS, type LearnerFilters, type LearnerOptions } from "@/lib/admin/learners";

const select = "w-full rounded-lg border border-line bg-white px-3 py-2.5 text-sm text-brand-dark";

/** Filtres de la liste des apprenants : les listes s'appliquent dès le choix, la recherche à la touche Entrée. */
export function LearnersFilters({ values, options, hidden }: { values: LearnerFilters; options: LearnerOptions; hidden: Record<string, string> }) {
  const form = useRef<HTMLFormElement>(null);
  const apply = () => form.current?.requestSubmit();
  return (
    <form ref={form} role="search" className="grid items-center gap-3 md:grid-cols-2 xl:grid-cols-[minmax(0,1.6fr)_repeat(3,minmax(0,1fr))_auto]">
      {Object.entries(hidden).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-brand" aria-hidden />
        <input name="q" type="search" defaultValue={values.q} placeholder="Rechercher un apprenant (nom, email, téléphone…)" aria-label="Rechercher un apprenant"
          className="w-full rounded-lg border border-line bg-white py-2.5 pl-9 pr-3 text-sm" />
      </div>
      <select name="formation" defaultValue={values.course} onChange={apply} aria-label="Formation" className={select}>
        <option value="">Toutes les formations</option>
        {options.courses.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
      </select>
      <select name="entreprise" defaultValue={values.org} onChange={apply} aria-label="Entreprise" className={select}>
        <option value="">Toutes les entreprises</option>
        {options.organizations.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
      </select>
      <select name="statut" defaultValue={values.status} onChange={apply} aria-label="Statut" className={select}>
        <option value="">Tous les statuts</option>
        {LEARNER_DISPLAY_FILTERS.map((k) => <option key={k} value={k}>{LEARNER_DISPLAY[k].label}</option>)}
      </select>
      <Link href="/admin/apprenants" className="inline-flex items-center justify-center gap-2 px-3 py-2.5 text-sm font-semibold text-brand-dark hover:text-brand">
        <RotateCcw className="h-4 w-4" aria-hidden /> Réinitialiser
      </Link>
    </form>
  );
}
