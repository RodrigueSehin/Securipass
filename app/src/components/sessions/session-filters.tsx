"use client";

import { useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Download, RotateCcw, Search } from "lucide-react";
import { DATE_FILTERS, DISPLAY_STATUS, type DisplayStatus } from "@/lib/sessions/dashboard";

const select = "w-full rounded-lg border border-line bg-white px-3 py-2 text-sm text-brand-dark";

/** Filtres de la liste : les listes déroulantes appliquent le filtre dès le choix, la recherche à la touche Entrée. */
export function SessionFilters({ values, courses, hidden, exportHref }: {
  values: { q: string; course: string; status: string; date: string };
  courses: { id: string; title: string }[];
  hidden: Record<string, string>;
  exportHref: string;
}) {
  const form = useRef<HTMLFormElement>(null);
  const apply = () => form.current?.requestSubmit();
  return (
    <form ref={form} role="search" className="flex flex-wrap items-center gap-2 border-b border-line p-4">
      {Object.entries(hidden).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
      <div className="relative min-w-48 flex-1">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-brand" aria-hidden />
        <input name="q" type="search" defaultValue={values.q} placeholder="Rechercher une session…" aria-label="Rechercher une session"
          className="w-full rounded-lg border border-line bg-white py-2 pl-9 pr-3 text-sm" />
      </div>
      <select name="course" defaultValue={values.course} onChange={apply} aria-label="Formation" className={`${select} sm:w-48`}>
        <option value="">Toutes les formations</option>
        {courses.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
      </select>
      <select name="status" defaultValue={values.status} onChange={apply} aria-label="Statut" className={`${select} sm:w-40`}>
        <option value="">Tous les statuts</option>
        {(Object.keys(DISPLAY_STATUS) as DisplayStatus[]).map((k) => <option key={k} value={k}>{DISPLAY_STATUS[k].label}</option>)}
      </select>
      <select name="date" defaultValue={values.date} onChange={apply} aria-label="Dates" className={`${select} sm:w-40`}>
        <option value="">Toutes les dates</option>
        {DATE_FILTERS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
      </select>
      <Link href="/formateur/sessions" aria-label="Réinitialiser les filtres" title="Réinitialiser les filtres" className="rounded-lg p-2 text-brand hover:bg-brand-soft">
        <RotateCcw className="h-4 w-4" aria-hidden />
      </Link>
      <a href={exportHref} aria-label="Exporter en CSV" title="Exporter en CSV" className="rounded-lg p-2 text-brand hover:bg-brand-soft">
        <Download className="h-4 w-4" aria-hidden />
      </a>
    </form>
  );
}

/** Nombre d'éléments par page : change l'adresse dès le choix. */
export function PageSizeSelect({ value, options, hrefs }: { value: number; options: number[]; hrefs: Record<number, string> }) {
  const router = useRouter();
  return (
    <label className="flex items-center gap-2 text-sm text-brand-dark">
      Éléments par page
      <select defaultValue={value} aria-label="Éléments par page" className="rounded-lg border border-line bg-white px-2 py-1.5 text-sm"
        onChange={(e) => { router.push(hrefs[Number(e.target.value)]); }}>
        {options.map((n) => <option key={n} value={n}>{n}</option>)}
      </select>
    </label>
  );
}
