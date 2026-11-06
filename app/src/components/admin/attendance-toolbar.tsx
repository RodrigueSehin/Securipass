"use client";

import { useRef } from "react";
import Link from "next/link";
import { RotateCcw } from "lucide-react";
import { formatDayRange } from "@/lib/admin/sessions";
import type { AttendanceFilters, AttendanceOptions } from "@/lib/admin/attendance";

const field = "w-full rounded-lg border border-line bg-white px-3 py-2.5 text-sm text-brand-dark";
const label = "mb-1 block text-xs font-semibold text-brand-dark";

/** Filtres des présences : formation, session et date s'appliquent dès le choix. */
export function AttendanceToolbar({ values, options, hidden }: { values: AttendanceFilters; options: AttendanceOptions; hidden: Record<string, string> }) {
  const form = useRef<HTMLFormElement>(null);
  const apply = () => form.current?.requestSubmit();
  const sessions = values.course ? options.sessions.filter((s) => s.course_id === values.course) : options.sessions;
  return (
    <form ref={form} className="grid items-end gap-3 md:grid-cols-2 xl:grid-cols-[repeat(3,minmax(0,1fr))_auto]">
      {Object.entries(hidden).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
      <div>
        <label htmlFor="p-formation" className={label}>Formation</label>
        <select id="p-formation" name="formation" defaultValue={values.course} onChange={apply} className={field}>
          <option value="">Toutes les formations</option>
          {options.courses.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
        </select>
      </div>
      <div>
        <label htmlFor="p-session" className={label}>Session</label>
        <select id="p-session" name="session" defaultValue={values.session} onChange={apply} className={field}>
          <option value="">Dernière session commencée</option>
          {sessions.map((s) => <option key={s.id} value={s.id}>{s.title} ({formatDayRange(s.start_at, s.end_at, s.timezone)})</option>)}
        </select>
      </div>
      <div>
        <label htmlFor="p-date" className={label}>Date de séance</label>
        <input id="p-date" name="date" type="date" defaultValue={values.date} onChange={apply} className={field} />
      </div>
      <Link href="/admin/presences" className="inline-flex items-center justify-center gap-2 px-3 py-2.5 text-sm font-semibold text-brand-dark hover:text-brand">
        <RotateCcw className="h-4 w-4" aria-hidden /> Réinitialiser
      </Link>
    </form>
  );
}
