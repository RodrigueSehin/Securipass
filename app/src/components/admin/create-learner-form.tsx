"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Briefcase, Check, Copy, Eye, EyeOff, FileText, GraduationCap, Info, Lock, MapPin, MessageSquare, RotateCcw, Save, User, type LucideIcon } from "lucide-react";
import { PhotoPicker } from "@/components/admin/create-user-form";
import { Alert } from "@/components/ui/feedback";
import { CIVILITIES, ID_TYPES, LEARNER_STATUS_CHOICES, NOTES_MAX } from "@/lib/admin/learners";
import { createLearner } from "@/lib/admin/learners-actions";
import { SITUATIONS } from "@/lib/auth/schemas";
import type { FormState } from "@/lib/auth/actions";
import { PHONE_CODES } from "@/lib/learners/wizard";
import { EDUCATION } from "@/lib/profile/schemas";
import { cn } from "@/lib/utils";

const input = "w-full rounded-lg border border-line bg-white px-3 py-2.5 text-sm text-brand-dark outline-none focus:border-brand focus:ring-2 focus:ring-brand/20";
const lbl = "mb-1 block text-sm font-semibold text-brand-dark";

export type CourseChoice = { id: string; title: string };
export type SessionChoice = { id: string; courseId: string; label: string };

function Section({ icon: Icon, title, optional, children, className }: { icon: LucideIcon; title: string; optional?: boolean; children: React.ReactNode; className?: string }) {
  return (
    <section className={cn("rounded-2xl border border-line bg-white p-5 shadow-card", className)}>
      <h2 className="mb-4 flex items-center gap-3 text-base font-extrabold text-brand-dark">
        <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-soft text-brand"><Icon className="h-5 w-5" aria-hidden /></span>
        <span>{title}{optional && <span className="ml-1 text-sm font-normal text-muted">(optionnel)</span>}</span>
      </h2>
      {children}
    </section>
  );
}
const Err = ({ e }: { e?: string[] }) => (e?.[0] ? <p role="alert" className="mt-1 text-xs text-danger">{e[0]}</p> : null);
const Req = () => <span className="text-danger">*</span>;

/** Création d'un apprenant : identité, coordonnées, compte, situation professionnelle, formations souhaitées et inscription, pièces d'identité et notes. */
export function CreateLearnerForm({ courses, sessions, organizations }: { courses: CourseChoice[]; sessions: SessionChoice[]; organizations: { id: string; name: string }[] }) {
  const [state, action, pending] = useActionState<FormState, FormData>(createLearner, {});
  const [formKey, setFormKey] = useState(0);
  if (state.message && state.values?.id) return <Created values={state.values} />;
  return <Inner key={formKey} state={state} action={action} pending={pending} reset={() => setFormKey((k) => k + 1)} courses={courses} sessions={sessions} organizations={organizations} />;
}

function Created({ values }: { values: Record<string, string> }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="max-w-xl space-y-4 rounded-2xl border border-line bg-white p-6 shadow-card">
      <Alert tone="success">Le compte de {values.name} ({values.email}) a été créé.</Alert>
      {values.warning && <Alert>{values.warning}</Alert>}
      {values.password ? (
        <div>
          <p className="text-sm font-semibold text-brand-dark">Mot de passe provisoire</p>
          <div className="mt-1 flex items-center gap-2">
            <code className="flex-1 rounded-lg bg-surface px-3 py-2 font-mono text-base text-brand-dark">{values.password}</code>
            <button type="button" onClick={async () => { try { await navigator.clipboard.writeText(values.password); setCopied(true); } catch { /* presse-papiers indisponible */ } }}
              className="inline-flex items-center gap-2 rounded-lg border border-brand px-3 py-2 text-sm font-semibold text-brand hover:bg-brand-soft">
              {copied ? <Check className="h-4 w-4" aria-hidden /> : <Copy className="h-4 w-4" aria-hidden />} {copied ? "Copié" : "Copier"}
            </button>
          </div>
          <p className="mt-2 text-xs text-muted">Ce mot de passe ne sera plus affiché. Transmettez-le par un canal sûr : aucun e-mail n’est envoyé.</p>
        </div>
      ) : <p className="text-sm text-muted">Le mot de passe est celui que vous avez défini. Transmettez-le par un canal sûr : aucun e-mail n’est envoyé.</p>}
      <div className="flex flex-wrap gap-3">
        <Link href={`/admin/utilisateurs/${values.id}`} className="rounded-lg bg-brand px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-dark">Voir le compte</Link>
        <Link href="/admin/apprenants/nouveau" className="rounded-lg border border-brand px-5 py-2.5 text-sm font-semibold text-brand hover:bg-brand-soft">Créer un autre apprenant</Link>
        <Link href="/admin/apprenants" className="rounded-lg border border-brand px-5 py-2.5 text-sm font-semibold text-brand hover:bg-brand-soft">Retour à la liste</Link>
      </div>
    </div>
  );
}

function Inner({ state, action, pending, reset, courses, sessions, organizations }: {
  state: FormState; action: (f: FormData) => void; pending: boolean; reset: () => void; courses: CourseChoice[]; sessions: SessionChoice[]; organizations: { id: string; name: string }[];
}) {
  const fe = state.fieldErrors ?? {};
  const sv = state.values ?? {};
  const [photo, setPhoto] = useState<{ path: string; url: string | null }>({ path: "", url: null });
  const [picked, setPicked] = useState<string[]>([]);
  const [showPwd, setShowPwd] = useState(false);
  const [notes, setNotes] = useState(sv.notes ?? "");
  const [enrollment, setEnrollment] = useState(sv.enrollment ?? "confirmed");
  const shownSessions = picked.length ? sessions.filter((s) => picked.includes(s.courseId)) : sessions;

  const text = (name: string, label: string, o: { required?: boolean; type?: string; max?: number; placeholder?: string } = {}) => (
    <div><label htmlFor={`l-${name}`} className={lbl}>{label} {o.required && <Req />}</label>
      <input id={`l-${name}`} name={name} type={o.type ?? "text"} maxLength={o.max} placeholder={o.placeholder} defaultValue={sv[name] ?? ""} className={input} aria-invalid={!!fe[name]} /><Err e={fe[name]} /></div>
  );
  const pick = (name: string, label: string, options: [string, string][], o: { required?: boolean; def?: string; blank?: string } = {}) => (
    <div><label htmlFor={`l-${name}`} className={lbl}>{label} {o.required && <Req />}</label>
      <select id={`l-${name}`} name={name} defaultValue={sv[name] ?? o.def ?? ""} className={input} aria-invalid={!!fe[name]}>
        {o.blank !== undefined && <option value="">{o.blank}</option>}
        {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </select><Err e={fe[name]} /></div>
  );

  return (
    <form action={action} noValidate className="space-y-6">
      {state.error && <Alert>{state.error}</Alert>}
      <input type="hidden" name="photoPath" value={photo.path} />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <Section icon={User} title="Informations personnelles">
          <div className="grid gap-4 md:grid-cols-3">
            {pick("civility", "Civilité", Object.entries(CIVILITIES), { required: true, blank: "Choisir…" })}
            {text("lastName", "Nom", { required: true, max: 80 })}
            {text("firstName", "Prénoms", { required: true, max: 80 })}
            {text("birthDate", "Date de naissance", { required: true, type: "date" })}
            {text("birthPlace", "Lieu de naissance", { max: 120 })}
            {pick("nationality", "Nationalité", PHONE_CODES.map(([, n]) => [n, n] as [string, string]), { required: true, def: "Côte d’Ivoire" })}
          </div>
        </Section>
        <Section icon={User} title="Photo de profil">
          <PhotoPicker url={photo.url} onChange={(path, url) => setPhoto({ path, url })} error={fe.photoPath?.[0]} />
        </Section>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <Section icon={MapPin} title="Coordonnées">
          <div className="grid gap-4 md:grid-cols-2">
            <div><label htmlFor="l-phone" className={lbl}>Téléphone <Req /></label>
              <div className="flex gap-2">
                <select name="phoneCode" defaultValue={sv.phoneCode ?? "+225"} aria-label="Indicatif" className={cn(input, "w-28 shrink-0")}>{PHONE_CODES.map(([c]) => <option key={c} value={c}>{c}</option>)}</select>
                <input id="l-phone" name="phoneNumber" inputMode="tel" defaultValue={sv.phoneNumber ?? ""} className={input} aria-invalid={!!fe.phoneNumber} /></div><Err e={fe.phoneNumber} /></div>
            {text("email", "E-mail", { required: true, type: "email", max: 254 })}
          </div>
          <div className="mt-4">{text("address", "Adresse", { max: 200, placeholder: "Cocody, Riviera Palmeraie, Abidjan" })}</div>
        </Section>

        <Section icon={Lock} title="Compte et accès">
          <div className="grid gap-4 md:grid-cols-2">
            <div><label className={lbl}>Rôle</label><input readOnly value="Apprenant" className={cn(input, "bg-surface")} /></div>
            <div><label htmlFor="l-password" className={lbl}>Mot de passe</label>
              <div className="relative">
                <input id="l-password" name="password" type={showPwd ? "text" : "password"} autoComplete="new-password" placeholder="Générer automatiquement" className={cn(input, "pr-10")} aria-invalid={!!fe.password} />
                <button type="button" onClick={() => setShowPwd((v) => !v)} aria-label={showPwd ? "Masquer le mot de passe" : "Afficher le mot de passe"} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-brand">
                  {showPwd ? <EyeOff className="h-4 w-4" aria-hidden /> : <Eye className="h-4 w-4" aria-hidden />}</button></div>
              <Err e={fe.password} /></div>
          </div>
          <p className="mt-4 flex items-start gap-2 rounded-lg bg-brand-soft p-3 text-xs text-brand-dark"><Info className="mt-0.5 h-4 w-4 shrink-0 text-brand" aria-hidden />Laissé vide, un mot de passe provisoire est généré et affiché une seule fois après l’enregistrement. Aucun e-mail n’est envoyé : transmettez-le par un canal sûr. La connexion se fait avec l’adresse e-mail.</p>
        </Section>

        <Section icon={Briefcase} title="Informations professionnelles">
          <div className="grid gap-4 md:grid-cols-2">
            {pick("situation", "Situation professionnelle", Object.entries(SITUATIONS), { required: true, def: "individual" })}
            <div><label htmlFor="l-org" className={lbl}>Entreprise <span className="font-normal text-muted">(optionnel)</span></label>
              <select id="l-org" name="organizationId" defaultValue={sv.organizationId ?? ""} className={input}><option value="">Aucune (particulier)</option>{organizations.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}</select><Err e={fe.organizationId} /></div>
            {text("jobTitle", "Fonction", { max: 120 })}
            {text("experienceYears", "Expérience (années)", { type: "number" })}
          </div>
        </Section>

        <Section icon={GraduationCap} title="Formation et inscription">
          <fieldset>
            <legend className={lbl}>Formation(s) souhaitée(s) <Req /></legend>
            <div className="flex flex-wrap gap-2">
              {courses.map((c) => {
                const on = picked.includes(c.id);
                return (
                  <label key={c.id} className={cn("flex cursor-pointer items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold", on ? "border-brand bg-brand-soft text-brand" : "border-line text-brand-dark hover:bg-brand-soft/40")}>
                    <input type="checkbox" name="courseId" value={c.id} checked={on} onChange={() => setPicked(on ? picked.filter((x) => x !== c.id) : [...picked, c.id])} className="sr-only" />{c.title}{on && <Check className="h-3 w-3" aria-hidden />}
                  </label>
                );
              })}
            </div>
            <Err e={fe.courseIds} />
          </fieldset>
          <div className="mt-4 grid gap-4 md:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
            <div><label htmlFor="l-session" className={lbl}>Session {enrollment !== "none" && <Req />}</label>
              <select id="l-session" name="sessionId" defaultValue={sv.sessionId ?? ""} className={input} aria-invalid={!!fe.sessionId}><option value="">Aucune session</option>{shownSessions.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}</select><Err e={fe.sessionId} /></div>
            <div><label htmlFor="l-enrollment" className={lbl}>Statut d’inscription <Req /></label>
              <select id="l-enrollment" name="enrollment" value={enrollment} onChange={(e) => setEnrollment(e.target.value)} className={input}>{Object.entries(LEARNER_STATUS_CHOICES).map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select><Err e={fe.enrollment} /></div>
          </div>
        </Section>

        <Section icon={FileText} title="Informations complémentaires" optional>
          <div className="grid gap-4 md:grid-cols-2">
            {pick("educationLevel", "Niveau d’études", Object.entries(EDUCATION), { blank: "Non précisé" })}
            {pick("idType", "Type de pièce", Object.entries(ID_TYPES), { blank: "Non précisé" })}
            {text("idNumber", "N° pièce d’identité", { max: 60 })}
            {text("idValidUntil", "Date de validité", { type: "date" })}
          </div>
        </Section>

        <Section icon={MessageSquare} title="Notes / Commentaires" optional>
          <textarea name="notes" rows={4} maxLength={NOTES_MAX} value={notes} onChange={(e) => setNotes(e.target.value)} aria-label="Notes" className={input} />
          <p className="mt-1 text-right text-xs text-muted">{notes.length} / {NOTES_MAX}</p><Err e={fe.notes} />
          <p className="text-xs text-muted">Visibles uniquement par l’administration.</p>
        </Section>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link href="/admin/apprenants" className="inline-flex items-center gap-2 rounded-lg border border-brand bg-white px-5 py-2.5 text-sm font-semibold text-brand hover:bg-brand-soft"><ArrowLeft className="h-4 w-4" aria-hidden /> Retour à la liste</Link>
        <div className="flex gap-3">
          <button type="button" onClick={reset} className="inline-flex items-center gap-2 rounded-lg border border-brand bg-white px-5 py-2.5 text-sm font-semibold text-brand hover:bg-brand-soft"><RotateCcw className="h-4 w-4" aria-hidden /> Réinitialiser</button>
          <button type="submit" disabled={pending} className="inline-flex items-center gap-2 rounded-lg bg-brand px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-dark disabled:opacity-60"><Save className="h-4 w-4" aria-hidden /> {pending ? "Enregistrement…" : "Enregistrer l’apprenant"}</button>
        </div>
      </div>
    </form>
  );
}
