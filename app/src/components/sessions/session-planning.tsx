"use client";

import { useState } from "react";
import Image from "next/image";
import { CalendarClock, CalendarDays, Check, ChevronLeft, ChevronRight, Clock, Copy, Eye, FileText, Globe, Info, MapPin, Monitor, Plus, Trash2, Users, type LucideIcon } from "lucide-react";
import { Field, SelectField } from "@/components/ui/field";
import { Switch } from "@/components/ui/switch";
import { Card } from "@/components/sessions/session-ui";
import { MONTH_LABEL, monthGrid, shiftMonth } from "@/lib/sessions/dashboard";
import { MEETING_PLATFORMS, TIMEZONES } from "@/lib/sessions/timezones";
import { MAX_EXTRAS, minutesBetween, spanLabel, type Extra, type SessionDraft } from "@/lib/sessions/wizard";
import type { WizardCourse } from "@/lib/sessions/wizard-queries";
import { cn } from "@/lib/utils";

type CourseOption = WizardCourse & { cover: string | null };

const MODES = [
  { value: "online", label: "En ligne", hint: "Visioconférence (Teams, Zoom, etc.)", icon: Monitor },
  { value: "onsite", label: "Présentiel", hint: "En salle de formation", icon: Users },
  { value: "hybrid", label: "Hybride", hint: "En ligne et en présentiel", icon: Globe },
] as const;

const PLANNING = [
  { value: "single", label: "Session unique", hint: "Une seule date et plage horaire", icon: CalendarDays },
  { value: "multiple", label: "Sessions multiples", hint: "Plusieurs séances sur plusieurs dates", icon: CalendarClock },
] as const;

const longDate = (iso: string) => {
  const d = new Date(`${iso}T00:00:00Z`);
  return Number.isNaN(d.getTime()) ? "" : new Intl.DateTimeFormat("fr-FR", { dateStyle: "long", timeZone: "UTC" }).format(d);
};
const hhmm = (t: string) => t.replace(":", "h");

function Choice({ on, children, className }: { on: boolean; children: React.ReactNode; className?: string }) {
  return (
    <span className={cn("relative flex h-full cursor-pointer flex-col items-center gap-1 rounded-xl border p-4 text-center", on ? "border-brand bg-brand-soft" : "border-line hover:bg-brand-soft/50", className)}>
      {on && <span className="absolute left-2 top-2 flex h-6 w-6 items-center justify-center rounded-full bg-brand text-white"><Check className="h-4 w-4" aria-hidden /></span>}
      {children}
    </span>
  );
}

function IconField({ icon: Icon, label, error, children }: { icon: LucideIcon; label: string; error?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1 block text-sm font-semibold text-brand-dark">{label}</label>
      <div className="relative">
        <Icon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-brand" aria-hidden />
        {children}
      </div>
      {error && <p role="alert" className="mt-1 text-xs text-danger">{error}</p>}
    </div>
  );
}

const inputCls = "w-full rounded-lg border border-line bg-white py-2 pl-9 pr-3 text-sm text-brand-dark";

/** Étape 2 de l'assistant : date et heure (avec calendrier), modalité et lieu, aperçu et informations complémentaires. */
export function PlanningStep({ initial, errs, course, busyDates, nowMs }: {
  initial: SessionDraft; errs: Record<string, string[]>; course?: CourseOption; busyDates: string[]; nowMs: number;
}) {
  const today = new Date(nowMs).toISOString().slice(0, 10);
  const [planning, setPlanning] = useState(initial.planning === "multiple" ? "multiple" : "single");
  const [startDate, setStartDate] = useState(initial.startDate ?? "");
  const [endDate, setEndDate] = useState(initial.endDate ?? "");
  const [startTime, setStartTime] = useState(initial.startTime ?? "09:00");
  const [endTime, setEndTime] = useState(initial.endTime ?? "12:00");
  const [timezone, setTimezone] = useState(initial.timezone ?? TIMEZONES[0].id);
  const [extras, setExtras] = useState<Extra[]>(initial.extras ?? []);
  const [month, setMonth] = useState((initial.startDate || today).slice(0, 7));
  const [mode, setMode] = useState(initial.deliveryMode ?? "online");
  const [platform, setPlatform] = useState(initial.platform ?? "teams");
  const [url, setUrl] = useState(initial.meetingUrl ?? "");
  const [location, setLocation] = useState(initial.location ?? "");
  const [welcome, setWelcome] = useState(initial.welcomeMessage ?? "");
  const [invite, setInvite] = useState(initial.sendInvitation !== "0");
  const [calendar, setCalendar] = useState(initial.addToCalendar === "1");
  const [copied, setCopied] = useState(false);

  const busy = new Set(busyDates);
  const days = monthGrid(month, [], nowMs);
  const minutes = minutesBetween(`${startDate}T${startTime}`, `${endDate}T${endTime}`);

  function pickDay(date: string) {
    setStartDate(date);
    if (planning === "single" || !endDate || endDate < date) setEndDate(date);
  }
  const setExtra = (i: number, patch: Partial<Extra>) => setExtras(extras.map((x, j) => (j === i ? { ...x, ...patch } : x)));

  async function copy() {
    try { await navigator.clipboard.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch { /* presse-papiers indisponible */ }
  }

  const where = mode === "online" ? `En ligne (${MEETING_PLATFORMS[platform as keyof typeof MEETING_PLATFORMS] ?? "visioconférence"})`
    : mode === "onsite" ? `Présentiel${location ? ` — ${location}` : ""}` : `Hybride${location ? ` — ${location}` : ""}`;

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
      <div className="space-y-6">
        <Card icon={CalendarClock} title="Date et heure" hint="Définissez les dates et horaires de votre session.">
          <div>
            <p className="mb-2 text-sm font-semibold text-brand-dark">Type de planification *</p>
            <div className="grid grid-cols-2 gap-3" role="radiogroup" aria-label="Type de planification">
              {PLANNING.map((p) => (
                <label key={p.value}>
                  <input type="radio" name="planning" value={p.value} checked={planning === p.value} onChange={() => setPlanning(p.value)} className="sr-only" />
                  <Choice on={planning === p.value}><p.icon className="h-6 w-6 text-brand" aria-hidden /><span className="font-semibold text-brand-dark">{p.label}</span><span className="text-xs text-muted">{p.hint}</span></Choice>
                </label>
              ))}
            </div>
          </div>

          <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <IconField icon={CalendarDays} label="Date de début *" error={errs.startDate?.[0]}>
                  <input type="date" name="startDate" value={startDate} onChange={(e) => { setStartDate(e.target.value); if (planning === "single" || !endDate || endDate < e.target.value) setEndDate(e.target.value); }} className={inputCls} />
                </IconField>
                <IconField icon={CalendarDays} label="Date de fin *" error={errs.endDate?.[0]}>
                  <input type="date" name="endDate" value={endDate} min={startDate} onChange={(e) => setEndDate(e.target.value)} className={inputCls} />
                </IconField>
                <IconField icon={Clock} label="Heure de début *" error={errs.startTime?.[0]}>
                  <input type="time" name="startTime" value={startTime} onChange={(e) => setStartTime(e.target.value)} className={inputCls} />
                </IconField>
                <IconField icon={Clock} label="Heure de fin *" error={errs.endTime?.[0]}>
                  <input type="time" name="endTime" value={endTime} onChange={(e) => setEndTime(e.target.value)} className={inputCls} />
                </IconField>
              </div>
              <div className="grid grid-cols-[minmax(0,1fr)_7rem] items-end gap-3">
                <SelectField label="Fuseau horaire *" name="timezone" value={timezone} onChange={(e) => setTimezone(e.target.value)} errors={errs.timezone}>
                  {TIMEZONES.map((z) => <option key={z.id} value={z.id}>{z.label}</option>)}
                </SelectField>
                <div>
                  <p className="mb-1 text-sm font-semibold text-brand-dark">Durée</p>
                  <p className="rounded-lg bg-brand-soft px-3 py-2 text-sm text-brand-dark" aria-live="polite">{spanLabel(minutes)}</p>
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-line p-3" aria-label="Calendrier">
              <div className="mb-2 flex items-center justify-between">
                <button type="button" aria-label="Mois précédent" onClick={() => setMonth(shiftMonth(month, -1))} className="rounded-lg p-1.5 text-brand-dark hover:bg-brand-soft"><ChevronLeft className="h-4 w-4" aria-hidden /></button>
                <p className="text-sm font-semibold text-brand-dark">{MONTH_LABEL(month)}</p>
                <button type="button" aria-label="Mois suivant" onClick={() => setMonth(shiftMonth(month, 1))} className="rounded-lg p-1.5 text-brand-dark hover:bg-brand-soft"><ChevronRight className="h-4 w-4" aria-hidden /></button>
              </div>
              <div className="grid grid-cols-7 gap-y-0.5 text-center text-sm">
                {["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"].map((d) => <span key={d} className="py-1 text-xs text-muted">{d}</span>)}
                {days.map((d) => {
                  const selected = d.date === startDate;
                  return (
                    <button key={d.date} type="button" onClick={() => pickDay(d.date)} aria-pressed={selected} aria-label={longDate(d.date)}
                      className="flex flex-col items-center py-0.5">
                      <span className={cn("flex h-8 w-8 items-center justify-center rounded-full",
                        selected ? "bg-brand font-bold text-white" : d.inMonth ? "text-brand-dark hover:bg-brand-soft" : "text-muted/50 hover:bg-brand-soft")}>{d.day}</span>
                      <span className={cn("mt-0.5 h-1.5 w-1.5 rounded-full", d.today ? "bg-warning" : busy.has(d.date) ? "bg-muted/60" : "")} aria-hidden />
                    </button>
                  );
                })}
              </div>
              <ul className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted" aria-label="Légende">
                <li className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-brand" aria-hidden />Date sélectionnée</li>
                <li className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-muted/60" aria-hidden />Autres sessions</li>
                <li className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-warning" aria-hidden />Aujourd’hui</li>
              </ul>
            </div>
          </div>

          {planning === "multiple" && (
            <div className="space-y-3 rounded-xl border border-line p-4">
              <p className="text-sm font-semibold text-brand-dark">Séances supplémentaires</p>
              <p className="text-xs text-muted">Chaque séance crée une session distincte avec les mêmes informations. La séance ci-dessus est la première.</p>
              {extras.map((x, i) => (
                <div key={i} className="grid grid-cols-[minmax(0,1fr)_7rem_7rem_auto] items-end gap-2">
                  <input type="hidden" name="extraDate" value={x.date} /><input type="hidden" name="extraStart" value={x.start} /><input type="hidden" name="extraEnd" value={x.end} />
                  <div><label className="mb-1 block text-xs text-muted">Séance {i + 2} · date</label><input type="date" value={x.date} onChange={(e) => setExtra(i, { date: e.target.value })} className="w-full rounded-lg border border-line px-3 py-2 text-sm" /></div>
                  <div><label className="mb-1 block text-xs text-muted">Début</label><input type="time" value={x.start} onChange={(e) => setExtra(i, { start: e.target.value })} className="w-full rounded-lg border border-line px-2 py-2 text-sm" /></div>
                  <div><label className="mb-1 block text-xs text-muted">Fin</label><input type="time" value={x.end} onChange={(e) => setExtra(i, { end: e.target.value })} className="w-full rounded-lg border border-line px-2 py-2 text-sm" /></div>
                  <button type="button" aria-label={`Retirer la séance ${i + 2}`} onClick={() => setExtras(extras.filter((_, j) => j !== i))} className="rounded-lg p-2.5 text-danger hover:bg-danger/10"><Trash2 className="h-4 w-4" aria-hidden /></button>
                </div>
              ))}
              {errs.extras && <p role="alert" className="text-xs text-danger">{errs.extras[0]}</p>}
              {extras.length < MAX_EXTRAS && (
                <button type="button" onClick={() => setExtras([...extras, { date: "", start: startTime, end: endTime }])}
                  className="inline-flex items-center gap-2 rounded-lg border border-brand bg-white px-3 py-1.5 text-sm font-semibold text-brand hover:bg-brand-soft"><Plus className="h-4 w-4" aria-hidden /> Ajouter une séance</button>
              )}
            </div>
          )}
        </Card>

        <Card icon={MapPin} title="Modalité et lieu" hint="Choisissez le mode de réalisation et renseignez les informations de lieu.">
          <div>
            <p className="mb-2 text-sm font-semibold text-brand-dark">Mode de livraison *</p>
            <div className="grid gap-3 sm:grid-cols-3" role="radiogroup" aria-label="Mode de livraison">
              {MODES.map((m) => (
                <label key={m.value}>
                  <input type="radio" name="deliveryMode" value={m.value} checked={mode === m.value} onChange={() => setMode(m.value)} className="sr-only" />
                  <Choice on={mode === m.value}><m.icon className="h-6 w-6 text-brand" aria-hidden /><span className="font-semibold text-brand-dark">{m.label}</span><span className="text-xs text-muted">{m.hint}</span></Choice>
                </label>
              ))}
            </div>
            {errs.deliveryMode && <p role="alert" className="mt-1 text-xs text-danger">{errs.deliveryMode[0]}</p>}
          </div>

          {mode !== "online" && (
            <Field label="Lieu *" name="location" value={location} onChange={(e) => setLocation(e.target.value)} maxLength={300} errors={errs.location} />
          )}
          {mode !== "onsite" && (
            <>
              <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)]">
                <SelectField label="Plateforme de visioconférence *" name="platform" value={platform} onChange={(e) => setPlatform(e.target.value)} errors={errs.platform}>
                  {Object.entries(MEETING_PLATFORMS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
                </SelectField>
                <div>
                  <label htmlFor="f-meetingUrl" className="mb-1 block text-sm font-semibold text-brand-dark">Lien de la session *</label>
                  <div className="flex overflow-hidden rounded-lg border border-line">
                    <input id="f-meetingUrl" name="meetingUrl" type="url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://…" className="min-w-0 flex-1 px-3 py-2 text-sm outline-none" aria-invalid={!!errs.meetingUrl} />
                    <button type="button" onClick={copy} aria-label="Copier le lien" className="border-l border-line px-3 text-brand hover:bg-brand-soft">{copied ? <Check className="h-4 w-4" aria-hidden /> : <Copy className="h-4 w-4" aria-hidden />}</button>
                  </div>
                  {errs.meetingUrl && <p role="alert" className="mt-1 text-xs text-danger">{errs.meetingUrl[0]}</p>}
                </div>
              </div>
              <p className="flex items-center gap-2 rounded-lg bg-brand-soft p-3 text-xs text-brand-dark"><Info className="h-4 w-4 shrink-0 text-brand" aria-hidden /> Le lien de la session sera communiqué aux apprenants inscrits (visible aussi de vous et de l’équipe SECURIPASS).</p>
            </>
          )}
        </Card>
      </div>

      <div className="space-y-6">
        <section className="rounded-2xl border border-line bg-white p-5 shadow-card">
          <h3 className="mb-3 flex items-center gap-3 text-base font-bold text-brand-dark">
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-soft text-brand"><Eye className="h-5 w-5" aria-hidden /></span>Aperçu de la session
          </h3>
          {course ? (
            <>
              <div className="relative h-40 overflow-hidden rounded-xl bg-brand-dark">
                {course.cover
                  ? <Image src={course.cover} alt="" fill sizes="22rem" className="object-cover" unoptimized={course.cover.startsWith("http")} />
                  : <div className="flex h-full items-center justify-center"><CalendarDays className="h-10 w-10 text-white/80" aria-hidden /></div>}
              </div>
              <h4 className="mt-3 text-lg font-extrabold leading-snug text-brand-dark">{course.title}</h4>
            </>
          ) : null}
          <ul className="mt-3 space-y-2 text-sm text-brand-dark">
            <li className="flex items-center gap-3"><CalendarDays className="h-4 w-4 shrink-0 text-brand" aria-hidden />{startDate ? `Session du ${longDate(startDate)}` : "Date à définir"}{planning === "multiple" && extras.length > 0 ? ` (+ ${extras.length} séance${extras.length > 1 ? "s" : ""})` : ""}</li>
            <li className="flex items-center gap-3"><Clock className="h-4 w-4 shrink-0 text-brand" aria-hidden />{hhmm(startTime)} - {hhmm(endTime)}{minutes > 0 ? ` (${spanLabel(minutes)})` : ""}</li>
            <li className="flex items-center gap-3"><Globe className="h-4 w-4 shrink-0 text-brand" aria-hidden />{where}</li>
          </ul>
        </section>

        <Card icon={FileText} title="Informations complémentaires">
          <div>
            <label htmlFor="f-welcome" className="mb-1 block text-sm font-semibold text-brand-dark">Message aux apprenants (optionnel)</label>
            <textarea id="f-welcome" name="welcomeMessage" rows={3} maxLength={500} value={welcome} onChange={(e) => setWelcome(e.target.value)}
              className="w-full resize-y rounded-lg border border-line px-3 py-2 text-sm" aria-invalid={!!errs.welcomeMessage} />
            <p className="text-right text-xs text-muted">{welcome.length}/500</p>
            {errs.welcomeMessage && <p role="alert" className="text-xs text-danger">{errs.welcomeMessage[0]}</p>}
          </div>
          <div className="flex items-start gap-3">
            <Switch name="sendInvitation" label="Envoyer une invitation automatique aux apprenants" on={invite} onChange={setInvite} labelClassName="sr-only" />
            <span className="text-sm text-brand-dark">Envoyer une invitation automatique aux apprenants<span className="block text-xs text-muted">Option enregistrée avec la session ; l’envoi par e-mail n’est pas encore actif.</span></span>
          </div>
          <div className="flex items-start gap-3">
            <Switch name="addToCalendar" label="Ajouter cette session au calendrier des apprenants" on={calendar} onChange={setCalendar} labelClassName="sr-only" />
            <span className="text-sm text-brand-dark">Ajouter cette session au calendrier des apprenants<span className="block text-xs text-muted">Option enregistrée avec la session ; l’ajout à l’agenda n’est pas encore actif.</span></span>
          </div>
        </Card>
      </div>
    </div>
  );
}
