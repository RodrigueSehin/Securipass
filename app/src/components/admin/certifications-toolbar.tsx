"use client";

import { useRef } from "react";
import Link from "next/link";
import { RotateCcw, Search } from "lucide-react";
import { CERTIFICATION_STATUSES, CERTIFICATION_STATUS_UI, type CertificationFilters, type CertificationOptions } from "@/lib/admin/certifications";

const field = "w-full rounded-lg border border-line bg-white px-3 py-2.5 text-sm text-brand-dark";

/** Filtres du catalogue : les listes s'appliquent dès le choix, la recherche à la touche Entrée. */
export function CertificationsToolbar({ values, options, hidden }: { values: CertificationFilters; options: CertificationOptions; hidden: Record<string, string> }) {
  const form = useRef<HTMLFormElement>(null);
  const apply = () => form.current?.requestSubmit();
  return (
    <form ref={form} role="search" className="grid items-center gap-3 md:grid-cols-2 xl:grid-cols-[minmax(0,1.6fr)_repeat(2,minmax(0,1fr))_auto]">
      {Object.entries(hidden).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-brand" aria-hidden />
        <input name="q" type="search" defaultValue={values.q} placeholder="Rechercher une certification (nom, code, formation…)" aria-label="Rechercher une certification"
          className="w-full rounded-lg border border-line bg-white py-2.5 pl-9 pr-3 text-sm" />
      </div>
      <select name="categorie" defaultValue={values.category} onChange={apply} aria-label="Catégorie" className={field}>
        <option value="">Toutes les catégories</option>
        {options.categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
      </select>
      <select name="statut" defaultValue={values.status} onChange={apply} aria-label="Statut" className={field}>
        <option value="">Tous les statuts</option>
        {CERTIFICATION_STATUSES.map((k) => <option key={k} value={k}>{CERTIFICATION_STATUS_UI[k].label}</option>)}
      </select>
      <Link href="/admin/certifications" className="inline-flex items-center justify-center gap-2 px-3 py-2.5 text-sm font-semibold text-brand-dark hover:text-brand">
        <RotateCcw className="h-4 w-4" aria-hidden /> Réinitialiser
      </Link>
    </form>
  );
}
