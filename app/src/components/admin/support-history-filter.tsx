"use client";

import { useRef } from "react";
import { HISTORY_FILTERS, type HistoryFilter } from "@/lib/admin/support";

/** Choix du type d'événement : la liste s'applique dès le choix (l'onglet reste « Historique »). */
export function HistoryFilterSelect({ value }: { value: HistoryFilter }) {
  const form = useRef<HTMLFormElement>(null);
  return (
    <form ref={form} method="get">
      <input type="hidden" name="onglet" value="historique" />
      <label htmlFor="h-filtre" className="sr-only">Type d’événement</label>
      <select id="h-filtre" name="evenement" defaultValue={value} onChange={() => form.current?.requestSubmit()}
        className="rounded-lg border border-brand bg-white px-4 py-2.5 text-sm font-semibold text-brand-dark">
        {(Object.keys(HISTORY_FILTERS) as HistoryFilter[]).map((k) => <option key={k} value={k}>{HISTORY_FILTERS[k]}</option>)}
      </select>
    </form>
  );
}
