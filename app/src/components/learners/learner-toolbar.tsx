"use client";

import { useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Download, Search, SlidersHorizontal } from "lucide-react";
import { LEARNER_STATUS, type LearnerStatus } from "@/lib/learners/overview";

export const EXPORT_FORM_ID = "learners-export";
const select = "rounded-lg border border-line bg-white px-3 py-2 text-sm text-brand-dark";

/** Filtres de la liste (appliqués dès le choix) et export des lignes cochées ou filtrées. */
export function LearnerFilters({ values, courses, sessions, hidden }: {
  values: { q: string; session: string; status: string; course: string };
  courses: { id: string; title: string }[];
  sessions: { id: string; title: string }[];
  hidden: Record<string, string>;
}) {
  const form = useRef<HTMLFormElement>(null);
  const apply = () => form.current?.requestSubmit();
  return (
    <>
      <form ref={form} role="search" className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
        {Object.entries(hidden).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
        <div className="relative min-w-48 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-brand" aria-hidden />
          <input name="q" type="search" defaultValue={values.q} placeholder="Rechercher un apprenant (nom, email…)" aria-label="Rechercher un apprenant"
            className="w-full rounded-lg border border-line bg-white py-2 pl-9 pr-3 text-sm" />
        </div>
        <select name="session" defaultValue={values.session} onChange={apply} aria-label="Session" className={`${select} sm:w-44`}>
          <option value="">Toutes mes sessions</option>
          {sessions.map((s) => <option key={s.id} value={s.id}>{s.title}</option>)}
        </select>
        <select name="status" defaultValue={values.status} onChange={apply} aria-label="Statut" className={`${select} sm:w-36`}>
          <option value="">Tous les statuts</option>
          {(Object.keys(LEARNER_STATUS) as LearnerStatus[]).map((k) => <option key={k} value={k}>{LEARNER_STATUS[k].label}</option>)}
        </select>
        <select name="course" defaultValue={values.course} onChange={apply} aria-label="Formation" className={`${select} sm:w-44`}>
          <option value="">Toutes les formations</option>
          {courses.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
        </select>
      </form>
      <Link href="/formateur/apprenants" aria-label="Réinitialiser les filtres" title="Réinitialiser les filtres" className="rounded-lg border border-line p-2.5 text-brand hover:bg-brand-soft">
        <SlidersHorizontal className="h-4 w-4" aria-hidden />
      </Link>
      <button type="submit" form={EXPORT_FORM_ID} aria-label="Exporter en CSV (lignes cochées, sinon filtre courant)" title="Exporter en CSV (lignes cochées, sinon filtre courant)"
        className="rounded-lg border border-line p-2.5 text-brand hover:bg-brand-soft"><Download className="h-4 w-4" aria-hidden /></button>
    </>
  );
}

/** Case d'en-tête : coche ou décoche toutes les lignes de la page. */
export function SelectAll() {
  return (
    <input type="checkbox" aria-label="Tout sélectionner" className="h-4 w-4 rounded border-line"
      onChange={(e) => document.querySelectorAll<HTMLInputElement>(`input[name="id"][form="${EXPORT_FORM_ID}"]`).forEach((c) => { c.checked = e.target.checked; })} />
  );
}

export function PageSize({ value, options, hrefs }: { value: number; options: number[]; hrefs: Record<number, string> }) {
  const router = useRouter();
  return (
    <label className="flex items-center gap-2 text-sm text-brand-dark">
      Éléments par page
      <select defaultValue={value} aria-label="Éléments par page" className="rounded-lg border border-line bg-white px-2 py-1.5 text-sm"
        onChange={(e) => router.push(hrefs[Number(e.target.value)])}>
        {options.map((n) => <option key={n} value={n}>{n}</option>)}
      </select>
    </label>
  );
}
