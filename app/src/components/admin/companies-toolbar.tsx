"use client";

import { useRef } from "react";
import Link from "next/link";
import { RotateCcw, Search } from "lucide-react";
import { COMPANY_STATUS, type CompanyFilters, type CompanyOptions, type CompanyStatus } from "@/lib/admin/companies";

const select = "w-full rounded-lg border border-line bg-white px-3 py-2.5 text-sm text-brand-dark";
const label = "mb-1 block text-xs font-semibold text-brand-dark";

/** Filtres de la liste des entreprises : les listes s'appliquent dès le choix, la recherche à la touche Entrée. */
export function CompaniesFilters({ values, options, hidden }: { values: CompanyFilters; options: CompanyOptions; hidden: Record<string, string> }) {
  const form = useRef<HTMLFormElement>(null);
  const apply = () => form.current?.requestSubmit();
  return (
    <form ref={form} role="search" className="grid items-end gap-3 md:grid-cols-[minmax(0,1.6fr)_repeat(3,minmax(0,1fr))_auto]">
      {Object.entries(hidden).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-brand" aria-hidden />
        <input name="q" type="search" defaultValue={values.q} placeholder="Rechercher une entreprise (nom, secteur, contact…)" aria-label="Rechercher une entreprise"
          className="w-full rounded-lg border border-line bg-white py-2.5 pl-9 pr-3 text-sm" />
      </div>
      <div>
        <label htmlFor="f-secteur" className={label}>Secteur d’activité</label>
        <select id="f-secteur" name="secteur" defaultValue={values.industry} onChange={apply} className={select}>
          <option value="">Tous les secteurs</option>
          {options.industries.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>
      <div>
        <label htmlFor="f-statut" className={label}>Statut</label>
        <select id="f-statut" name="statut" defaultValue={values.status} onChange={apply} className={select}>
          <option value="">Tous les statuts</option>
          {(Object.keys(COMPANY_STATUS) as CompanyStatus[]).map((k) => <option key={k} value={k}>{COMPANY_STATUS[k].label}</option>)}
        </select>
      </div>
      <div>
        <label htmlFor="f-ville" className={label}>Ville</label>
        <select id="f-ville" name="ville" defaultValue={values.city} onChange={apply} className={select}>
          <option value="">Toutes les villes</option>
          {options.cities.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>
      <Link href="/admin/entreprises" className="inline-flex items-center justify-center gap-2 rounded-lg bg-brand-soft px-4 py-2.5 text-sm font-semibold text-brand hover:bg-brand-soft/70">
        <RotateCcw className="h-4 w-4" aria-hidden /> Réinitialiser
      </Link>
    </form>
  );
}
