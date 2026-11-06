"use client";

import { useRef } from "react";
import Link from "next/link";
import { RotateCcw, Search } from "lucide-react";
import { EVALUATION_STATUSES, EVALUATION_STATUS_UI, type EvaluationFilters } from "@/lib/admin/evaluations";
import type { EvaluationOptions } from "@/lib/admin/evaluations-queries";

const field = "w-full rounded-lg border border-line bg-white px-3 py-2.5 text-sm text-brand-dark";

/** Filtres de la liste des évaluations : les listes et dates s'appliquent dès le choix, la recherche à la touche Entrée. */
export function EvaluationsFilters({ values, options, hidden }: { values: EvaluationFilters; options: EvaluationOptions; hidden: Record<string, string> }) {
  const form = useRef<HTMLFormElement>(null);
  const apply = () => form.current?.requestSubmit();
  const sessions = values.course ? options.sessions.filter((s) => s.course_id === values.course) : options.sessions;
  return (
    <form ref={form} role="search" className="grid items-center gap-3 md:grid-cols-2 xl:grid-cols-[minmax(0,1.5fr)_repeat(3,minmax(0,1fr))_minmax(0,1.3fr)_auto]">
      {Object.entries(hidden).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-brand" aria-hidden />
        <input name="q" type="search" defaultValue={values.q} placeholder="Rechercher une évaluation (titre, formation…)" aria-label="Rechercher une évaluation"
          className="w-full rounded-lg border border-line bg-white py-2.5 pl-9 pr-3 text-sm" />
      </div>
      <select name="formation" defaultValue={values.course} onChange={apply} aria-label="Formation" className={field}>
        <option value="">Toutes les formations</option>
        {options.courses.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
      </select>
      <select name="session" defaultValue={values.session} onChange={apply} aria-label="Session" className={field}>
        <option value="">Toutes les sessions</option>
        {sessions.map((s) => <option key={s.id} value={s.id}>{s.title}</option>)}
      </select>
      <select name="statut" defaultValue={values.status} onChange={apply} aria-label="Statut" className={field}>
        <option value="">Tous les statuts</option>
        {EVALUATION_STATUSES.map((k) => <option key={k} value={k}>{EVALUATION_STATUS_UI[k].label}</option>)}
      </select>
      <fieldset>
        <legend className="sr-only">Période</legend>
        <div className="flex items-center gap-1.5">
          <input type="date" name="du" defaultValue={values.from} onChange={apply} aria-label="Du" className={field} />
          <span aria-hidden className="text-muted">→</span>
          <input type="date" name="au" defaultValue={values.to} onChange={apply} aria-label="Au" className={field} />
        </div>
      </fieldset>
      <Link href="/admin/evaluations" className="inline-flex items-center justify-center gap-2 px-3 py-2.5 text-sm font-semibold text-brand-dark hover:text-brand">
        <RotateCcw className="h-4 w-4" aria-hidden /> Réinitialiser
      </Link>
    </form>
  );
}
