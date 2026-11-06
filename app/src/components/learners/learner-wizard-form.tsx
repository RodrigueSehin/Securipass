"use client";

import { useActionState, useRef, useState } from "react";
import Image from "next/image";
import {
  Briefcase, Building2, Calendar, CalendarDays, Check, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Clock, Info, Mail, MapPin, Phone, Search, StickyNote,
  Upload, UserRound, Users, X,
} from "lucide-react";
import { IconField } from "@/components/auth/icon-field";
import { Avatar } from "@/components/ui/avatar";
import { Alert } from "@/components/ui/feedback";
import { Switch } from "@/components/ui/switch";
import type { FormState } from "@/lib/auth/actions";
import { createClient } from "@/lib/supabase/browser";
import { formatShortDate, formatTimeRange } from "@/lib/format";
import { saveLearnerStep } from "@/lib/learners/wizard-actions";
import { AVAILABILITY_LABEL, fullName, GENDERS, PHONE_CODES, splitPhone, type LearnerDraft, type SessionAvailability } from "@/lib/learners/wizard";
import { cn } from "@/lib/utils";

export const LEARNER_FORM_ID = "learner-step-form";

export type PickSession = {
  id: string; title: string; course: string; cover: string | null; start_at: string; end_at: string; timezone: string;
  mode: "online" | "onsite" | "hybrid"; platform: string | null; location: string | null; taken: number; capacity: number; availability: SessionAvailability;
};

const PLATFORM = { teams: "Microsoft Teams", zoom: "Zoom", meet: "Google Meet", other: "Visioconférence" } as const;

/** Libellé court du lieu : « En ligne (Microsoft Teams) », « Abidjan (Salle de formation) ». */
function whereOf(s: PickSession) {
  const online = `En ligne${s.platform ? ` (${PLATFORM[s.platform as keyof typeof PLATFORM] ?? "visioconférence"})` : ""}`;
  if (s.mode === "online") return [online, ""] as const;
  if (s.mode === "onsite") return [s.location ?? "Présentiel", "Présentiel"] as const;
  return [s.location ?? "Hybride", online] as const;
}

const input = "w-full rounded-lg border border-line bg-white px-3 py-3 text-sm text-brand-dark outline-none focus:border-brand focus:ring-2 focus:ring-brand/20";
const label = "mb-1.5 block text-sm font-semibold text-brand-dark";

function Photo({ initialPath, initialUrl, error }: { initialPath: string; initialUrl: string | null; error?: string }) {
  const [path, setPath] = useState(initialPath);
  const [url, setUrl] = useState(initialUrl);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const ref = useRef<HTMLInputElement>(null);

  async function pick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!["image/jpeg", "image/png"].includes(file.type)) return setMsg("Format JPG ou PNG uniquement.");
    if (file.size > 2 * 1024 * 1024) return setMsg("Photo trop volumineuse (2 Mo maximum).");
    setBusy(true); setMsg(null);
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("auth");
      const p = `${user.id}/learner-${crypto.randomUUID()}.${file.type === "image/png" ? "png" : "jpg"}`;
      const { error: upErr } = await supabase.storage.from("profile-photos").upload(p, file, { contentType: file.type, upsert: false });
      if (upErr) throw upErr;
      const signed = await supabase.storage.from("profile-photos").createSignedUrl(p, 3600);
      setPath(p); setUrl(signed.data?.signedUrl ?? null);
    } catch {
      setMsg("Impossible d’envoyer la photo. Réessayez.");
    } finally {
      setBusy(false);
      if (ref.current) ref.current.value = "";
    }
  }

  return (
    <div className="rounded-xl border border-line p-4 text-center">
      <p className="mb-3 text-left text-sm font-semibold text-brand-dark">Photo de profil (optionnelle)</p>
      <input type="hidden" name="photoPath" value={path} />
      <div className="mx-auto flex h-28 w-28 items-center justify-center overflow-hidden rounded-full bg-brand-soft text-brand">
        {url ? <Image src={url} alt="" width={112} height={112} className="h-full w-full object-cover" unoptimized /> : <UserRound className="h-12 w-12" aria-hidden />}
      </div>
      <input ref={ref} type="file" accept="image/jpeg,image/png" onChange={pick} className="sr-only" id="learner-photo" />
      <label htmlFor="learner-photo" className="mt-3 inline-flex cursor-pointer items-center gap-2 rounded-lg bg-brand-soft px-4 py-2 text-sm font-semibold text-brand hover:bg-brand-soft/70">
        <Upload className="h-4 w-4" aria-hidden /> {busy ? "Envoi…" : url ? "Changer la photo" : "Ajouter une photo"}
      </label>
      <p className="mt-2 text-xs text-muted">JPG, PNG (Max. 2 Mo)</p>
      {(msg || error) && <p role="alert" className="mt-1 text-xs text-danger">{msg ?? error}</p>}
    </div>
  );
}

/** Aperçu de l'apprenant : photo, coordonnées, entreprise, poste et localisation. */
function LearnerPreview({ d, photoUrl }: { d: Pick<LearnerDraft, "firstName" | "lastName" | "email" | "phone" | "company" | "jobTitle" | "address">; photoUrl: string | null }) {
  const name = fullName(d);
  const rows = [
    { icon: Building2, label: "Entreprise", value: d.company },
    { icon: Briefcase, label: "Poste", value: d.jobTitle },
    { icon: MapPin, label: "Localisation", value: d.address },
  ].filter((r) => r.value);
  return (
    <section className="rounded-2xl border border-line bg-white p-5 shadow-card">
      <h3 className="mb-4 flex items-center gap-3 text-base font-bold text-brand-dark"><span className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-soft text-brand"><Users className="h-5 w-5" aria-hidden /></span>Aperçu de l’apprenant</h3>
      <div className="flex items-center gap-4">
        <Avatar name={name || "?"} src={photoUrl} size={72} />
        <div className="min-w-0">
          <p className="text-lg font-extrabold text-brand-dark">{name || "Nouvel apprenant"}</p>
          {d.email && <p className="flex items-center gap-2 truncate text-sm text-muted"><Mail className="h-4 w-4 shrink-0 text-brand" aria-hidden />{d.email}</p>}
          {d.phone && <p className="flex items-center gap-2 text-sm text-muted"><Phone className="h-4 w-4 shrink-0 text-brand" aria-hidden />{d.phone}</p>}
        </div>
      </div>
      {rows.length > 0 && (
        <dl className="mt-4 space-y-3">
          {rows.map((r) => (
            <div key={r.label} className="flex items-center gap-3">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-brand-soft text-brand"><r.icon className="h-5 w-5" aria-hidden /></span>
              <div><dt className="text-sm font-semibold text-brand-dark">{r.label}</dt><dd className="text-sm text-brand-dark/80">{r.value}</dd></div>
            </div>
          ))}
        </dl>
      )}
    </section>
  );
}

const InfoBox = ({ children }: { children: React.ReactNode }) => (
  <div className="flex gap-3 rounded-2xl bg-brand-soft p-4 text-sm text-brand-dark">
    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand text-white"><Info className="h-5 w-5" aria-hidden /></span>
    <div>{children}</div>
  </div>
);

function SessionsPicker({ sessions, selected, onChange, error }: { sessions: PickSession[]; selected: string[]; onChange: (ids: string[]) => void; error?: string }) {
  const [q, setQ] = useState("");
  const [course, setCourse] = useState("");
  const [when, setWhen] = useState("avenir");
  const [mode, setMode] = useState("");
  const [page, setPage] = useState(1);
  const [size, setSize] = useState(10);
  const [now] = useState(() => Date.now());
  const fold = (v: string) => v.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
  const courses = [...new Set(sessions.map((s) => s.course))];

  const rows = sessions.filter((s) =>
    (!course || s.course === course) && (!mode || s.mode === mode)
    && (when === "avenir" ? Date.parse(s.start_at) > now : Date.parse(s.start_at) <= now)
    && (!q || fold(`${s.course} ${s.title}`).includes(fold(q))));
  const pages = Math.max(1, Math.ceil(rows.length / size));
  const cur = Math.min(page, pages);
  const shown = rows.slice((cur - 1) * size, cur * size);
  const toggle = (id: string) => onChange(selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id]);
  const allShown = shown.length > 0 && shown.every((s) => selected.includes(s.id));
  const sel = "rounded-lg border border-line bg-white px-3 py-2 text-sm text-brand-dark";

  return (
    <section className="rounded-2xl border border-line bg-white p-6 shadow-card">
      <div className="mb-4 flex items-start gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-brand-soft text-brand"><CalendarDays className="h-5 w-5" aria-hidden /></span>
        <div><h3 className="text-lg font-bold text-brand-dark">Sélection des sessions</h3><p className="text-sm text-muted">Choisissez la ou les sessions auxquelles cet apprenant sera inscrit.</p></div>
      </div>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="relative min-w-48 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-brand" aria-hidden />
          <input value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} type="search" placeholder="Rechercher une formation ou une session…" aria-label="Rechercher" className="w-full rounded-lg border border-line py-2 pl-9 pr-3 text-sm" />
        </div>
        <select value={course} onChange={(e) => { setCourse(e.target.value); setPage(1); }} aria-label="Formation" className={`${sel} sm:w-44`}>
          <option value="">Toutes les formations</option>
          {courses.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <select value={when} onChange={(e) => { setWhen(e.target.value); setPage(1); }} aria-label="Période" className={`${sel} sm:w-40`}>
          <option value="avenir">Sessions à venir</option>
          <option value="cours">Sessions en cours</option>
        </select>
        <select value={mode} onChange={(e) => { setMode(e.target.value); setPage(1); }} aria-label="Format" className={`${sel} sm:w-36`}>
          <option value="">Tous les formats</option>
          <option value="online">En ligne</option>
          <option value="onsite">Présentiel</option>
          <option value="hybrid">Hybride</option>
        </select>
      </div>

      {sessions.length === 0 ? (
        <p className="rounded-lg bg-surface p-4 text-sm text-muted">Aucune session ouverte aux inscriptions. Planifiez d’abord une session.</p>
      ) : rows.length === 0 ? (
        <p className="rounded-lg bg-surface p-4 text-sm text-muted">Aucune session ne correspond à ces filtres.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[44rem] text-left text-sm">
            <thead className="bg-surface text-xs text-brand-dark">
              <tr>
                <th scope="col" className="w-10 px-3 py-3"><input type="checkbox" aria-label="Tout sélectionner" checked={allShown} onChange={() => onChange(allShown ? selected.filter((id) => !shown.some((s) => s.id === id)) : [...new Set([...selected, ...shown.map((s) => s.id)])])} className="h-4 w-4" /></th>
                {["Formation / Session", "Date", "Lieu / Mode", "Places", "Statut"].map((h) => <th key={h} scope="col" className="px-3 py-3 font-semibold">{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {shown.map((s) => {
                const [w1, w2] = whereOf(s);
                return (
                  <tr key={s.id} className={cn("border-t border-line", selected.includes(s.id) && "bg-brand-soft/40")}>
                    <td className="px-3 py-3"><input type="checkbox" checked={selected.includes(s.id)} onChange={() => toggle(s.id)} aria-label={`Sélectionner ${s.title}`} className="h-4 w-4" /></td>
                    <td className="px-3 py-3">
                      <div className="flex items-center gap-3">
                        <span className="relative h-11 w-14 shrink-0 overflow-hidden rounded-md bg-brand-dark">{s.cover && <Image src={s.cover} alt="" fill sizes="56px" className="object-cover" unoptimized={s.cover.startsWith("http")} />}</span>
                        <div><p className="font-bold text-brand-dark">{s.course}</p><p className="text-xs text-muted">{s.title}</p></div>
                      </div>
                    </td>
                    <td className="whitespace-nowrap px-3 py-3 text-xs text-brand-dark">
                      <span className="flex items-center gap-1.5"><Calendar className="h-3.5 w-3.5 text-brand" aria-hidden />{formatShortDate(s.start_at, s.timezone)}</span>
                      <span className="mt-1 flex items-center gap-1.5"><Clock className="h-3.5 w-3.5 text-brand" aria-hidden />{formatTimeRange(s.start_at, s.end_at, s.timezone)}</span>
                    </td>
                    <td className="px-3 py-3 text-xs text-brand-dark"><span className="flex items-start gap-1.5"><MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand" aria-hidden /><span>{w1}{w2 && <span className="block text-muted">{w2}</span>}</span></span></td>
                    <td className="whitespace-nowrap px-3 py-3 text-brand-dark">{s.taken} / {s.capacity}</td>
                    <td className="px-3 py-3"><span className={cn("rounded-md px-2.5 py-1 text-xs font-semibold", s.availability === "open" ? "bg-success/15 text-success" : "bg-warning/15 text-warning")}>{AVAILABILITY_LABEL[s.availability]}</span></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {error && <p role="alert" className="mt-2 text-sm text-danger">{error}</p>}

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm text-brand-dark">
        <p aria-live="polite">{selected.length} session{selected.length > 1 ? "s" : ""} sélectionnée{selected.length > 1 ? "s" : ""}</p>
        <nav aria-label="Pagination" className="flex items-center gap-1">
          {([[ChevronsLeft, 1, "Première page"], [ChevronLeft, cur - 1, "Page précédente"]] as const).map(([I, n, l]) => (
            <button key={l} type="button" aria-label={l} disabled={cur === 1} onClick={() => setPage(n)} className="rounded-lg border border-line p-2 enabled:hover:bg-brand-soft disabled:opacity-40"><I className="h-4 w-4" aria-hidden /></button>
          ))}
          {Array.from({ length: Math.min(pages, 5) }, (_, i) => Math.max(1, Math.min(cur - 2, pages - 4)) + i).filter((n) => n >= 1 && n <= pages).map((n) => (
            <button key={n} type="button" onClick={() => setPage(n)} aria-current={n === cur ? "page" : undefined}
              className={cn("min-w-9 rounded-lg border px-2.5 py-2 font-semibold", n === cur ? "border-brand bg-brand text-white" : "border-line hover:bg-brand-soft")}>{n}</button>
          ))}
          {([[ChevronRight, cur + 1, "Page suivante"], [ChevronsRight, pages, "Dernière page"]] as const).map(([I, n, l]) => (
            <button key={l} type="button" aria-label={l} disabled={cur === pages} onClick={() => setPage(n)} className="rounded-lg border border-line p-2 enabled:hover:bg-brand-soft disabled:opacity-40"><I className="h-4 w-4" aria-hidden /></button>
          ))}
        </nav>
        <label className="flex items-center gap-2">Éléments par page
          <select value={size} onChange={(e) => { setSize(Number(e.target.value)); setPage(1); }} className="rounded-lg border border-line bg-white px-2 py-1.5 text-sm">
            {[10, 20, 50].map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
        </label>
      </div>
    </section>
  );
}

/** Étapes 1 à 3 de l'assistant « Ajouter un apprenant ». */
export function LearnerWizardForm({ step, registrationId, initial, photoUrl, sessions }: {
  step: 1 | 2 | 3; registrationId?: string; initial: Partial<LearnerDraft>; photoUrl: string | null; sessions: PickSession[];
}) {
  const [state, action, pending] = useActionState<FormState, FormData>(saveLearnerStep, {});
  const errs = state.fieldErrors ?? {};
  const sv = state.values;
  const phone = splitPhone(initial.phone);
  const [f, setF] = useState({
    firstName: sv?.firstName ?? initial.firstName ?? "", lastName: sv?.lastName ?? initial.lastName ?? "", email: sv?.email ?? initial.email ?? "",
    phoneCode: sv?.phoneCode ?? phone.code, phoneNumber: sv?.phoneNumber ?? phone.number, birthDate: sv?.birthDate ?? initial.birthDate ?? "",
    gender: sv?.gender ?? initial.gender ?? "", company: sv?.company ?? initial.company ?? "", jobTitle: sv?.jobTitle ?? initial.jobTitle ?? "",
    address: sv?.address ?? initial.address ?? "", notes: sv?.notes ?? initial.notes ?? "",
  });
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setF((p) => ({ ...p, [k]: e.target.value }));
  const [picked, setPicked] = useState<string[]>(initial.sessionIds ?? []);
  const [notify, setNotify] = useState(initial.notify ?? true);
  const draftPreview = { firstName: f.firstName, lastName: f.lastName, email: f.email, phone: f.phoneNumber ? `${f.phoneCode} ${f.phoneNumber}` : "", company: f.company, jobTitle: f.jobTitle, address: f.address };
  const chosen = picked.map((id) => sessions.find((s) => s.id === id)).filter((s): s is PickSession => !!s);

  return (
    <form id={LEARNER_FORM_ID} action={action} noValidate className="space-y-6">
      <input type="hidden" name="step" value={step} />
      {registrationId && <input type="hidden" name="registrationId" value={registrationId} />}
      {state.error && <Alert>{state.error}</Alert>}
      {pending && <span className="sr-only" role="status">Enregistrement…</span>}

      {step === 1 && (
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.9fr)_minmax(0,1fr)]">
          <section className="rounded-2xl border border-line bg-white p-6 shadow-card">
            <div className="mb-4 flex items-start gap-3">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-brand-soft text-brand"><Users className="h-5 w-5" aria-hidden /></span>
              <div><h3 className="text-lg font-bold text-brand-dark">Informations de l’apprenant</h3><p className="text-sm text-muted">Renseignez les informations personnelles de l’apprenant.</p></div>
            </div>
            <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_14rem]">
              <IconField label="Prénom" name="firstName" icon={UserRound} required value={f.firstName} onChange={set("firstName")} error={errs.firstName?.[0]} />
              <IconField label="Nom" name="lastName" icon={UserRound} required value={f.lastName} onChange={set("lastName")} error={errs.lastName?.[0]} />
              <div className="row-span-3 lg:col-start-3 lg:row-start-1"><Photo initialPath={initial.photoPath ?? ""} initialUrl={photoUrl} error={errs.photoPath?.[0]} /></div>
              <IconField label="Email" name="email" icon={Mail} required type="email" autoComplete="off" value={f.email} onChange={set("email")} error={errs.email?.[0]} />
              <div>
                <label htmlFor="learner-phone" className={label}>Téléphone<span className="text-danger" aria-hidden> *</span></label>
                <div className={cn("flex overflow-hidden rounded-lg border bg-white", errs.phoneNumber ? "border-danger" : "border-line")}>
                  <select name="phoneCode" value={f.phoneCode} onChange={set("phoneCode")} aria-label="Indicatif" className="border-r border-line bg-surface px-2 text-sm">
                    {PHONE_CODES.map(([c, n]) => <option key={c} value={c}>{c} {n}</option>)}
                  </select>
                  <input id="learner-phone" name="phoneNumber" type="tel" value={f.phoneNumber} onChange={set("phoneNumber")} placeholder="07 01 02 03 04" aria-invalid={!!errs.phoneNumber} className="min-w-0 flex-1 px-3 py-3 text-sm outline-none" />
                </div>
                {errs.phoneNumber && <p role="alert" className="mt-1 text-xs text-danger">{errs.phoneNumber[0]}</p>}
              </div>
              <IconField label="Date de naissance" name="birthDate" icon={Calendar} type="date" value={f.birthDate} onChange={set("birthDate")} error={errs.birthDate?.[0]} />
              <div>
                <label htmlFor="learner-gender" className={label}>Genre</label>
                <select id="learner-gender" name="gender" value={f.gender} onChange={set("gender")} className={input}>
                  <option value="">Non renseigné</option>
                  {Object.entries(GENDERS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
                </select>
              </div>
            </div>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <IconField label="Entreprise / Organisation" name="company" icon={Building2} value={f.company} onChange={set("company")} error={errs.company?.[0]} />
              <IconField label="Poste / Fonction" name="jobTitle" icon={Briefcase} value={f.jobTitle} onChange={set("jobTitle")} error={errs.jobTitle?.[0]} />
            </div>
            <IconField className="mt-4" label="Adresse" name="address" icon={MapPin} value={f.address} onChange={set("address")} error={errs.address?.[0]} />
            <div className="mt-4">
              <label htmlFor="learner-notes" className={label}>Notes (optionnelles)</label>
              <div className="relative">
                <StickyNote className="pointer-events-none absolute left-3.5 top-3.5 h-4 w-4 text-muted" aria-hidden />
                <textarea id="learner-notes" name="notes" rows={3} maxLength={500} value={f.notes} onChange={set("notes")} placeholder="Ajouter des informations complémentaires sur l’apprenant…" className={`${input} pl-10`} />
              </div>
              <p className="text-right text-xs text-muted">{f.notes.length}/500</p>
              {errs.notes && <p role="alert" className="text-xs text-danger">{errs.notes[0]}</p>}
            </div>
          </section>
          <aside className="space-y-6">
            <LearnerPreview d={draftPreview} photoUrl={photoUrl} />
            <InfoBox><p className="font-bold">Information</p><p className="mt-1">Après avoir enregistré l’apprenant, vous pourrez le notifier par e-mail et l’inscrire à une ou plusieurs sessions de formation.</p></InfoBox>
          </aside>
        </div>
      )}

      {step === 2 && (
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.9fr)_minmax(0,1fr)]">
          {picked.map((id) => <input key={id} type="hidden" name="sessionId" value={id} />)}
          <SessionsPicker sessions={sessions} selected={picked} onChange={setPicked} error={errs.sessionIds?.[0]} />
          <aside className="space-y-6">
            <LearnerPreview d={{ firstName: initial.firstName ?? "", lastName: initial.lastName ?? "", email: initial.email ?? "", phone: initial.phone ?? "", company: initial.company ?? null, jobTitle: initial.jobTitle ?? null, address: initial.address ?? null }} photoUrl={photoUrl} />
            <section className="rounded-2xl border border-line bg-white p-5 shadow-card">
              <h3 className="mb-3 flex items-center gap-3 text-base font-bold text-brand-dark"><span className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-soft text-brand"><CalendarDays className="h-5 w-5" aria-hidden /></span>Sessions sélectionnées ({chosen.length})</h3>
              {chosen.length === 0 ? <p className="text-sm text-muted">Aucune session sélectionnée.</p> : (
                <ul className="space-y-3">
                  {chosen.map((s) => (
                    <li key={s.id} className="flex items-start gap-3">
                      <span className="relative h-12 w-14 shrink-0 overflow-hidden rounded-md bg-brand-dark">{s.cover && <Image src={s.cover} alt="" fill sizes="56px" className="object-cover" unoptimized={s.cover.startsWith("http")} />}</span>
                      <div className="min-w-0 flex-1 text-xs text-muted">
                        <p className="text-sm font-bold text-brand-dark">{s.course}</p>
                        <p>{formatShortDate(s.start_at, s.timezone)} | {formatTimeRange(s.start_at, s.end_at, s.timezone)}</p>
                        <p>{whereOf(s)[0]}</p>
                      </div>
                      <button type="button" aria-label={`Retirer ${s.title}`} onClick={() => setPicked(picked.filter((x) => x !== s.id))} className="rounded p-1 text-brand-dark hover:text-danger"><X className="h-4 w-4" aria-hidden /></button>
                    </li>
                  ))}
                </ul>
              )}
              <div className="mt-4"><InfoBox><p>L’apprenant sera automatiquement inscrit aux sessions sélectionnées. Si une session est complète, il est placé en liste d’attente lorsqu’elle en propose une.</p></InfoBox></div>
            </section>
          </aside>
        </div>
      )}

      {step === 3 && (
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.9fr)_minmax(0,1fr)]">
          <section className="space-y-4 rounded-2xl border border-line bg-white p-6 shadow-card">
            <div className="flex items-start gap-3">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-brand-soft text-brand"><Check className="h-5 w-5" aria-hidden /></span>
              <div><h3 className="text-lg font-bold text-brand-dark">Options d’inscription</h3><p className="text-sm text-muted">Réglez la manière dont l’apprenant est informé de son inscription.</p></div>
            </div>
            <div className="flex items-start gap-3">
              <Switch name="notify" label="Notifier l’apprenant par e-mail" on={notify} onChange={setNotify} labelClassName="sr-only" />
              <span className="text-sm text-brand-dark">Notifier l’apprenant par e-mail<span className="block text-xs text-muted">Option enregistrée avec la fiche ; l’envoi par e-mail n’est pas encore actif.</span></span>
            </div>
          </section>
          <aside className="space-y-6">
            <LearnerPreview d={{ firstName: initial.firstName ?? "", lastName: initial.lastName ?? "", email: initial.email ?? "", phone: initial.phone ?? "", company: initial.company ?? null, jobTitle: initial.jobTitle ?? null, address: initial.address ?? null }} photoUrl={photoUrl} />
          </aside>
        </div>
      )}
    </form>
  );
}
