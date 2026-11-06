"use client";

import { useActionState, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Check, Copy, CreditCard, FileText, GraduationCap, Info, Paperclip, RotateCcw, Save, Search, Settings, Upload, User, X, type LucideIcon } from "lucide-react";
import { PhotoPicker } from "@/components/admin/create-user-form";
import { Alert } from "@/components/ui/feedback";
import { ENROLLMENT_SOURCES, DOC_MAX_MB, NOTES_MAX, PAYMENT_METHODS, PAYMENT_STATUS_UI } from "@/lib/admin/enrollments";
import { createEnrollment } from "@/lib/admin/enrollments-actions";
import type { FormState } from "@/lib/auth/actions";
import { MODES } from "@/lib/courses/labels";
import { PHONE_CODES } from "@/lib/learners/wizard";
import { createClient } from "@/lib/supabase/browser";
import { cn } from "@/lib/utils";

const input = "w-full rounded-lg border border-line bg-white px-3 py-2.5 text-sm text-brand-dark outline-none focus:border-brand focus:ring-2 focus:ring-brand/20 read-only:bg-surface disabled:bg-surface";
const lbl = "mb-1 block text-sm font-semibold text-brand-dark";

export type LearnerChoice = { id: string; firstName: string; lastName: string; email: string; phone: string; gender: string; birthDate: string };
export type CourseChoice = { id: string; title: string; price: number };
export type SessionChoice = { id: string; courseId: string; label: string; mode: keyof typeof MODES; location: string | null; free: number; capacity: number };
type Doc = { path: string; name: string; size: number };

function Section({ icon: Icon, title, hint, children, className }: { icon: LucideIcon; title: string; hint?: string; children: React.ReactNode; className?: string }) {
  return (
    <section className={cn("rounded-2xl border border-line bg-white p-5 shadow-card", className)}>
      <div className="mb-4 flex items-start gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-soft text-brand"><Icon className="h-5 w-5" aria-hidden /></span>
        <div><h2 className="text-base font-extrabold text-brand-dark">{title}</h2>{hint && <p className="text-xs text-muted">{hint}</p>}</div>
      </div>
      {children}
    </section>
  );
}
const Err = ({ e }: { e?: string[] }) => (e?.[0] ? <p role="alert" className="mt-1 text-xs text-danger">{e[0]}</p> : null);
const Req = () => <span className="text-danger">*</span>;
const fcfa = new Intl.NumberFormat("fr-FR");

/** Nouvelle inscription : apprenant (existant ou nouveau), formation et session, détails, paiement saisi, pièces jointes et notes. */
export function CreateEnrollmentForm({ learners, courses, sessions, today }: { learners: LearnerChoice[]; courses: CourseChoice[]; sessions: SessionChoice[]; today: string }) {
  const [state, action, pending] = useActionState<FormState, FormData>(createEnrollment, {});
  const [formKey, setFormKey] = useState(0);
  if (state.message && state.values?.password) return <Created values={state.values} />;
  return <Inner key={formKey} state={state} action={action} pending={pending} reset={() => setFormKey((k) => k + 1)} learners={learners} courses={courses} sessions={sessions} today={today} />;
}

function Created({ values }: { values: Record<string, string> }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="max-w-xl space-y-4 rounded-2xl border border-line bg-white p-6 shadow-card">
      <Alert tone="success">L’inscription {values.reference} a été créée{values.status === "waitlisted" ? " (liste d’attente : la session est complète)" : ""}, ainsi que le compte {values.email}.</Alert>
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
      <div className="flex flex-wrap gap-3">
        <Link href="/admin/inscriptions" className="rounded-lg bg-brand px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-dark">Retour à la liste</Link>
        <Link href="/admin/inscriptions/nouvelle" className="rounded-lg border border-brand px-5 py-2.5 text-sm font-semibold text-brand hover:bg-brand-soft">Nouvelle inscription</Link>
      </div>
    </div>
  );
}

function Inner({ state, action, pending, reset, learners, courses, sessions, today }: {
  state: FormState; action: (f: FormData) => void; pending: boolean; reset: () => void;
  learners: LearnerChoice[]; courses: CourseChoice[]; sessions: SessionChoice[]; today: string;
}) {
  const fe = state.fieldErrors ?? {};
  const sv = state.values ?? {};
  const [mode, setMode] = useState<"existing" | "new">(sv.mode === "new" ? "new" : "existing");
  const [learnerId, setLearnerId] = useState(sv.learnerId ?? "");
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [courseId, setCourseId] = useState(sv.courseId ?? "");
  const [sessionId, setSessionId] = useState(sv.sessionId ?? "");
  const [due, setDue] = useState(sv.amountDue ?? "");
  const [paid, setPaid] = useState(sv.amountPaid ?? "0");
  const [notes, setNotes] = useState(sv.notes ?? "");
  const [photo, setPhoto] = useState<{ path: string; url: string | null }>({ path: "", url: null });
  const [docs, setDocs] = useState<Doc[]>([]);
  const [docMsg, setDocMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const learner = learners.find((l) => l.id === learnerId);
  const existing = mode === "existing";
  const q = query.trim().toLowerCase();
  const matches = learners.filter((l) => !q || `${l.firstName} ${l.lastName} ${l.email} ${l.phone}`.toLowerCase().includes(q)).slice(0, 8);
  const courseSessions = sessions.filter((s) => s.courseId === courseId);
  const session = sessions.find((s) => s.id === sessionId);
  const balance = Math.max(0, (Number(due.replace(/\s/g, "")) || 0) - (Number(paid.replace(/\s/g, "")) || 0));
  const val = (k: "firstName" | "lastName" | "email" | "gender" | "birthDate") => (existing ? learner?.[k] ?? "" : undefined);
  const phoneParts = learner?.phone.match(/^(\+\d{1,3})\s*(.*)$/);

  function pickCourse(id: string) {
    setCourseId(id); setSessionId("");
    const price = courses.find((c) => c.id === id)?.price ?? 0;
    setDue(price ? String(price) : "");
  }

  async function addFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const files = [...(e.target.files ?? [])];
    if (fileRef.current) fileRef.current.value = "";
    if (!files.length) return;
    setDocMsg(null);
    if (docs.length + files.length > 10) return setDocMsg("10 fichiers au maximum.");
    const bad = files.find((f) => !["application/pdf", "image/jpeg", "image/png"].includes(f.type) || f.size > DOC_MAX_MB * 1024 * 1024);
    if (bad) return setDocMsg(`« ${bad.name} » : PDF, JPG ou PNG de ${DOC_MAX_MB} Mo maximum.`);
    setBusy(true);
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("auth");
      const added: Doc[] = [];
      for (const f of files) {
        const ext = f.type === "application/pdf" ? "pdf" : f.type === "image/png" ? "png" : "jpg";
        const path = `${user.id}/${crypto.randomUUID()}.${ext}`;
        const { error } = await supabase.storage.from("enrollment-docs").upload(path, f, { contentType: f.type, upsert: false });
        if (error) throw error;
        added.push({ path, name: f.name.slice(0, 200), size: f.size });
      }
      setDocs((d) => [...d, ...added]);
    } catch {
      setDocMsg("Impossible d’envoyer un fichier. Réessayez.");
    } finally {
      setBusy(false);
    }
  }

  const text = (name: string, label: string, o: { required?: boolean; type?: string; value?: string; def?: string; max?: number } = {}) => (
    <div><label htmlFor={`n-${name}`} className={lbl}>{label} {o.required && <Req />}</label>
      <input id={`n-${name}`} name={name} type={o.type ?? "text"} maxLength={o.max} key={`${name}-${learnerId}-${mode}`} defaultValue={o.value ?? o.def ?? sv[name] ?? ""} readOnly={existing && o.value !== undefined} className={input} aria-invalid={!!fe[name]} /><Err e={fe[name]} /></div>
  );

  return (
    <form action={action} noValidate className="space-y-6">
      {state.error && <Alert>{state.error}</Alert>}
      <input type="hidden" name="mode" value={mode} />
      {docs.map((d) => <input key={d.path} type="hidden" name="doc" value={JSON.stringify(d)} />)}
      <input type="hidden" name="photoPath" value={photo.path} />
      <input type="hidden" name="learnerId" value={existing ? learnerId : ""} />

      <Section icon={User} title="Informations de l’apprenant">
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_12rem]">
          <div className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <fieldset><legend className={lbl}>Type d’inscription <Req /></legend>
                <div className="flex gap-5 pt-2">
                  {([["existing", "Apprenant existant"], ["new", "Nouvel apprenant"]] as const).map(([v, l]) => (
                    <label key={v} className="flex cursor-pointer items-center gap-2 text-sm text-brand-dark"><input type="radio" checked={mode === v} onChange={() => setMode(v)} className="h-4 w-4 accent-[var(--color-brand)]" />{l}</label>
                  ))}
                </div></fieldset>
              {existing && (
                <div className="relative"><label htmlFor="n-search" className={lbl}>Apprenant <Req /></label>
                  <div className="relative"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden />
                    <input id="n-search" value={open ? query : learner ? `${learner.firstName} ${learner.lastName}` : query} onFocus={() => { setOpen(true); setQuery(""); }} onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
                      onBlur={() => setTimeout(() => setOpen(false), 150)} placeholder="Rechercher un apprenant (nom, téléphone, e-mail)" autoComplete="off" className={cn(input, "pl-9")} aria-invalid={!!fe.learnerId} /></div>
                  {open && (
                    <ul className="absolute z-20 mt-1 max-h-64 w-full overflow-auto rounded-lg border border-line bg-white py-1 text-sm shadow-card">
                      {matches.length === 0 && <li className="px-3 py-2 text-muted">Aucun apprenant trouvé</li>}
                      {matches.map((l) => (
                        <li key={l.id}><button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => { setLearnerId(l.id); setOpen(false); }} className="block w-full px-3 py-2 text-left hover:bg-brand-soft">
                          <span className="font-semibold text-brand-dark">{l.firstName} {l.lastName}</span><span className="block text-xs text-muted">{l.email}{l.phone && ` · ${l.phone}`}</span></button></li>
                      ))}
                    </ul>
                  )}
                  <Err e={fe.learnerId} /></div>
              )}
            </div>
            <div className="grid gap-4 md:grid-cols-4">
              {text("lastName", "Nom", { required: true, value: val("lastName"), max: 60 })}
              {text("firstName", "Prénom(s)", { required: true, value: val("firstName"), max: 60 })}
              <div><label htmlFor="n-gender" className={lbl}>Sexe</label>
                <select id="n-gender" name="gender" key={`g-${learnerId}-${mode}`} defaultValue={val("gender") ?? sv.gender ?? ""} disabled={existing} className={input}>
                  <option value="">Non précisé</option><option value="female">Féminin</option><option value="male">Masculin</option><option value="other">Autre</option></select></div>
              {text("birthDate", "Date de naissance", { type: "date", value: val("birthDate") })}
            </div>
            <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
              <div><label htmlFor="n-phone" className={lbl}>Téléphone {!existing && <Req />}</label>
                <div className="flex gap-2">
                  <select name="phoneCode" key={`pc-${learnerId}-${mode}`} defaultValue={existing ? phoneParts?.[1] ?? "+225" : sv.phoneCode ?? "+225"} disabled={existing} aria-label="Indicatif" className={cn(input, "w-28 shrink-0")}>
                    {PHONE_CODES.map(([c]) => <option key={c} value={c}>{c}</option>)}</select>
                  <input id="n-phone" name="phoneNumber" key={`pn-${learnerId}-${mode}`} defaultValue={existing ? phoneParts?.[2] ?? learner?.phone ?? "" : sv.phoneNumber ?? ""} readOnly={existing} inputMode="tel" className={input} aria-invalid={!!fe.phoneNumber} /></div>
                <Err e={fe.phoneNumber} /></div>
              {text("email", `E-mail`, { required: !existing, type: "email", value: val("email"), max: 254 })}
            </div>
            {existing && <p className="text-xs text-muted">Les informations d’un apprenant existant se modifient depuis sa fiche utilisateur.</p>}
          </div>
          <div>{!existing ? <PhotoPicker url={photo.url} onChange={(path, url) => setPhoto({ path, url })} error={fe.photoPath?.[0]} /> : <p className="text-xs text-muted">La photo est celle du profil de l’apprenant.</p>}</div>
        </div>
      </Section>

      <div className="grid gap-6 xl:grid-cols-2">
        <Section icon={GraduationCap} title="Formation et session">
          <div className="grid gap-4 md:grid-cols-2">
            <div><label htmlFor="n-course" className={lbl}>Formation <Req /></label>
              <select id="n-course" name="courseId" value={courseId} onChange={(e) => pickCourse(e.target.value)} className={input} aria-invalid={!!fe.courseId}>
                <option value="">Choisir une formation…</option>{courses.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}</select><Err e={fe.courseId} /></div>
            <div><label htmlFor="n-session" className={lbl}>Session <Req /></label>
              <select id="n-session" name="sessionId" value={sessionId} onChange={(e) => setSessionId(e.target.value)} disabled={!courseId} className={input} aria-invalid={!!fe.sessionId}>
                <option value="">{courseId && courseSessions.length === 0 ? "Aucune session à venir" : "Choisir une session…"}</option>
                {courseSessions.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}</select><Err e={fe.sessionId} /></div>
            <div><label className={lbl}>Mode de formation</label><input readOnly value={session ? MODES[session.mode] : ""} placeholder="Selon la session" className={input} /></div>
            <div><label className={lbl}>Lieu</label><input readOnly value={session ? (session.mode === "online" ? "En ligne" : session.location ?? "") : ""} placeholder="Selon la session" className={input} /></div>
          </div>
          {session && <p className="mt-3 text-xs text-muted">{session.free > 0 ? `${session.free} place${session.free > 1 ? "s" : ""} disponible${session.free > 1 ? "s" : ""} sur ${session.capacity}.` : "Session complète : une inscription validée passera en liste d’attente si elle est activée."}</p>}
        </Section>

        <Section icon={Settings} title="Détails de l’inscription">
          <div className="grid gap-4 md:grid-cols-2">
            <div><label htmlFor="n-date" className={lbl}>Date d’inscription <Req /></label><input id="n-date" name="date" type="date" defaultValue={sv.date ?? today} max={today} className={input} aria-invalid={!!fe.date} /><Err e={fe.date} /></div>
            <div><label htmlFor="n-status" className={lbl}>Statut <Req /></label>
              <select id="n-status" name="status" defaultValue={sv.status ?? "pending"} className={input}><option value="pending">En attente</option><option value="confirmed">Validée</option></select><Err e={fe.status} /></div>
            <div><label htmlFor="n-source" className={lbl}>Source <Req /></label>
              <select id="n-source" name="source" defaultValue={sv.source ?? "administration"} className={input}>{Object.entries(ENROLLMENT_SOURCES).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select><Err e={fe.source} /></div>
            <div><label className={lbl}>Référence</label><input readOnly value="Attribuée à l’enregistrement" className={input} /></div>
          </div>
        </Section>

        <Section icon={CreditCard} title="Paiement" hint="Suivi saisi à la main : aucun paiement en ligne n’est déclenché.">
          <div className="grid gap-4 md:grid-cols-2">
            <div><label htmlFor="n-due" className={lbl}>Montant de la formation <Req /></label>
              <div className="flex"><input id="n-due" name="amountDue" inputMode="numeric" value={due} onChange={(e) => setDue(e.target.value)} className={cn(input, "rounded-r-none")} aria-invalid={!!fe.amountDue} /><span className="flex items-center rounded-r-lg border border-l-0 border-line bg-surface px-3 text-sm text-muted">FCFA</span></div><Err e={fe.amountDue} /></div>
            <div><label htmlFor="n-pstatus" className={lbl}>Statut de paiement <Req /></label>
              <select id="n-pstatus" name="paymentStatus" defaultValue={sv.paymentStatus ?? "to_verify"} className={input}>{Object.entries(PAYMENT_STATUS_UI).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}</select><Err e={fe.paymentStatus} /></div>
            <div><label htmlFor="n-paid" className={lbl}>Montant payé</label>
              <div className="flex"><input id="n-paid" name="amountPaid" inputMode="numeric" value={paid} onChange={(e) => setPaid(e.target.value)} className={cn(input, "rounded-r-none")} aria-invalid={!!fe.amountPaid} /><span className="flex items-center rounded-r-lg border border-l-0 border-line bg-surface px-3 text-sm text-muted">FCFA</span></div><Err e={fe.amountPaid} /></div>
            <div><label htmlFor="n-method" className={lbl}>Mode de paiement</label>
              <select id="n-method" name="paymentMethod" defaultValue={sv.paymentMethod ?? ""} className={input}><option value="">Sélectionner un mode</option>{Object.entries(PAYMENT_METHODS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></div>
          </div>
          <p className="mt-4 flex items-center gap-2 rounded-lg bg-brand-soft px-3 py-2.5 text-sm font-semibold text-brand"><Info className="h-4 w-4" aria-hidden />Solde à payer : {fcfa.format(balance)} FCFA</p>
        </Section>

        <Section icon={Paperclip} title="Pièces jointes" hint={`Documents requis (PDF, JPG, PNG – ${DOC_MAX_MB} Mo max par fichier)`}>
          <div className="grid gap-4 md:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
            <div>
              <input ref={fileRef} id="n-docs" type="file" multiple accept="application/pdf,image/jpeg,image/png" onChange={addFiles} className="sr-only" />
              <label htmlFor="n-docs" className="flex cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-line px-4 py-6 text-center hover:bg-brand-soft/40">
                <Upload className="h-6 w-6 text-brand" aria-hidden /><span className="text-sm font-bold text-brand-dark">{busy ? "Envoi…" : "Cliquer pour choisir vos fichiers"}</span>
                <span className="text-xs text-muted">Carte d’identité, attestation, photo, etc.</span>
              </label>
              {(docMsg || fe.documents) && <p role="alert" className="mt-1 text-xs text-danger">{docMsg ?? fe.documents?.[0]}</p>}
              {docs.length > 0 && (
                <ul className="mt-3 space-y-1.5">
                  {docs.map((d) => (
                    <li key={d.path} className="flex items-center gap-2 rounded-lg border border-line px-3 py-1.5 text-sm text-brand-dark">
                      <FileText className="h-4 w-4 shrink-0 text-brand" aria-hidden /><span className="min-w-0 flex-1 truncate">{d.name}</span><span className="text-xs text-muted">{Math.max(1, Math.round(d.size / 1024))} Ko</span>
                      <button type="button" onClick={() => setDocs((x) => x.filter((y) => y.path !== d.path))} aria-label={`Retirer ${d.name}`} className="text-muted hover:text-danger"><X className="h-4 w-4" aria-hidden /></button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div className="rounded-xl border border-line p-3 text-sm text-brand-dark">
              <p className="mb-2 font-bold">Documents à fournir (recommandés)</p>
              <ul className="space-y-1.5 text-xs">
                {["Pièce d’identité (CNI, passeport…)", "Photo d’identité récente", "Attestation / diplôme (si requis)", "Autre document (optionnel)"].map((t) => <li key={t} className="flex items-center gap-2"><Check className="h-4 w-4 text-success" aria-hidden />{t}</li>)}
              </ul>
            </div>
          </div>
        </Section>
      </div>

      <Section icon={FileText} title="Notes (optionnel)">
        <textarea name="notes" rows={3} maxLength={NOTES_MAX} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Ajouter une note ou une information complémentaire sur cette inscription…" className={input} aria-label="Notes" />
        <p className="mt-1 text-right text-xs text-muted">{notes.length} / {NOTES_MAX}</p><Err e={fe.notes} />
      </Section>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link href="/admin/inscriptions" className="inline-flex items-center gap-2 rounded-lg border border-brand bg-white px-5 py-2.5 text-sm font-semibold text-brand hover:bg-brand-soft"><ArrowLeft className="h-4 w-4" aria-hidden /> Retour à la liste</Link>
        <div className="flex gap-3">
          <button type="button" onClick={reset} className="inline-flex items-center gap-2 rounded-lg border border-brand bg-white px-5 py-2.5 text-sm font-semibold text-brand hover:bg-brand-soft"><RotateCcw className="h-4 w-4" aria-hidden /> Réinitialiser</button>
          <button type="submit" disabled={pending || busy} className="inline-flex items-center gap-2 rounded-lg bg-brand px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-dark disabled:opacity-60"><Save className="h-4 w-4" aria-hidden /> {pending ? "Enregistrement…" : "Enregistrer l’inscription"}</button>
        </div>
      </div>
    </form>
  );
}
