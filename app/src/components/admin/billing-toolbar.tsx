"use client";

import { useRef } from "react";
import Link from "next/link";
import { Printer, RotateCcw, Search } from "lucide-react";
import { INVOICE_STATUS_UI, REFUND_STATUS_UI, type BillingFilters } from "@/lib/admin/billing";

const field = "w-full rounded-lg border border-line bg-white px-3 py-2.5 text-sm text-brand-dark";

/** Filtres de la liste (selon l'onglet) : les listes et dates s'appliquent dès le choix, la recherche à la touche Entrée. */
export function BillingToolbar({ values, courses, hidden }: { values: BillingFilters; courses: { id: string; title: string }[]; hidden: Record<string, string> }) {
  const form = useRef<HTMLFormElement>(null);
  const apply = () => form.current?.requestSubmit();
  const statuses = values.tab === "factures" ? Object.entries(INVOICE_STATUS_UI) : values.tab === "remboursements" ? Object.entries(REFUND_STATUS_UI) : [];
  return (
    <form ref={form} role="search" className="grid items-center gap-3 md:grid-cols-2 xl:grid-cols-[minmax(0,1.6fr)_repeat(2,minmax(0,1fr))_minmax(0,1.3fr)_auto]">
      <input type="hidden" name="onglet" value={values.tab} />
      {Object.entries(hidden).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-brand" aria-hidden />
        <input name="q" type="search" defaultValue={values.q} placeholder="Rechercher (N°, apprenant, formation…)" aria-label="Rechercher" className="w-full rounded-lg border border-line bg-white py-2.5 pl-9 pr-3 text-sm" />
      </div>
      {values.tab === "factures" ? (
        <select name="formation" defaultValue={values.course} onChange={apply} aria-label="Formation" className={field}>
          <option value="">Toutes les formations</option>{courses.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
        </select>
      ) : <span className="hidden xl:block" />}
      {statuses.length > 0 ? (
        <select name="statut" defaultValue={values.status} onChange={apply} aria-label="Statut" className={field}>
          <option value="">Tous les statuts</option>{statuses.map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
      ) : <span className="hidden xl:block" />}
      <fieldset>
        <legend className="sr-only">Période</legend>
        <div className="flex items-center gap-1.5">
          <input type="date" name="du" defaultValue={values.from} onChange={apply} aria-label="Du" className={field} />
          <span aria-hidden className="text-muted">→</span>
          <input type="date" name="au" defaultValue={values.to} onChange={apply} aria-label="Au" className={field} />
        </div>
      </fieldset>
      <Link href={`/admin/factures?onglet=${values.tab}`} className="inline-flex items-center justify-center gap-2 px-3 py-2.5 text-sm font-semibold text-brand-dark hover:text-brand">
        <RotateCcw className="h-4 w-4" aria-hidden /> Réinitialiser
      </Link>
    </form>
  );
}

/** Imprime la page courante (relevé) : la boîte d'impression du navigateur permet aussi l'enregistrement en PDF. */
export function PrintButton({ label = "Imprimer", className }: { label?: string; className?: string }) {
  return (
    <button type="button" onClick={() => window.print()} className={className ?? "inline-flex items-center gap-2 rounded-lg border border-line bg-white px-4 py-2 text-sm font-semibold text-brand-dark hover:bg-brand-soft print:hidden"}>
      <Printer className="h-4 w-4" aria-hidden /> {label}
    </button>
  );
}
