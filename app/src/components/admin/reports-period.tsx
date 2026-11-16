"use client";

import { useRef } from "react";
import { CalendarDays } from "lucide-react";
import { monthLabel } from "@/lib/admin/commissions";

/** Choix du mois du rapport : s'applique dès le choix. */
export function ReportsPeriod({ value, months }: { value: string; months: string[] }) {
  const form = useRef<HTMLFormElement>(null);
  return (
    <form ref={form} className="relative">
      <label htmlFor="r-mois" className="sr-only">Période</label>
      <CalendarDays className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-brand" aria-hidden />
      <select id="r-mois" name="mois" defaultValue={value} onChange={() => form.current?.requestSubmit()}
        className="rounded-lg border border-line bg-white py-2.5 pl-9 pr-8 text-sm font-semibold text-brand-dark">
        {months.map((m) => <option key={m} value={m}>Période : {monthLabel(m)}</option>)}
      </select>
    </form>
  );
}
