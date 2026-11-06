"use client";

import { useActionState, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { CalendarDays, CalendarPlus, Check, Clock, Globe, Hash, Info, MapPin, MonitorSmartphone, UserRound, Users, Video, type LucideIcon } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { Alert } from "@/components/ui/feedback";
import { FileUpload } from "@/components/ui/file-upload";
import { Switch } from "@/components/ui/switch";
import { DESCRIPTION_MAX, durationHours } from "@/lib/admin/sessions";
import { createAdminSession } from "@/lib/admin/sessions-actions";
import type { FormState } from "@/lib/auth/actions";
import { MODES, type Mode } from "@/lib/courses/labels";
import { formatDayRange } from "@/lib/admin/sessions";
import { localToUtc, TIMEZONES } from "@/lib/sessions/timezones";
import { cn } from "@/lib/utils";

export type CourseChoice = { id: string; title: string; cover: string | null };
export type TrainerChoice = { id: string; name: string; avatar: string | null };

const input = "w-full rounded-lg border border-line bg-white px-3 py-2.5 text-sm text-brand-dark outline-none focus:border-brand focus:ring-2 focus:ring-brand/20";
const lbl = "mb-1 block text-sm font-semibold text-brand-dark";
const MODE_ICON: Record<Mode, LucideIcon> = { onsite: MapPin, online: Video, hybrid: MonitorSmartphone };

function Section({ n, title, hint, children, className }: { n: number; title: string; hint: string; children: React.ReactNode; className?: string }) {
  return (
    <section className={cn("rounded-2xl border border-line bg-white p-5 shadow-card", className)}>
      <div className="mb-4 flex items-start gap-3">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand text-sm font-bold text-white" aria-hidden>{n}</span>
        <div><h2 className="text-base font-extrabold text-brand-dark">{title}</h2><p className="text-xs text-muted">{hint}</p></div>
      </div>
      {children}
    </section>
  );
}

const Err = ({ e }: { e?: string[] }) => (e?.[0] ? <p role="alert" className="mt-1 text-xs text-danger">{e[0]}</p> : null);
const Req = () => <span className="text-danger">*</span>;

function Option({ label, hint, name, on, setOn }: { label: string; hint: string; name: string; on: boolean; setOn: (v: boolean) => void }) {
  return (
    <div className="flex items-start gap-3">
      <Switch name={name} label={label} on={on} onChange={setOn} className="pt-0.5" />
      <div><p className="text-sm font-semibold text-brand-dark">{label}</p><p className="text-xs text-muted">{hint}</p></div>
    </div>
  );
}

/** Création d'une session par l'administration : formation, planification, formateurs, capacité et options, avec aperçu. */
export function CreateSessionForm({ courses, trainers, defaultCourse }: { courses: CourseChoice[]; trainers: TrainerChoice[]; defaultCourse: string }) {
  const [state, action, pending] = useActionState<FormState, FormData>(createAdminSession, {});
  const fe = state.fieldErrors ?? {};
  const sv = state.values ?? {};
  const [f, setF] = useState({
    courseId: sv.courseId ?? defaultCourse, code: sv.code ?? "", title: sv.title ?? "", description: sv.description ?? "",
    startDate: sv.startDate ?? "", startTime: sv.startTime ?? "08:00", endDate: sv.endDate ?? "", endTime: sv.endTime ?? "16:00",
    timezone: sv.timezone ?? "Africa/Abidjan", mode: (sv.mode ?? "onsite") as Mode, location: sv.location ?? "", meetingUrl: sv.meetingUrl ?? "",
    instructorId: sv.instructorId ?? "", capacity: sv.capacity ?? "", minCapacity: sv.minCapacity ?? "", deadlineDate: sv.deadlineDate ?? "", initial: sv.initial ?? "open",
  });
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setF((p) => ({ ...p, [k]: e.target.value }));
  const [extras, setExtras] = useState<string[]>([]);
  const [opts, setOpts] = useState({ waitlist: sv.waitlist !== "0", onlineRegistration: sv.onlineRegistration !== "0", manualValidation: sv.manualValidation === "1", companyReserved: sv.companyReserved === "1" });
  const [cover, setCover] = useState("");

  const course = courses.find((c) => c.id === f.courseId);
  const main = trainers.find((t) => t.id === f.instructorId);
  const startIso = f.startDate && f.startTime ? localToUtc(`${f.startDate}T${f.startTime}`, f.timezone) : null;
  const endIso = f.endDate && f.endTime ? localToUtc(`${f.endDate}T${f.endTime}`, f.timezone) : null;
  const hours = startIso && endIso && endIso > startIso ? durationHours(startIso, endIso) : null;
  const place = f.mode === "online" ? "En ligne" : f.location || "Lieu à définir";
  const previewImage = cover || course?.cover || null;
  const ModeIcon = MODE_ICON[f.mode];

  return (
    <form action={action} noValidate className="space-y-6">
      {state.error && <Alert>{state.error}</Alert>}
      {extras.map((id) => <input key={id} type="hidden" name="extraInstructor" value={id} />)}
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_21rem]">
        <div className="space-y-6 xl:col-span-2">
          <div className="grid gap-6 lg:grid-cols-2">
            <Section n={1} title="Informations de la formation" hint="Sélectionnez la formation et définissez les informations principales.">
              <div className="grid gap-4 md:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
                <div><label htmlFor="s-course" className={lbl}>Formation <Req /></label>
                  <select id="s-course" name="courseId" value={f.courseId} onChange={set("courseId")} className={input} aria-invalid={!!fe.courseId}>
                    <option value="">Choisir une formation…</option>
                    {courses.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
                  </select><Err e={fe.courseId} /></div>
                <div><label htmlFor="s-code" className={lbl}>Code de la session</label>
                  <div className="relative"><Hash className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden />
                    <input id="s-code" name="code" value={f.code} onChange={set("code")} maxLength={30} placeholder="Automatique" className={cn(input, "pl-9 uppercase")} aria-invalid={!!fe.code} /></div>
                  <Err e={fe.code} /></div>
              </div>
              <div className="mt-4"><label htmlFor="s-title" className={lbl}>Titre de la session <Req /></label><input id="s-title" name="title" value={f.title} onChange={set("title")} maxLength={200} className={input} aria-invalid={!!fe.title} /><Err e={fe.title} /></div>
              <div className="mt-4">
                <label htmlFor="s-desc" className={lbl}>Description <span className="font-normal text-muted">(optionnelle)</span></label>
                <textarea id="s-desc" name="description" rows={5} maxLength={DESCRIPTION_MAX} value={f.description} onChange={set("description")} className={input} />
                <p className="mt-1 text-right text-xs text-muted">{f.description.length}/{DESCRIPTION_MAX}</p><Err e={fe.description} />
              </div>
            </Section>

            <Section n={2} title="Planification" hint="Définissez les dates, horaires et lieu de la session.">
              <div className="grid grid-cols-2 gap-4">
                <div><label htmlFor="s-sd" className={lbl}>Date de début <Req /></label><input id="s-sd" name="startDate" type="date" value={f.startDate} onChange={set("startDate")} className={input} aria-invalid={!!fe.startDate} /><Err e={fe.startDate} /></div>
                <div><label htmlFor="s-ed" className={lbl}>Date de fin <Req /></label><input id="s-ed" name="endDate" type="date" min={f.startDate} value={f.endDate} onChange={set("endDate")} className={input} aria-invalid={!!fe.endDate} /><Err e={fe.endDate} /></div>
                <div><label htmlFor="s-st" className={lbl}>Heure de début <Req /></label><input id="s-st" name="startTime" type="time" value={f.startTime} onChange={set("startTime")} className={input} aria-invalid={!!fe.startTime} /><Err e={fe.startTime} /></div>
                <div><label htmlFor="s-et" className={lbl}>Heure de fin <Req /></label><input id="s-et" name="endTime" type="time" value={f.endTime} onChange={set("endTime")} className={input} aria-invalid={!!fe.endTime} /><Err e={fe.endTime} /></div>
                <div><label htmlFor="s-tz" className={lbl}>Fuseau horaire</label>
                  <select id="s-tz" name="timezone" value={f.timezone} onChange={set("timezone")} className={input}>{TIMEZONES.map((z) => <option key={z.id} value={z.id}>{z.label}</option>)}</select><Err e={fe.timezone} /></div>
                <div><p className={lbl}>Durée totale</p><p className="rounded-lg border border-line bg-surface px-3 py-2.5 text-sm text-muted">{hours === null ? "—" : `${String(hours).replace(".", ",")} heure${hours > 1 ? "s" : ""}`}</p></div>
              </div>
              <fieldset className="mt-4">
                <legend className={lbl}>Lieu / Mode <Req /></legend>
                <div className="grid grid-cols-3 overflow-hidden rounded-lg border border-line">
                  {(Object.keys(MODES) as Mode[]).map((m) => {
                    const I = MODE_ICON[m];
                    return (
                      <label key={m} className={cn("flex cursor-pointer items-center justify-center gap-2 px-2 py-2.5 text-sm font-semibold", f.mode === m ? "bg-brand-soft text-brand" : "text-brand-dark hover:bg-brand-soft/40")}>
                        <input type="radio" name="mode" value={m} checked={f.mode === m} onChange={set("mode")} className="sr-only" /><I className="h-4 w-4" aria-hidden />{MODES[m]}
                      </label>
                    );
                  })}
                </div>
                <Err e={fe.mode} />
              </fieldset>
              {f.mode !== "online" && (
                <div className="mt-4"><label htmlFor="s-loc" className={lbl}>Adresse <Req /></label>
                  <div className="relative"><MapPin className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden /><input id="s-loc" name="location" value={f.location} onChange={set("location")} maxLength={300} placeholder="Abidjan, Salle principale" className={cn(input, "pl-9")} aria-invalid={!!fe.location} /></div><Err e={fe.location} /></div>
              )}
              {f.mode !== "onsite" && (
                <div className="mt-4"><label htmlFor="s-url" className={lbl}>Lien de connexion <Req /></label>
                  <div className="relative"><Video className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden /><input id="s-url" name="meetingUrl" type="url" value={f.meetingUrl} onChange={set("meetingUrl")} placeholder="https://…" className={cn(input, "pl-9")} aria-invalid={!!fe.meetingUrl} /></div><Err e={fe.meetingUrl} /></div>
              )}
            </Section>
          </div>

          <Section n={3} title="Formateur(s)" hint="Sélectionnez le ou les formateurs qui animeront cette session.">
            <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
              <div><label htmlFor="s-main" className={lbl}>Formateur principal <Req /></label>
                <select id="s-main" name="instructorId" value={f.instructorId} onChange={(e) => { set("instructorId")(e); setExtras((x) => x.filter((i) => i !== e.target.value)); }} className={input} aria-invalid={!!fe.instructorId}>
                  <option value="">Choisir un formateur…</option>
                  {trainers.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select><Err e={fe.instructorId} /></div>
              <fieldset>
                <legend className={lbl}>Formateurs supplémentaires <span className="font-normal text-muted">(optionnel)</span></legend>
                <div className="flex flex-wrap gap-2">
                  {trainers.filter((t) => t.id !== f.instructorId).map((t) => {
                    const on = extras.includes(t.id);
                    return (
                      <label key={t.id} className={cn("flex cursor-pointer items-center gap-2 rounded-lg border py-1 pl-1 pr-3 text-xs font-semibold", on ? "border-brand bg-brand-soft text-brand" : "border-line text-brand-dark hover:bg-brand-soft/40")}>
                        <input type="checkbox" checked={on} onChange={() => setExtras(on ? extras.filter((x) => x !== t.id) : [...extras, t.id])} className="sr-only" />
                        <Avatar name={t.name} src={t.avatar} size={24} />{t.name}{on && <Check className="h-3 w-3" aria-hidden />}
                      </label>
                    );
                  })}
                  {trainers.length === 0 && <p className="text-sm text-muted">Aucun formateur actif.</p>}
                </div>
                <Err e={fe.extraInstructors} />
              </fieldset>
            </div>
          </Section>

          <Section n={4} title="Capacités et inscriptions" hint="Définissez le nombre de places et les paramètres d’inscription.">
            <div className="grid gap-4 md:grid-cols-4">
              <div><label htmlFor="s-cap" className={lbl}>Nombre de places <Req /></label><input id="s-cap" name="capacity" type="number" min={1} max={10000} inputMode="numeric" value={f.capacity} onChange={set("capacity")} className={input} aria-invalid={!!fe.capacity} /><Err e={fe.capacity} /></div>
              <div><label htmlFor="s-min" className={lbl}>Nombre minimum</label><input id="s-min" name="minCapacity" type="number" min={1} max={10000} inputMode="numeric" value={f.minCapacity} onChange={set("minCapacity")} className={input} aria-invalid={!!fe.minCapacity} /><Err e={fe.minCapacity} /></div>
              <div><label htmlFor="s-dl" className={lbl}>Date limite d’inscription</label><input id="s-dl" name="deadlineDate" type="date" max={f.startDate || undefined} value={f.deadlineDate} onChange={set("deadlineDate")} className={input} aria-invalid={!!fe.deadlineDate} /><Err e={fe.deadlineDate} /></div>
              <div><label htmlFor="s-init" className={lbl}>Statut initial <Req /></label>
                <div className="relative"><span className={cn("pointer-events-none absolute left-3 top-1/2 h-2.5 w-2.5 -translate-y-1/2 rounded-full", f.initial === "open" ? "bg-success" : "bg-muted")} aria-hidden />
                  <select id="s-init" name="initial" value={f.initial} onChange={set("initial")} className={cn(input, "pl-8")}><option value="open">Ouverte</option><option value="draft">Brouillon</option></select></div><Err e={fe.initial} /></div>
            </div>
            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <Option name="onlineRegistration" label="Autoriser les inscriptions en ligne" hint="Les apprenants peuvent s’inscrire depuis la plateforme." on={opts.onlineRegistration} setOn={(v) => setOpts((o) => ({ ...o, onlineRegistration: v }))} />
              <Option name="manualValidation" label="Appliquer une validation manuelle" hint="Les inscriptions doivent être validées par un administrateur." on={opts.manualValidation} setOn={(v) => setOpts((o) => ({ ...o, manualValidation: v }))} />
              <Option name="waitlist" label="Liste d’attente" hint="Permettre l’inscription en liste d’attente si complet." on={opts.waitlist} setOn={(v) => setOpts((o) => ({ ...o, waitlist: v }))} />
              <Option name="companyReserved" label="Réserver des places pour les entreprises" hint="Permettre aux entreprises de réserver des places." on={opts.companyReserved} setOn={(v) => setOpts((o) => ({ ...o, companyReserved: v }))} />
            </div>
          </Section>
        </div>

        <aside className="space-y-5 xl:sticky xl:top-4 xl:self-start">
          <section className="overflow-hidden rounded-2xl border border-line bg-white shadow-card">
            <h2 className="px-5 pt-5 text-lg font-extrabold text-brand-dark">Aperçu de la session</h2>
            <div className="relative mx-5 mt-3 aspect-[16/9] overflow-hidden rounded-xl bg-brand-dark">
              {previewImage ? <Image src={previewImage} alt="" fill sizes="320px" className="object-cover" unoptimized /> : <span className="flex h-full items-center justify-center"><CalendarDays className="h-10 w-10 text-white/70" aria-hidden /></span>}
            </div>
            <div className="p-5">
              <p className="text-lg font-extrabold text-brand-dark">{f.title || "Nouvelle session"}</p>
              <p className="text-sm text-brand">{course?.title ?? "Formation à choisir"}</p>
              <ul className="mt-3 space-y-2 text-sm text-brand-dark">
                <li className="flex items-center gap-2"><CalendarDays className="h-4 w-4 text-muted" aria-hidden />{startIso && endIso && endIso > startIso ? formatDayRange(startIso, endIso, f.timezone) : "Dates à définir"}</li>
                <li className="flex items-center gap-2"><Clock className="h-4 w-4 text-muted" aria-hidden />{f.startTime} – {f.endTime}{hours !== null && ` (${String(hours).replace(".", ",")} h)`}</li>
                <li className="flex flex-wrap items-center gap-2"><MapPin className="h-4 w-4 text-muted" aria-hidden />{place}<span className="inline-flex items-center gap-1 rounded-md bg-success/15 px-2 py-0.5 text-xs font-semibold text-success"><ModeIcon className="h-3 w-3" aria-hidden />{MODES[f.mode]}</span></li>
                <li className="flex items-center gap-2"><Users className="h-4 w-4 text-muted" aria-hidden />{f.capacity ? `${f.capacity} apprenants (max)` : "Places à définir"}</li>
                <li className="flex items-center gap-2"><UserRound className="h-4 w-4 text-muted" aria-hidden />{main ? <><Avatar name={main.name} src={main.avatar} size={22} />{main.name}</> : "Formateur à choisir"}</li>
                <li className="flex items-center gap-2"><Globe className="h-4 w-4 text-muted" aria-hidden />{f.code ? f.code.toUpperCase() : "Code automatique"}</li>
              </ul>
              {f.description && <p className="mt-3 text-sm text-brand-dark/80">{f.description}</p>}
            </div>
          </section>

          <section className="rounded-2xl border border-line bg-white p-5 shadow-card">
            <h2 className="mb-1 flex items-center gap-3 text-base font-extrabold text-brand-dark"><span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand text-sm font-bold text-white" aria-hidden>5</span>Options et médias</h2>
            <p className="mb-3 text-xs text-muted">Paramètres supplémentaires pour la session.</p>
            <FileUpload name="coverUrl" label="Image de la session (optionnelle)" bucket="session-covers" accept={["image/jpeg", "image/png", "image/webp"]} maxMb={2} store="url" onValueChange={setCover} hint="PNG, JPG ou WebP (2 Mo max). Recommandé : 1200 × 630 px." />
            <Err e={fe.coverUrl} />
            <p className="mt-4 flex items-start gap-2 rounded-lg bg-brand-soft p-3 text-xs text-brand-dark"><Info className="mt-0.5 h-4 w-4 shrink-0 text-brand" aria-hidden />Un brouillon n’est visible que du formateur. La session ouverte est publiée dans le catalogue.</p>
          </section>

          <div className="flex gap-3">
            <Link href="/admin/sessions" className="inline-flex flex-1 items-center justify-center rounded-lg border border-brand bg-white px-5 py-3 text-sm font-semibold text-brand hover:bg-brand-soft">Annuler</Link>
            <button type="submit" disabled={pending} className="inline-flex flex-[1.6] items-center justify-center gap-2 rounded-lg bg-brand px-5 py-3 text-sm font-semibold text-white hover:bg-brand-dark disabled:opacity-60">
              <CalendarPlus className="h-4 w-4" aria-hidden /> {pending ? "Création…" : "Créer la session"}
            </button>
          </div>
        </aside>
      </div>
    </form>
  );
}

