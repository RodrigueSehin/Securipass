"use client";

import { useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { RotateCcw, Search } from "lucide-react";
import { PERIODS, ROLE_CODES, ROLE_LABEL, USER_STATUS, type UserFilters, type UserStatus } from "@/lib/admin/users";

const select = "w-full rounded-lg border border-line bg-white px-3 py-2.5 text-sm text-brand-dark";
const label = "mb-1 block text-xs font-semibold text-brand-dark";

/** Filtres de la liste des utilisateurs : les listes s'appliquent dès le choix, la recherche à la touche Entrée. */
export function UsersFilters({ values, hidden }: { values: UserFilters; hidden: Record<string, string> }) {
  const form = useRef<HTMLFormElement>(null);
  const apply = () => form.current?.requestSubmit();
  return (
    <form ref={form} role="search" className="grid items-end gap-3 md:grid-cols-[minmax(0,1.6fr)_repeat(3,minmax(0,1fr))_auto]">
      {Object.entries(hidden).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-brand" aria-hidden />
        <input name="q" type="search" defaultValue={values.q} placeholder="Rechercher par nom, email, téléphone…" aria-label="Rechercher un utilisateur"
          className="w-full rounded-lg border border-line bg-white py-2.5 pl-9 pr-3 text-sm" />
      </div>
      <div>
        <label htmlFor="f-role" className={label}>Rôle</label>
        <select id="f-role" name="role" defaultValue={values.role} onChange={apply} className={select}>
          <option value="">Tous les rôles</option>
          {ROLE_CODES.map((c) => <option key={c} value={c}>{ROLE_LABEL[c]}</option>)}
        </select>
      </div>
      <div>
        <label htmlFor="f-statut" className={label}>Statut</label>
        <select id="f-statut" name="statut" defaultValue={values.status} onChange={apply} className={select}>
          <option value="">Tous les statuts</option>
          {(Object.keys(USER_STATUS) as UserStatus[]).map((k) => <option key={k} value={k}>{USER_STATUS[k].label}</option>)}
        </select>
      </div>
      <div>
        <label htmlFor="f-periode" className={label}>Date d’inscription</label>
        <select id="f-periode" name="periode" defaultValue={values.period} onChange={apply} className={select}>
          <option value="">Toutes les périodes</option>
          {PERIODS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
        </select>
      </div>
      <Link href="/admin/utilisateurs" className="inline-flex items-center justify-center gap-2 rounded-lg bg-brand-soft px-4 py-2.5 text-sm font-semibold text-brand hover:bg-brand-soft/70">
        <RotateCcw className="h-4 w-4" aria-hidden /> Réinitialiser
      </Link>
    </form>
  );
}

/** Nombre d'éléments par page : change l'adresse dès le choix. */
export function UsersPageSize({ value, options, hrefs }: { value: number; options: number[]; hrefs: Record<number, string> }) {
  const router = useRouter();
  return (
    <label className="flex items-center gap-2 text-sm text-brand-dark">
      Afficher
      <select defaultValue={value} aria-label="Éléments par page" className="rounded-lg border border-line bg-white px-2 py-1.5 text-sm" onChange={(e) => router.push(hrefs[Number(e.target.value)])}>
        {options.map((n) => <option key={n} value={n}>{n}</option>)}
      </select>
      par page
    </label>
  );
}

/** Case d'en-tête : coche ou décoche toutes les lignes de la page (export des lignes cochées). */
export function UsersSelectAll({ formId }: { formId: string }) {
  return (
    <input type="checkbox" aria-label="Tout sélectionner" className="h-4 w-4 rounded border-line"
      onChange={(e) => document.querySelectorAll<HTMLInputElement>(`input[name="id"][form="${formId}"]`).forEach((c) => { c.checked = e.target.checked; })} />
  );
}
