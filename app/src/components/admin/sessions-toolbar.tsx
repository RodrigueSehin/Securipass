"use client";

import { useRef } from "react";
import Link from "next/link";
import { RotateCcw, Search } from "lucide-react";
import { MODES } from "@/lib/courses/labels";
import { SESSION_STATUSES, SESSION_STATUS_UI, type SessionFilters } from "@/lib/admin/sessions";

const field = "w-full rounded-lg border border-line bg-white px-3 py-2.5 text-sm text-brand-dark";
const label = "mb-1 block text-xs font-semibold text-brand-dark";

/** Filtres de la liste des sessions : les listes et dates s'appliquent dès le choix, la recherche à la touche Entrée. */
export function SessionsFilters({ values, courses, hidden }: { values: SessionFilters; courses: { id: string; title: string }[]; hidden: Record<string, string> }) {
  const form = useRef<HTMLFormElement>(null);
  const apply = () => form.current?.requestSubmit();
  return (
    <form ref={form} role="search" className="grid items-end gap-3 md:grid-cols-2 xl:grid-cols-[minmax(0,1.5fr)_repeat(3,minmax(0,1fr))_minmax(0,1.3fr)_auto]">
      {Object.entries(hidden).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-brand" aria-hidden />
        <input name="q" type="search" defaultValue={values.q} placeholder="Rechercher une session, une formation…" aria-label="Rechercher une session"
          className="w-full rounded-lg border border-line bg-white py-2.5 pl-9 pr-3 text-sm" />
      </div>
      <div>
        <label htmlFor="f-formation" className={label}>Formation</label>
        <select id="f-formation" name="formation" defaultValue={values.course} onChange={apply} className={field}>
          <option value="">Toutes les formations</option>
          {courses.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
        </select>
      </div>
      <div>
        <label htmlFor="f-statut" className={label}>Statut</label>
        <select id="f-statut" name="statut" defaultValue={values.status} onChange={apply} className={field}>
          <option value="">Tous les statuts</option>
          {SESSION_STATUSES.map((k) => <option key={k} value={k}>{SESSION_STATUS_UI[k].label}</option>)}
        </select>
      </div>
      <div>
        <label htmlFor="f-mode" className={label}>Mode</label>
        <select id="f-mode" name="mode" defaultValue={values.mode} onChange={apply} className={field}>
          <option value="">Tous les modes</option>
          {Object.entries(MODES).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
        </select>
      </div>
      <fieldset>
        <legend className={label}>Période</legend>
        <div className="flex items-center gap-1.5">
          <input type="date" name="du" defaultValue={values.from} onChange={apply} aria-label="Du" className={field} />
          <span aria-hidden className="text-muted">→</span>
          <input type="date" name="au" defaultValue={values.to} onChange={apply} aria-label="Au" className={field} />
        </div>
      </fieldset>
      <Link href="/admin/sessions" className="inline-flex items-center justify-center gap-2 rounded-lg bg-brand-soft px-4 py-2.5 text-sm font-semibold text-brand hover:bg-brand-soft/70">
        <RotateCcw className="h-4 w-4" aria-hidden /> Réinitialiser
      </Link>
    </form>
  );
}
