"use client";

import Link from "next/link";
import { useActionState, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, Calendar, CheckCircle2, Lock, Mail, Phone, User } from "lucide-react";
import { register, type FormState } from "@/lib/auth/actions";
import { SITUATIONS, registerStep1Schema, registerStep2Schema } from "@/lib/auth/schemas";
import { Alert } from "@/components/ui/feedback";
import { IconField } from "./icon-field";
import { Stepper } from "./stepper";

type Values = {
  fullName: string; birthDate: string; email: string; phone: string; password: string; confirmPassword: string; acceptTerms: boolean;
  situation: keyof typeof SITUATIONS; interests: string[]; notifyEmail: boolean; notifySms: boolean;
};

const INITIAL: Values = {
  fullName: "", birthDate: "", email: "", phone: "", password: "", confirmPassword: "", acceptTerms: false,
  situation: "individual", interests: [], notifyEmail: true, notifySms: false,
};

const STEP1 = ["fullName", "birthDate", "email", "phone", "password", "confirmPassword", "acceptTerms"] as const;
const STEP2 = ["situation", "interests", "notifyEmail", "notifySms"] as const;

type Errors = Record<string, string>;

const toRaw = (v: Values) => ({
  ...v,
  acceptTerms: v.acceptTerms ? "on" : undefined,
  notifyEmail: v.notifyEmail ? "on" : undefined,
  notifySms: v.notifySms ? "on" : undefined,
});

function firstMessages(fieldErrors: Record<string, string[] | undefined>): Errors {
  const out: Errors = {};
  for (const [k, v] of Object.entries(fieldErrors)) if (v?.[0]) out[k] = v[0];
  return out;
}

function validateStep(step: 1 | 2, v: Values): Errors {
  if (step === 1) {
    const r = registerStep1Schema.safeParse(toRaw(v));
    const errors = r.success ? {} : firstMessages(r.error.flatten().fieldErrors as Record<string, string[]>);
    // Zod n'évalue la comparaison des mots de passe que si les autres champs sont valides : on la vérifie toujours.
    if (!errors.confirmPassword && v.confirmPassword && v.password !== v.confirmPassword) errors.confirmPassword = "Les mots de passe ne correspondent pas";
    if (!errors.confirmPassword && !v.confirmPassword) errors.confirmPassword = "Confirmez votre mot de passe";
    return errors;
  }
  const r = registerStep2Schema.safeParse(toRaw(v));
  return r.success ? {} : firstMessages(r.error.flatten().fieldErrors as Record<string, string[]>);
}

const formatBirth = (iso: string) => {
  const d = new Date(`${iso}T00:00:00Z`);
  return Number.isNaN(d.getTime()) ? iso : new Intl.DateTimeFormat("fr-FR", { dateStyle: "long", timeZone: "UTC" }).format(d);
};

function GoogleLogo() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden>
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09Z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23Z" />
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84Z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53Z" />
    </svg>
  );
}
function MicrosoftLogo() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden>
      <path fill="#F25022" d="M2 2h9.5v9.5H2z" /><path fill="#7FBA00" d="M12.5 2H22v9.5h-9.5z" />
      <path fill="#00A4EF" d="M2 12.5h9.5V22H2z" /><path fill="#FFB900" d="M12.5 12.5H22V22h-9.5z" />
    </svg>
  );
}

export function RegisterWizard({ redirectTo, categories }: { redirectTo?: string; categories: { slug: string; label: string }[] }) {
  const [state, action, pending] = useActionState<FormState, FormData>(register, {});
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [v, setV] = useState<Values>(INITIAL);
  const [errors, setErrors] = useState<Errors>({});
  const headingRef = useRef<HTMLHeadingElement>(null);
  const set = <K extends keyof Values>(key: K, value: Values[K]) => {
    setV((p) => ({ ...p, [key]: value }));
    if (errors[key]) setErrors((e) => { const { [key]: _drop, ...rest } = e; void _drop; return rest; });
  };

  const goTo = (n: 1 | 2 | 3) => {
    setStep(n);
    setErrors({});
    requestAnimationFrame(() => { headingRef.current?.focus(); headingRef.current?.scrollIntoView({ block: "start", behavior: "smooth" }); });
  };

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    if (step === 3) return; // l'action serveur prend le relais
    e.preventDefault();
    const errs = validateStep(step, v);
    if (Object.keys(errs).length) { setErrors(errs); return; }
    goTo((step + 1) as 2 | 3);
  }

  if (state.message) {
    return (
      <div className="rounded-2xl border border-line bg-white p-8 text-center shadow-card" role="status">
        <CheckCircle2 className="mx-auto h-14 w-14 text-success" aria-hidden />
        <h2 className="mt-4 text-2xl font-extrabold text-brand-dark">Votre compte est créé</h2>
        <p className="mt-2 text-muted">Un e-mail de confirmation a été envoyé à <strong className="text-brand-dark">{state.message}</strong>. Cliquez sur le lien qu’il contient pour activer votre compte, puis connectez-vous.</p>
        <p className="mt-2 text-xs text-muted">Vous ne le voyez pas ? Vérifiez vos courriers indésirables.</p>
        <Link href={redirectTo ? `/connexion?redirect=${encodeURIComponent(redirectTo)}` : "/connexion"} className="mt-6 inline-flex items-center justify-center rounded-lg bg-brand px-6 py-3 text-sm font-semibold text-white hover:bg-brand-dark">Se connecter</Link>
      </div>
    );
  }

  const hidden = (keys: readonly (keyof Values)[]) =>
    keys.flatMap((k) => {
      const val = v[k];
      if (Array.isArray(val)) return val.map((x) => <input key={`${k}-${x}`} type="hidden" name={k} value={x} />);
      if (typeof val === "boolean") return val ? [<input key={k} type="hidden" name={k} value="on" />] : [];
      return [<input key={k} type="hidden" name={k} value={val} />];
    });

  const serverIssues = state.fieldErrors ? Object.values(state.fieldErrors).flat() : [];
  const labelOf = (slug: string) => categories.find((c) => c.slug === slug)?.label ?? slug;
  const btn = "inline-flex items-center justify-center gap-2 rounded-lg px-6 py-3.5 text-base font-bold transition-colors disabled:cursor-not-allowed disabled:opacity-60";

  return (
    <div className="rounded-2xl border border-line bg-white p-6 shadow-card md:p-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 ref={headingRef} tabIndex={-1} className="text-3xl font-extrabold text-brand-dark outline-none">Inscription</h2>
          <p className="mt-1 text-muted">Créez votre compte en quelques étapes simples.</p>
        </div>
        <p className="shrink-0 text-sm text-muted" aria-live="polite">Étape {step} sur 3</p>
      </div>

      <div className="mt-6"><Stepper step={step} /></div>

      <form action={action} onSubmit={onSubmit} noValidate className="mt-6">
        {redirectTo && <input type="hidden" name="redirect" value={redirectTo} />}
        {step !== 1 && hidden(STEP1)}
        {step !== 2 && hidden(STEP2)}

        {step === 1 && (
          <div className="space-y-5">
            <div className="grid gap-3 sm:grid-cols-2">
              <button type="button" disabled title="Bientôt disponible" className="flex items-center justify-center gap-3 rounded-lg border border-line bg-white px-4 py-3 text-sm font-semibold text-brand-dark opacity-60"><GoogleLogo />Continuer avec Google</button>
              <button type="button" disabled title="Bientôt disponible" className="flex items-center justify-center gap-3 rounded-lg border border-line bg-white px-4 py-3 text-sm font-semibold text-brand-dark opacity-60"><MicrosoftLogo />Continuer avec Microsoft</button>
            </div>
            <p className="-mt-2 text-center text-xs text-muted">La connexion avec Google et Microsoft sera bientôt disponible.</p>
            <div className="flex items-center gap-3 text-sm text-muted" aria-hidden><span className="h-px flex-1 bg-line" />ou<span className="h-px flex-1 bg-line" /></div>
            <p className="text-center text-sm text-muted">Remplissez le formulaire ci-dessous</p>

            <div className="grid gap-4 sm:grid-cols-2">
              <IconField label="Nom complet" name="fullName" icon={User} required autoComplete="name" placeholder="Votre nom complet" value={v.fullName} onChange={(e) => set("fullName", e.target.value)} error={errors.fullName} />
              <IconField label="Date de naissance" name="birthDate" icon={Calendar} required type="date" autoComplete="bday" value={v.birthDate} onChange={(e) => set("birthDate", e.target.value)} error={errors.birthDate} />
              <IconField label="Email" name="email" icon={Mail} required type="email" autoComplete="email" placeholder="exemple@domaine.com" value={v.email} onChange={(e) => set("email", e.target.value)} error={errors.email} />
              <IconField label="Téléphone" name="phone" icon={Phone} required type="tel" autoComplete="tel" placeholder="+225 07 07 07 07 07" value={v.phone} onChange={(e) => set("phone", e.target.value)} error={errors.phone} />
              <IconField label="Mot de passe" name="password" icon={Lock} required password autoComplete="new-password" placeholder="Au moins 10 caractères" hint="10 caractères minimum, avec une lettre et un chiffre." value={v.password} onChange={(e) => set("password", e.target.value)} error={errors.password} />
              <IconField label="Confirmer le mot de passe" name="confirmPassword" icon={Lock} required password autoComplete="new-password" placeholder="Confirmez votre mot de passe" value={v.confirmPassword} onChange={(e) => set("confirmPassword", e.target.value)} error={errors.confirmPassword} />
            </div>

            <div>
              <label className="flex items-start gap-2.5 text-sm text-brand-dark">
                <input type="checkbox" name="acceptTerms" checked={v.acceptTerms} onChange={(e) => set("acceptTerms", e.target.checked)} aria-invalid={!!errors.acceptTerms} className="mt-0.5 h-4 w-4 accent-[var(--color-brand)]" />
                <span>J’accepte les <Link href="/conditions" target="_blank" className="text-brand underline">Conditions d’utilisation</Link> et la <Link href="/confidentialite" target="_blank" className="text-brand underline">Politique de confidentialité</Link> <span className="text-danger" aria-hidden>*</span></span>
              </label>
              {errors.acceptTerms && <p role="alert" className="mt-1 text-xs text-danger">{errors.acceptTerms}</p>}
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-6">
            <div>
              <label htmlFor="reg-situation" className="mb-1.5 block text-sm font-semibold text-brand-dark">Vous êtes</label>
              <select id="reg-situation" name="situation" value={v.situation} onChange={(e) => set("situation", e.target.value as Values["situation"])} className="w-full rounded-lg border border-line bg-white px-3 py-3 text-sm text-brand-dark outline-none focus:border-brand focus:ring-2 focus:ring-brand/20">
                {Object.entries(SITUATIONS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
              </select>
            </div>
            <fieldset>
              <legend className="mb-2 text-sm font-semibold text-brand-dark">Domaines qui vous intéressent <span className="font-normal text-muted">(facultatif)</span></legend>
              <div className="grid gap-2 sm:grid-cols-2">
                {categories.map((c) => (
                  <label key={c.slug} className="flex cursor-pointer items-center gap-2.5 rounded-lg border border-line px-3 py-2.5 text-sm text-brand-dark has-[:checked]:border-brand has-[:checked]:bg-brand-soft">
                    <input type="checkbox" name="interests" value={c.slug} checked={v.interests.includes(c.slug)}
                      onChange={(e) => set("interests", e.target.checked ? [...v.interests, c.slug].slice(0, 10) : v.interests.filter((s) => s !== c.slug))}
                      className="h-4 w-4 accent-[var(--color-brand)]" />
                    {c.label}
                  </label>
                ))}
              </div>
            </fieldset>
            <fieldset>
              <legend className="mb-2 text-sm font-semibold text-brand-dark">Notifications</legend>
              <div className="space-y-2.5 text-sm text-brand-dark">
                <label className="flex items-center gap-2.5"><input type="checkbox" name="notifyEmail" checked={v.notifyEmail} onChange={(e) => set("notifyEmail", e.target.checked)} className="h-4 w-4 accent-[var(--color-brand)]" />Recevoir mes notifications par e-mail (sessions, résultats, certificats)</label>
                <label className="flex items-center gap-2.5"><input type="checkbox" name="notifySms" checked={v.notifySms} onChange={(e) => set("notifySms", e.target.checked)} className="h-4 w-4 accent-[var(--color-brand)]" />Recevoir aussi des rappels par SMS lorsque ce service sera disponible</label>
              </div>
            </fieldset>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-5">
            {state.error && <Alert>{state.error}</Alert>}
            {serverIssues.length > 0 && (
              <Alert>
                Certaines informations sont à corriger :
                <ul className="mt-1 list-disc pl-5">{serverIssues.map((m) => <li key={m}>{m}</li>)}</ul>
                <button type="button" onClick={() => goTo(1)} className="mt-2 font-semibold underline">Modifier mes informations</button>
              </Alert>
            )}
            <p className="text-sm text-muted">Vérifiez vos informations avant de créer votre compte.</p>
            <dl className="divide-y divide-line rounded-xl border border-line text-sm">
              {([
                ["Nom complet", v.fullName],
                ["Date de naissance", formatBirth(v.birthDate)],
                ["E-mail", v.email],
                ["Téléphone", v.phone],
                ["Vous êtes", SITUATIONS[v.situation]],
                ["Domaines", v.interests.length ? v.interests.map(labelOf).join(", ") : "Aucun choisi"],
                ["Notifications", [v.notifyEmail && "E-mail", v.notifySms && "SMS"].filter(Boolean).join(" et ") || "Aucune"],
              ] as const).map(([k, val]) => (
                <div key={k} className="grid grid-cols-[9rem_1fr] gap-3 px-4 py-2.5"><dt className="text-muted">{k}</dt><dd className="break-words font-medium text-brand-dark">{val}</dd></div>
              ))}
            </dl>
            <p className="text-xs text-muted">Votre compte est activé dès la création, sans e-mail de confirmation.</p>
          </div>
        )}

        <div className={`mt-6 flex gap-3 ${step === 1 ? "" : "flex-col-reverse sm:flex-row"}`}>
          {step > 1 && (
            <button type="button" onClick={() => goTo((step - 1) as 1 | 2)} className={`${btn} border border-line bg-white text-brand-dark hover:bg-brand-soft sm:w-40`}>
              <ArrowLeft className="h-4 w-4" aria-hidden />Retour
            </button>
          )}
          <button type="submit" disabled={pending} className={`${btn} flex-1 bg-cta text-white hover:bg-cta-dark`}>
            {step === 3 ? (pending ? "Création du compte…" : "Créer mon compte") : "Suivant"}
            {!pending && <ArrowRight className="h-4 w-4" aria-hidden />}
          </button>
        </div>
        <p className="mt-4 flex items-center justify-center gap-2 text-center text-xs text-muted"><Lock className="h-3.5 w-3.5" aria-hidden />Vos données sont protégées et utilisées uniquement pour gérer votre compte et vos formations.</p>
      </form>
    </div>
  );
}
