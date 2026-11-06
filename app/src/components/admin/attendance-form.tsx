"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, CalendarDays, Check, CheckCircle2, Clock, GraduationCap, Layers, MapPin, RotateCcw, Save, User, Users, X, XCircle } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { Alert } from "@/components/ui/feedback";
import { ATTENDANCE_CHOICES, attendanceRate, formatRate, type AttendanceOptions, type AttendanceRow, type AttendanceSessionHead } from "@/lib/admin/attendance";
import { recordAttendance } from "@/lib/admin/attendance-actions";
import { formatDayRange } from "@/lib/admin/sessions";
import type { FormState } from "@/lib/auth/actions";
import { MODES } from "@/lib/courses/labels";
import { formatTimeRange } from "@/lib/format";
import { cn } from "@/lib/utils";

const input = "w-full rounded-lg border border-line bg-white px-2.5 py-2 text-sm text-brand-dark outline-none focus:border-brand focus:ring-2 focus:ring-brand/20";
const info = "flex items-center gap-2 rounded-lg border border-line bg-surface px-3 py-2.5 text-sm text-brand-dark";
const lbl = "mb-1 block text-sm font-semibold text-brand-dark";

type Line = { status: string; checkIn: string; checkOut: string; note: string };
const initial = (rows: AttendanceRow[]): Record<string, Line> =>
  Object.fromEntries(rows.map((r) => [r.learner_id, { status: r.status ?? "", checkIn: r.check_in ?? "", checkOut: r.check_out ?? "", note: r.justification ?? "" }]));
const present = (s: string) => s === "present" || s === "late";

/** Saisie des présences d'une session : informations de la séance (lues sur la session), liste des apprenants avec statut, heures et commentaire, récapitulatif en direct. */
export function AttendanceForm({ head, options, rows }: { head: AttendanceSessionHead; options: AttendanceOptions; rows: AttendanceRow[] }) {
  const [state, action, pending] = useActionState<FormState, FormData>(recordAttendance, {});
  const router = useRouter();
  const [lines, setLines] = useState(() => initial(rows));
  const fe = state.fieldErrors ?? {};
  const courseSessions = options.sessions.filter((s) => s.course_id === head.course_id);

  const patch = (id: string, p: Partial<Line>) => setLines((l) => ({ ...l, [id]: { ...l[id], ...p } }));
  const setStatus = (id: string, status: string) => patch(id, present(status) ? { status } : { status, checkIn: "", checkOut: "" });
  const all = (status: string) => setLines((l) => Object.fromEntries(Object.entries(l).map(([id, v]) => [id, present(status) ? { ...v, status } : { ...v, status, checkIn: "", checkOut: "" }])));

  const values = Object.values(lines);
  const nPresent = values.filter((v) => present(v.status)).length;
  const nAbsent = values.filter((v) => v.status === "absent" || v.status === "excused").length;
  const rate = attendanceRate(nPresent, values.length);

  return (
    <form action={action} className="space-y-6">
      {state.error && <Alert>{state.error}</Alert>}
      <input type="hidden" name="sessionId" value={head.session_id} />

      <section className="rounded-2xl border border-line bg-white p-5 shadow-card">
        <h2 className="mb-4 flex items-center gap-3 text-base font-extrabold text-brand-dark"><CalendarDays className="h-5 w-5 text-brand" aria-hidden />Informations de la séance</h2>
        <div className="grid gap-4 md:grid-cols-2">
          <div><label htmlFor="a-course" className={lbl}>Formation</label>
            <select id="a-course" value={head.course_id} onChange={(e) => { const s = options.sessions.find((x) => x.course_id === e.target.value); if (s) router.push(`/admin/presences/enregistrer?session=${s.id}`); }} className={cn(input, "py-2.5")}>
              {options.courses.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}</select></div>
          <div><label htmlFor="a-session" className={lbl}>Session</label>
            <select id="a-session" value={head.session_id} onChange={(e) => router.push(`/admin/presences/enregistrer?session=${e.target.value}`)} className={cn(input, "py-2.5")}>
              {courseSessions.map((s) => <option key={s.id} value={s.id}>{s.title} ({formatDayRange(s.start_at, s.end_at, s.timezone)})</option>)}</select></div>
        </div>
        <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <div><p className={lbl}>Date de séance</p><p className={info}><CalendarDays className="h-4 w-4 text-muted" aria-hidden />{formatDayRange(head.start_at, head.end_at, head.timezone)}</p></div>
          <div><p className={lbl}>Horaire (début – fin)</p><p className={info}><Clock className="h-4 w-4 text-muted" aria-hidden />{formatTimeRange(head.start_at, head.end_at, head.timezone)}</p></div>
          <div><p className={lbl}>Type de séance</p><p className={info}><Layers className="h-4 w-4 text-muted" aria-hidden />{MODES[head.delivery_mode as keyof typeof MODES] ?? head.delivery_mode}</p></div>
          <div><p className={lbl}>Formateur</p><p className={info}><User className="h-4 w-4 text-muted" aria-hidden />{head.instructor_name}</p></div>
          <div className="md:col-span-2"><p className={lbl}>Salle / Lieu</p><p className={info}><MapPin className="h-4 w-4 text-muted" aria-hidden />{head.delivery_mode === "online" ? "En ligne" : head.location ?? "Lieu non précisé"}</p></div>
        </div>
        <p className="mt-3 flex items-center gap-2 text-xs text-muted"><GraduationCap className="h-4 w-4" aria-hidden />Ces informations sont celles de la session : pour les changer, modifiez la session.</p>
      </section>

      <section className="rounded-2xl border border-line bg-white p-5 shadow-card">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="flex items-center gap-3 text-base font-extrabold text-brand-dark"><Users className="h-5 w-5 text-brand" aria-hidden />Liste des apprenants ({rows.length})</h2>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => all("present")} className="inline-flex items-center gap-2 rounded-lg border border-line px-3 py-2 text-sm font-semibold text-brand-dark hover:bg-brand-soft"><Check className="h-4 w-4" aria-hidden />Tout marquer présent</button>
            <button type="button" onClick={() => all("absent")} className="inline-flex items-center gap-2 rounded-lg border border-line px-3 py-2 text-sm font-semibold text-brand-dark hover:bg-brand-soft"><X className="h-4 w-4" aria-hidden />Tout marquer absent</button>
            <button type="button" onClick={() => setLines(initial(rows))} className="inline-flex items-center gap-2 rounded-lg border border-line px-3 py-2 text-sm font-semibold text-brand-dark hover:bg-brand-soft"><RotateCcw className="h-4 w-4" aria-hidden />Réinitialiser</button>
          </div>
        </div>
        <div className="overflow-x-auto rounded-xl border border-line">
          <table className="w-full min-w-[60rem] text-left text-sm">
            <thead className="bg-surface text-xs text-brand-dark"><tr>
              <th scope="col" className="w-10 px-3 py-3"><span className="sr-only">Présent</span></th><th scope="col" className="px-3 py-3 font-semibold">#</th><th scope="col" className="px-3 py-3 font-semibold">Apprenant</th>
              <th scope="col" className="px-3 py-3 font-semibold">Matricule</th><th scope="col" className="px-3 py-3 font-semibold">Entreprise</th><th scope="col" className="px-3 py-3 font-semibold">Statut de présence</th>
              <th scope="col" className="px-3 py-3 font-semibold">Heure d’arrivée</th><th scope="col" className="px-3 py-3 font-semibold">Heure de départ</th><th scope="col" className="px-3 py-3 font-semibold">Commentaires <span className="font-normal text-muted">(optionnel)</span></th>
            </tr></thead>
            <tbody>
              {rows.map((r, i) => {
                const v = lines[r.learner_id];
                const ok = present(v.status);
                const ko = v.status === "absent" || v.status === "excused";
                return (
                  <tr key={r.learner_id} id={`l-${r.learner_id}`} className="border-t border-line target:bg-brand-soft/40">
                    <td className="px-3 py-2.5"><input type="checkbox" checked={ok} onChange={(e) => setStatus(r.learner_id, e.target.checked ? "present" : "absent")} aria-label={`${r.full_name} est présent`} className="h-4 w-4 rounded border-line accent-[var(--color-brand)]" /></td>
                    <td className="px-3 py-2.5 text-muted">{i + 1}</td>
                    <td className="px-3 py-2.5"><input type="hidden" name="learner" value={r.learner_id} />
                      <div className="flex items-center gap-3"><Avatar name={r.full_name} src={r.avatar_url} size={36} /><span className="font-bold text-brand-dark">{r.full_name}</span></div></td>
                    <td className="px-3 py-2.5 text-brand-dark">{r.learner_code ?? "—"}</td>
                    <td className="px-3 py-2.5 text-brand-dark">{r.organization ?? <span className="text-muted">Particulier</span>}</td>
                    <td className="px-3 py-2.5">
                      <div className="relative">
                        {ok && <CheckCircle2 className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-success" aria-hidden />}
                        {ko && <XCircle className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-danger" aria-hidden />}
                        <select name={`status-${r.learner_id}`} value={v.status} onChange={(e) => setStatus(r.learner_id, e.target.value)} aria-label={`Statut de ${r.full_name}`}
                          className={cn(input, "font-semibold", (ok || ko) && "pl-8", ok && "border-success/30 bg-success/10 text-success", ko && "border-danger/30 bg-danger/10 text-danger")}>
                          <option value="">Non saisi</option>{Object.entries(ATTENDANCE_CHOICES).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
                      </div>
                    </td>
                    <td className="px-3 py-2.5">{ok ? <input type="time" name={`in-${r.learner_id}`} value={v.checkIn} onChange={(e) => patch(r.learner_id, { checkIn: e.target.value })} aria-label={`Arrivée de ${r.full_name}`} className={input} /> : <span className="block text-center text-muted">–<input type="hidden" name={`in-${r.learner_id}`} value="" /></span>}</td>
                    <td className="px-3 py-2.5">{ok ? <>
                      <input type="time" name={`out-${r.learner_id}`} value={v.checkOut} onChange={(e) => patch(r.learner_id, { checkOut: e.target.value })} aria-label={`Départ de ${r.full_name}`} className={input} />
                      {fe[r.learner_id]?.[0] && <p role="alert" className="mt-1 text-xs text-danger">{fe[r.learner_id][0]}</p>}</> : <span className="block text-center text-muted">–<input type="hidden" name={`out-${r.learner_id}`} value="" /></span>}</td>
                    <td className="px-3 py-2.5"><input name={`note-${r.learner_id}`} value={v.note} onChange={(e) => patch(r.learner_id, { note: e.target.value })} maxLength={500} placeholder={v.status === "absent" ? "Non justifiée" : "–"} aria-label={`Commentaire pour ${r.full_name}`} className={input} /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-2xl border border-line bg-white p-5 shadow-card" aria-live="polite">
        <div className="flex flex-wrap items-center gap-x-10 gap-y-4">
          <h2 className="flex items-center gap-3 text-base font-extrabold text-brand-dark"><Users className="h-5 w-5 text-brand" aria-hidden />Récapitulatif de la séance</h2>
          {([["Présents", nPresent, "text-success"], ["Absents", nAbsent, "text-danger"], ["Total", rows.length, "text-brand-dark"]] as const).map(([l, n, tone]) => (
            <div key={l}><p className={cn("text-2xl font-extrabold", tone)}>{n}</p><p className="text-sm text-muted">{l}</p></div>
          ))}
          <div><p className="text-2xl font-extrabold text-brand-dark">{formatRate(rate)}</p><p className="text-sm text-muted">Taux de présence</p></div>
        </div>
      </section>

      <p className="text-xs text-muted">Les heures ne sont conservées que pour « Présent » et « En retard ». Les lignes « Non saisi » ne sont pas modifiées.</p>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link href={`/admin/presences?session=${head.session_id}`} className="inline-flex items-center gap-2 rounded-lg border border-brand bg-white px-5 py-2.5 text-sm font-semibold text-brand hover:bg-brand-soft"><ArrowLeft className="h-4 w-4" aria-hidden /> Retour à la liste</Link>
        <div className="flex gap-3">
          <button type="button" onClick={() => setLines(initial(rows))} className="inline-flex items-center gap-2 rounded-lg border border-brand bg-white px-5 py-2.5 text-sm font-semibold text-brand hover:bg-brand-soft"><RotateCcw className="h-4 w-4" aria-hidden /> Réinitialiser</button>
          <button type="submit" disabled={pending} className="inline-flex items-center gap-2 rounded-lg bg-brand px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-dark disabled:opacity-60"><Save className="h-4 w-4" aria-hidden /> {pending ? "Enregistrement…" : "Enregistrer la présence"}</button>
        </div>
      </div>
    </form>
  );
}
