"use client";

import { useRef } from "react";
import Link from "next/link";
import { RotateCcw, Search } from "lucide-react";
import { CONTRACTS, TRAINER_STATUS, type ContractType, type TrainerFilters, type TrainerStatus } from "@/lib/admin/trainers";

const select = "w-full rounded-lg border border-line bg-white px-3 py-2.5 text-sm text-brand-dark";
const label = "mb-1 block text-xs font-semibold text-brand-dark";

/** Filtres de la liste des formateurs : les listes s'appliquent dès le choix, la recherche à la touche Entrée. */
export function TrainersFilters({ values, specialties, hidden }: { values: TrainerFilters; specialties: { id: string; name: string }[]; hidden: Record<string, string> }) {
  const form = useRef<HTMLFormElement>(null);
  const apply = () => form.current?.requestSubmit();
  return (
    <form ref={form} role="search" className="grid items-end gap-3 md:grid-cols-[minmax(0,1.6fr)_repeat(3,minmax(0,1fr))_auto]">
      {Object.entries(hidden).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-brand" aria-hidden />
        <input name="q" type="search" defaultValue={values.q} placeholder="Rechercher un formateur (nom, email, spécialité…)" aria-label="Rechercher un formateur"
          className="w-full rounded-lg border border-line bg-white py-2.5 pl-9 pr-3 text-sm" />
      </div>
      <div>
        <label htmlFor="f-specialite" className={label}>Spécialité</label>
        <select id="f-specialite" name="specialite" defaultValue={values.category} onChange={apply} className={select}>
          <option value="">Toutes les spécialités</option>
          {specialties.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
      </div>
      <div>
        <label htmlFor="f-statut" className={label}>Statut</label>
        <select id="f-statut" name="statut" defaultValue={values.status} onChange={apply} className={select}>
          <option value="">Tous les statuts</option>
          {(Object.keys(TRAINER_STATUS) as TrainerStatus[]).map((k) => <option key={k} value={k}>{TRAINER_STATUS[k].label}</option>)}
        </select>
      </div>
      <div>
        <label htmlFor="f-contrat" className={label}>Type de contrat</label>
        <select id="f-contrat" name="contrat" defaultValue={values.contract} onChange={apply} className={select}>
          <option value="">Tous les types</option>
          {(Object.keys(CONTRACTS) as ContractType[]).map((k) => <option key={k} value={k}>{CONTRACTS[k].label}</option>)}
        </select>
      </div>
      <Link href="/admin/formateurs" className="inline-flex items-center justify-center gap-2 rounded-lg bg-brand-soft px-4 py-2.5 text-sm font-semibold text-brand hover:bg-brand-soft/70">
        <RotateCcw className="h-4 w-4" aria-hidden /> Réinitialiser
      </Link>
    </form>
  );
}
