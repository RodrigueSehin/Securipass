"use client";

import { useRef } from "react";
import Link from "next/link";
import { CalendarDays, RotateCcw, Search } from "lucide-react";
import { COMMISSION_STATUS, monthLabel, type CommissionFilters, type CommissionOptions, type CommissionStatus } from "@/lib/admin/commissions";

const select = "w-full rounded-lg border border-line bg-white px-3 py-2.5 text-sm text-brand-dark";
const label = "mb-1 block text-xs font-semibold text-brand-dark";

/** Filtres de la liste des commissions : les listes s'appliquent dès le choix, la recherche à la touche Entrée. */
export function CommissionsFilters({ values, options, hidden }: { values: CommissionFilters; options: CommissionOptions; hidden: Record<string, string> }) {
  const form = useRef<HTMLFormElement>(null);
  const apply = () => form.current?.requestSubmit();
  return (
    <form ref={form} role="search" className="grid items-end gap-3 md:grid-cols-[minmax(0,1.5fr)_repeat(3,minmax(0,1fr))_auto]">
      {Object.entries(hidden).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-brand" aria-hidden />
        <input name="q" type="search" defaultValue={values.q} placeholder="Rechercher un formateur, une formation, une session…" aria-label="Rechercher une commission"
          className="w-full rounded-lg border border-line bg-white py-2.5 pl-9 pr-3 text-sm" />
      </div>
      <div>
        <label htmlFor="f-mois" className={label}>Période</label>
        <div className="relative">
          <CalendarDays className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-brand" aria-hidden />
          <select id="f-mois" name="mois" defaultValue={values.month} onChange={apply} className={`${select} pl-9`}>
            <option value="">Toutes les périodes</option>
            {options.months.map((m) => <option key={m} value={m}>{monthLabel(m)}</option>)}
          </select>
        </div>
      </div>
      <div>
        <label htmlFor="f-statut" className={label}>Statut</label>
        <select id="f-statut" name="statut" defaultValue={values.status} onChange={apply} className={select}>
          <option value="">Tous les statuts</option>
          {(Object.keys(COMMISSION_STATUS) as CommissionStatus[]).map((k) => <option key={k} value={k}>{COMMISSION_STATUS[k].label}</option>)}
        </select>
      </div>
      <div>
        <label htmlFor="f-formateur" className={label}>Formateur</label>
        <select id="f-formateur" name="formateur" defaultValue={values.instructor} onChange={apply} className={select}>
          <option value="">Tous les formateurs</option>
          {options.instructors.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}
        </select>
      </div>
      <Link href="/admin/commissions" className="inline-flex items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-sm font-semibold text-brand hover:bg-brand-soft">
        <RotateCcw className="h-4 w-4" aria-hidden /> Réinitialiser
      </Link>
    </form>
  );
}
