"use client";

import { useState } from "react";
import { CalendarDays, Download, Eye, FileText, GraduationCap, ShieldCheck, User, BarChart3, ClipboardCheck, type LucideIcon } from "lucide-react";
import { ENROLLMENT_STATUS } from "@/lib/courses/labels";
import {
  DESCRIPTION_MAX, INDICATORS, INDICATOR_KEYS, NAME_MAX, REPORT_FORMATS, REPORT_FORMAT_KEYS, periodLabel, type ReportParams,
} from "@/lib/admin/report-generation";
import { REPORT_TYPES, REPORT_TYPE_KEYS, reportName, type ReportType } from "@/lib/admin/reports";
import type { GeneratorOptions } from "@/lib/admin/reports-queries";
import { cn } from "@/lib/utils";

const select = "w-full rounded-lg border border-line bg-white py-2.5 pl-9 pr-3 text-sm text-brand-dark outline-none focus:border-brand focus:ring-2 focus:ring-brand/20";
const lbl = "mb-1 block text-sm font-semibold text-brand-dark";
const dayShort = new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "short", year: "numeric", timeZone: "Africa/Abidjan" });

function Field({ icon: Icon, children }: { icon: LucideIcon; children: React.ReactNode }) {
  return <div className="relative"><Icon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-brand" aria-hidden />{children}</div>;
}

/**
 * Paramètres d'un rapport. Le formulaire envoie ses valeurs dans l'adresse : « Mettre à jour l'aperçu » recharge la page,
 * « Télécharger » produit le fichier sans l'enregistrer, « Générer le rapport » le produit et l'ajoute aux rapports récents.
 */
export function ReportGeneratorForm({ params, months, options }: { params: ReportParams; months: string[]; options: GeneratorOptions }) {
  const [type, setType] = useState<ReportType>(params.type);
  const [month, setMonth] = useState(params.month);
  const [course, setCourse] = useState(params.filters.course);
  const [session, setSession] = useState(params.filters.session);
  const [format, setFormat] = useState(params.format);
  const [name, setName] = useState(params.name);
  const [touched, setTouched] = useState(false);
  const [description, setDescription] = useState(params.description);

  const sessions = course ? options.sessions.filter((s) => s.courseId === course) : options.sessions;
  const syncName = (t: ReportType, m: string) => { if (!touched) setName(reportName(t, m)); };
  const showStatus = type === "inscriptions" || type === "apprenants";
  const FILE = "/admin/rapports/export";

  return (
    <form method="get" action="/admin/rapports/generer" className="space-y-5">
      <input type="hidden" name="f" value="1" />
      <div className="grid gap-4 sm:grid-cols-2">
        <div><label htmlFor="g-type" className={lbl}>Type de rapport <span className="text-danger">*</span></label>
          <Field icon={FileText}><select id="g-type" name="type" value={type} onChange={(e) => { const t = e.target.value as ReportType; setType(t); syncName(t, month); }} className={select}>
            {REPORT_TYPE_KEYS.map((k) => <option key={k} value={k}>{REPORT_TYPES[k].label}</option>)}</select></Field></div>
        <div><label htmlFor="g-mois" className={lbl}>Période <span className="text-danger">*</span></label>
          <Field icon={CalendarDays}><select id="g-mois" name="mois" value={month} onChange={(e) => { setMonth(e.target.value); syncName(type, e.target.value); }} className={select}>
            {months.map((m) => <option key={m} value={m}>{periodLabel(m)}</option>)}</select></Field></div>
        <div><label htmlFor="g-formation" className={lbl}>Formations</label>
          <Field icon={GraduationCap}><select id="g-formation" name="formation" value={course} onChange={(e) => { setCourse(e.target.value); setSession(""); }} className={select}>
            <option value="">Toutes les formations</option>{options.courses.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}</select></Field></div>
        <div><label htmlFor="g-session" className={lbl}>Sessions</label>
          <Field icon={CalendarDays}><select id="g-session" name="session" value={session} onChange={(e) => setSession(e.target.value)} className={select}>
            <option value="">Toutes les sessions</option>{sessions.map((s) => <option key={s.id} value={s.id}>{s.title} ({dayShort.format(new Date(s.start))})</option>)}</select></Field></div>
        <div><label htmlFor="g-formateur" className={lbl}>Formateurs</label>
          <Field icon={User}><select id="g-formateur" name="formateur" defaultValue={params.filters.instructor} className={select}>
            <option value="">Tous les formateurs</option>{options.instructors.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}</select></Field></div>
        <div><label htmlFor="g-statut" className={lbl}>Statut d’inscription</label>
          <Field icon={ShieldCheck}><select id="g-statut" name="statut" defaultValue={params.filters.status} disabled={!showStatus} className={cn(select, !showStatus && "bg-surface text-muted")}>
            <option value="">Tous les statuts</option>{Object.entries(ENROLLMENT_STATUS).map(([k, s]) => <option key={k} value={k}>{s.label}</option>)}</select></Field>
          {!showStatus && <p className="mt-1 text-xs text-muted">S’applique aux rapports d’inscriptions et d’apprenants.</p>}</div>
      </div>

      <fieldset>
        <legend className={lbl}>Indicateurs à inclure <span className="text-danger">*</span></legend>
        <div className="grid gap-x-6 gap-y-3 rounded-xl border border-line bg-surface p-4 sm:grid-cols-2">
          {INDICATOR_KEYS.map((k) => (
            <label key={k} className="flex cursor-pointer items-center gap-3 text-sm text-brand-dark">
              <input type="checkbox" name="ind" value={k} defaultChecked={params.indicators.includes(k)} className="h-4 w-4 rounded border-line" />
              {k === "analyse" ? <span className="inline-flex items-center gap-1.5"><BarChart3 className="h-4 w-4 text-brand" aria-hidden />{INDICATORS[k]}</span> : INDICATORS[k]}
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset>
        <legend className={lbl}>Format de sortie <span className="text-danger">*</span></legend>
        <div className="grid grid-cols-3 gap-3">
          {REPORT_FORMAT_KEYS.map((k) => (
            <label key={k} className={cn("flex cursor-pointer items-center gap-2.5 rounded-xl border px-3 py-3 text-sm font-semibold text-brand-dark", format === k ? "border-brand bg-brand-soft" : "border-line hover:bg-surface")}>
              <input type="radio" name="format" value={k} checked={format === k} onChange={() => setFormat(k)} className="h-4 w-4" />
              <span className={cn("rounded px-1.5 py-0.5 text-[10px] font-extrabold", REPORT_FORMATS[k].tone)} aria-hidden>{k === "xlsx" ? "XLS" : REPORT_FORMATS[k].label}</span>
              {REPORT_FORMATS[k].label}
            </label>
          ))}
        </div>
      </fieldset>

      <div><label htmlFor="g-nom" className={lbl}>Nom du rapport <span className="text-danger">*</span></label>
        <Field icon={FileText}><input id="g-nom" name="nom" value={name} onChange={(e) => { setName(e.target.value); setTouched(true); }} minLength={3} maxLength={NAME_MAX} required className={select} /></Field></div>
      <div><label htmlFor="g-desc" className={lbl}>Description <span className="font-normal text-muted">(optionnelle)</span></label>
        <textarea id="g-desc" name="description" value={description} onChange={(e) => setDescription(e.target.value)} maxLength={DESCRIPTION_MAX} rows={3}
          className="w-full rounded-lg border border-line bg-white px-3 py-2.5 text-sm text-brand-dark outline-none focus:border-brand focus:ring-2 focus:ring-brand/20" />
        <p className="text-right text-xs text-muted">{description.length}/{DESCRIPTION_MAX}</p></div>

      <div className="flex flex-wrap justify-end gap-3 border-t border-line pt-4">
        <button type="submit" className="inline-flex items-center gap-2 rounded-lg border border-brand bg-white px-5 py-3 text-sm font-semibold text-brand hover:bg-brand-soft"><Eye className="h-4 w-4" aria-hidden /> Mettre à jour l’aperçu</button>
        <button type="submit" formAction={FILE} className="inline-flex items-center gap-2 rounded-lg border border-brand bg-white px-5 py-3 text-sm font-semibold text-brand hover:bg-brand-soft"><Download className="h-4 w-4" aria-hidden /> Télécharger</button>
        <button type="submit" formAction={FILE} name="journal" value="1" className="inline-flex items-center gap-2 rounded-lg bg-brand px-5 py-3 text-sm font-semibold text-white hover:bg-brand-dark"><BarChart3 className="h-4 w-4" aria-hidden /> Générer le rapport</button>
      </div>
      <p className="flex items-start gap-2 text-xs text-muted"><ClipboardCheck className="mt-0.5 h-4 w-4 shrink-0" aria-hidden /><span><strong>Télécharger</strong> produit le fichier sans le conserver ; <strong>Générer le rapport</strong> le produit et l’ajoute aux rapports récents, d’où il se télécharge à nouveau.</span></p>
    </form>
  );
}
