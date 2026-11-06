"use client";

import { useActionState, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { BadgeCheck, Briefcase, Building2, Check, Copy, Headphones, Info, Lock, Mail, Settings, ShieldCheck, Upload, User, UserPlus, Users, GraduationCap, UserRound, Layers, type LucideIcon } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { Alert } from "@/components/ui/feedback";
import { createUser } from "@/lib/admin/users-actions";
import { CREATION_ROLES, GENDER_OPTIONS, ROLE_LABEL, ROLE_TONE, type RoleCode } from "@/lib/admin/users";
import type { FormState } from "@/lib/auth/actions";
import { PHONE_CODES } from "@/lib/learners/wizard";
import { createClient } from "@/lib/supabase/browser";
import { cn } from "@/lib/utils";

const ROLE_ICON: Partial<Record<RoleCode, { icon: LucideIcon; color: string }>> = {
  learner: { icon: GraduationCap, color: "text-brand" }, instructor: { icon: UserRound, color: "text-cta" },
  company: { icon: Building2, color: "text-[#7c3aed]" }, admin: { icon: Settings, color: "text-danger" }, support: { icon: Headphones, color: "text-success" },
};

const input = "w-full rounded-lg border border-line bg-white px-3 py-2.5 text-sm text-brand-dark outline-none focus:border-brand focus:ring-2 focus:ring-brand/20";
const lbl = "mb-1 block text-sm font-semibold text-brand-dark";

function Section({ icon: Icon, title, hint, children }: { icon: LucideIcon; title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-line bg-white p-5 shadow-card">
      <h2 className="mb-3 flex items-center gap-3 text-base font-extrabold text-brand-dark"><Icon className="h-5 w-5 text-brand" aria-hidden />{title}</h2>
      {hint && <p className="-mt-2 mb-3 text-xs text-muted">{hint}</p>}
      {children}
    </section>
  );
}

const Err = ({ e }: { e?: string[] }) => (e?.[0] ? <p role="alert" className="mt-1 text-xs text-danger">{e[0]}</p> : null);

export function PhotoPicker({ url, onChange, error }: { url: string | null; onChange: (path: string, url: string | null) => void; error?: string }) {
  const ref = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

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
      const p = `${user.id}/user-${crypto.randomUUID()}.${file.type === "image/png" ? "png" : "jpg"}`;
      const { error: upErr } = await supabase.storage.from("profile-photos").upload(p, file, { contentType: file.type, upsert: false });
      if (upErr) throw upErr;
      const signed = await supabase.storage.from("profile-photos").createSignedUrl(p, 3600);
      onChange(p, signed.data?.signedUrl ?? null);
    } catch {
      setMsg("Impossible d’envoyer la photo. Réessayez.");
    } finally {
      setBusy(false);
      if (ref.current) ref.current.value = "";
    }
  }
  return (
    <div>
      <p className={lbl}>Photo de profil</p>
      <div className="flex items-center gap-3">
        <span className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-full bg-brand-soft text-brand">
          {url ? <Image src={url} alt="" width={56} height={56} className="h-full w-full object-cover" unoptimized /> : <User className="h-6 w-6" aria-hidden />}
        </span>
        <div>
          <input ref={ref} id="user-photo" type="file" accept="image/jpeg,image/png" onChange={pick} className="sr-only" />
          <label htmlFor="user-photo" className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-brand px-3 py-2 text-sm font-semibold text-brand hover:bg-brand-soft"><Upload className="h-4 w-4" aria-hidden />{busy ? "Envoi…" : url ? "Changer la photo" : "Ajouter une photo"}</label>
          <p className="mt-1 text-xs text-muted">JPG, PNG (max 2 Mo)</p>
        </div>
      </div>
      {(msg || error) && <p role="alert" className="mt-1 text-xs text-danger">{msg ?? error}</p>}
    </div>
  );
}

/** Création d'un compte : informations, organisation, rôles en cartes, statut et mot de passe. Le mot de passe généré n'est montré qu'une fois. */
export function CreateUserForm({ organizations }: { organizations: { id: string; name: string }[] }) {
  const [state, action, pending] = useActionState<FormState, FormData>(createUser, {});
  const fe = state.fieldErrors ?? {};
  const sv = state.values ?? {};
  const [f, setF] = useState({
    fullName: sv.fullName ?? "", gender: sv.gender ?? "", email: sv.email ?? "", phoneCode: sv.phoneCode ?? "+225", phoneNumber: sv.phoneNumber ?? "",
    organizationId: sv.organizationId ?? "", jobTitle: sv.jobTitle ?? "", department: sv.department ?? "", status: sv.status ?? "active",
    passwordMode: sv.passwordMode ?? "auto", welcome: "",
  });
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setF((p) => ({ ...p, [k]: e.target.value }));
  const [roles, setRoles] = useState<RoleCode[]>(["learner"]);
  const [photo, setPhoto] = useState<{ path: string; url: string | null }>({ path: "", url: null });
  const [copied, setCopied] = useState(false);
  const org = organizations.find((o) => o.id === f.organizationId);
  const order: RoleCode[] = ["admin", "instructor", "company", "support", "learner"];
  const shownRoles = [...roles].sort((a, b) => order.indexOf(a) - order.indexOf(b));

  if (state.message && sv.id) {
    return (
      <div className="max-w-xl space-y-4 rounded-2xl border border-line bg-white p-6 shadow-card">
        <Alert tone="success">Le compte {sv.email} a été créé.</Alert>
        {sv.password ? (
          <div>
            <p className="text-sm font-semibold text-brand-dark">Mot de passe provisoire</p>
            <div className="mt-1 flex items-center gap-2">
              <code className="flex-1 rounded-lg bg-surface px-3 py-2 font-mono text-base text-brand-dark">{sv.password}</code>
              <button type="button" onClick={async () => { try { await navigator.clipboard.writeText(sv.password); setCopied(true); } catch { /* presse-papiers indisponible */ } }}
                className="inline-flex items-center gap-2 rounded-lg border border-brand px-3 py-2 text-sm font-semibold text-brand hover:bg-brand-soft">
                {copied ? <Check className="h-4 w-4" aria-hidden /> : <Copy className="h-4 w-4" aria-hidden />} {copied ? "Copié" : "Copier"}
              </button>
            </div>
            <p className="mt-2 text-xs text-muted">Ce mot de passe ne sera plus affiché. Transmettez-le par un canal sûr ; la personne pourra le remplacer depuis « Mot de passe oublié ». Aucun e-mail n’est envoyé.</p>
          </div>
        ) : <p className="text-sm text-muted">Le mot de passe est celui que vous avez défini. Transmettez-le par un canal sûr : aucun e-mail n’est envoyé.</p>}
        <div className="flex flex-wrap gap-3">
          <Link href={`/admin/utilisateurs/${sv.id}`} className="rounded-lg bg-brand px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-dark">Voir le compte</Link>
          <Link href="/admin/utilisateurs/nouveau" className="rounded-lg border border-brand px-5 py-2.5 text-sm font-semibold text-brand hover:bg-brand-soft">Créer un autre compte</Link>
        </div>
      </div>
    );
  }

  return (
    <form action={action} noValidate className="space-y-6">
      {state.error && <Alert>{state.error}</Alert>}
      <input type="hidden" name="photoPath" value={photo.path} />
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="space-y-5">
          <Section icon={User} title="Informations personnelles">
            <div className="grid gap-4 md:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
              <div><label htmlFor="u-name" className={lbl}>Nom complet <span className="text-danger">*</span></label><input id="u-name" name="fullName" value={f.fullName} onChange={set("fullName")} className={input} aria-invalid={!!fe.fullName} /><Err e={fe.fullName} /></div>
              <div><label htmlFor="u-gender" className={lbl}>Genre</label>
                <select id="u-gender" name="gender" value={f.gender} onChange={set("gender")} className={input}>{Object.entries(GENDER_OPTIONS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></div>
            </div>
            <div className="mt-4 grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)]">
              <div><label htmlFor="u-email" className={lbl}>Email <span className="text-danger">*</span></label><input id="u-email" name="email" type="email" autoComplete="off" value={f.email} onChange={set("email")} className={input} aria-invalid={!!fe.email} /><Err e={fe.email} /></div>
              <div>
                <label htmlFor="u-phone" className={lbl}>Téléphone <span className="text-danger">*</span></label>
                <div className={cn("flex overflow-hidden rounded-lg border bg-white", fe.phoneNumber ? "border-danger" : "border-line")}>
                  <select name="phoneCode" value={f.phoneCode} onChange={set("phoneCode")} aria-label="Indicatif" className="border-r border-line bg-surface px-2 text-sm">{PHONE_CODES.map(([c, n]) => <option key={c} value={c}>{c} {n}</option>)}</select>
                  <input id="u-phone" name="phoneNumber" type="tel" value={f.phoneNumber} onChange={set("phoneNumber")} placeholder="07 07 07 07 07" className="min-w-0 flex-1 px-3 py-2.5 text-sm outline-none" aria-invalid={!!fe.phoneNumber} />
                </div>
                <Err e={fe.phoneNumber} />
              </div>
              <PhotoPicker url={photo.url} onChange={(path, url) => setPhoto({ path, url })} error={fe.photoPath?.[0]} />
            </div>
          </Section>

          <Section icon={Briefcase} title="Informations professionnelles">
            <div className="grid gap-4 md:grid-cols-3">
              <div><label htmlFor="u-org" className={lbl}>Organisation / Entreprise</label>
                <select id="u-org" name="organizationId" value={f.organizationId} onChange={set("organizationId")} className={input}>
                  <option value="">Aucune (Particulier)</option>
                  {organizations.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
                </select><Err e={fe.organizationId} /></div>
              <div><label htmlFor="u-job" className={lbl}>Poste / Fonction</label><input id="u-job" name="jobTitle" value={f.jobTitle} onChange={set("jobTitle")} className={input} /><Err e={fe.jobTitle} /></div>
              <div><label htmlFor="u-dep" className={lbl}>Service / Département</label><input id="u-dep" name="department" value={f.department} onChange={set("department")} className={input} /><Err e={fe.department} /></div>
            </div>
          </Section>

          <Section icon={Users} title="Rôles et permissions" hint="Un utilisateur peut avoir plusieurs rôles.">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5" role="group" aria-label="Rôles">
              {CREATION_ROLES.map(({ code, hint }) => {
                const on = roles.includes(code);
                const { icon: Icon, color } = ROLE_ICON[code]!;
                return (
                  <label key={code} className={cn("relative flex cursor-pointer flex-col items-center gap-1 rounded-xl border p-3 text-center", on ? "border-brand bg-brand-soft/60" : "border-line hover:bg-brand-soft/30")}>
                    <input type="checkbox" name="role" value={code} checked={on} onChange={() => setRoles(on ? roles.filter((r) => r !== code) : [...roles, code])} className="absolute left-2 top-2 h-4 w-4" />
                    <Icon className={cn("mt-3 h-8 w-8", color)} aria-hidden />
                    <span className="text-sm font-bold text-brand-dark">{ROLE_LABEL[code]}</span>
                    <span className="text-xs text-muted">{hint}</span>
                  </label>
                );
              })}
            </div>
            <Err e={fe.roles} />
          </Section>

          <Section icon={Lock} title="Accès et statut">
            <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
              <div><label htmlFor="u-status" className={lbl}>Statut du compte</label>
                <select id="u-status" name="status" value={f.status} onChange={set("status")} className={input}><option value="active">Actif</option><option value="suspended">Inactif (suspendu)</option></select></div>
              <fieldset>
                <legend className={lbl}>Mot de passe</legend>
                <div className="flex flex-wrap gap-4 py-2 text-sm text-brand-dark">
                  <label className="flex items-center gap-2"><input type="radio" name="passwordMode" value="auto" checked={f.passwordMode === "auto"} onChange={set("passwordMode")} /> Générer automatiquement</label>
                  <label className="flex items-center gap-2"><input type="radio" name="passwordMode" value="manual" checked={f.passwordMode === "manual"} onChange={set("passwordMode")} /> Définir un mot de passe</label>
                </div>
              </fieldset>
            </div>
            {f.passwordMode === "manual" && (
              <div className="mt-2 max-w-sm"><label htmlFor="u-pass" className={lbl}>Mot de passe</label><input id="u-pass" name="password" type="password" autoComplete="new-password" className={input} aria-invalid={!!fe.password} /><Err e={fe.password} />
                <p className="mt-1 text-xs text-muted">10 caractères minimum, avec au moins une lettre et un chiffre.</p></div>
            )}
            <p className="mt-3 flex items-center gap-2 rounded-lg bg-brand-soft p-3 text-xs text-brand-dark"><Info className="h-4 w-4 shrink-0 text-brand" aria-hidden />Le compte est créé déjà confirmé. Aucun e-mail n’est envoyé : {f.passwordMode === "auto" ? "le mot de passe généré vous est affiché une seule fois à la création." : "transmettez vous-même le mot de passe défini."}</p>
          </Section>

          <Section icon={Mail} title="Message personnalisé (optionnel)">
            <label htmlFor="u-msg" className={lbl}>Message à inclure dans l’email d’invitation</label>
            <textarea id="u-msg" rows={4} disabled value={f.welcome} onChange={set("welcome")} placeholder="Bonjour, votre compte SECURIPASS a été créé…" className={cn(input, "cursor-not-allowed bg-surface")} />
            <p className="mt-1 text-xs text-muted">Indisponible : l’envoi d’e-mails n’est pas encore actif sur la plateforme.</p>
          </Section>
        </div>

        <aside className="space-y-5 xl:sticky xl:top-4 xl:self-start">
          <section className="rounded-2xl border border-line bg-white p-5 shadow-card">
            <h2 className="mb-4 text-lg font-extrabold text-brand-dark">Aperçu du compte</h2>
            <div className="flex items-center gap-4">
              <Avatar name={f.fullName || "?"} src={photo.url} size={72} />
              <div className="min-w-0"><p className="text-lg font-extrabold text-brand-dark">{f.fullName || "Nouvel utilisateur"}</p>
                {f.email && <p className="truncate text-xs text-brand">{f.email}</p>}
                {f.phoneNumber && <p className="text-xs text-muted">{f.phoneCode} {f.phoneNumber}</p>}</div>
            </div>
            <dl className="mt-4 divide-y divide-line text-sm">
              {([
                [UserRound, "Genre", f.gender ? GENDER_OPTIONS[f.gender as keyof typeof GENDER_OPTIONS] : "—"],
                [Briefcase, "Poste", f.jobTitle || "—"],
                [Layers, "Service", f.department || "—"],
                [Building2, "Organisation", org?.name ?? "Particulier"],
              ] as const).map(([I, l, v]) => (
                <div key={l} className="flex items-center justify-between gap-3 py-2"><dt className="flex items-center gap-2 text-brand-dark"><I className="h-4 w-4 text-muted" aria-hidden />{l}</dt><dd className="text-right text-brand-dark">{v}</dd></div>
              ))}
              <div className="flex items-center justify-between gap-3 py-2"><dt className="flex items-center gap-2 text-brand-dark"><BadgeCheck className="h-4 w-4 text-muted" aria-hidden />Rôles attribués</dt>
                <dd className="flex flex-wrap justify-end gap-1">{shownRoles.length ? shownRoles.map((r) => <span key={r} className={cn("rounded-md px-2 py-0.5 text-xs font-semibold", ROLE_TONE[r])}>{ROLE_LABEL[r]}</span>) : "—"}</dd></div>
              <div className="flex items-center justify-between gap-3 py-2"><dt className="flex items-center gap-2 text-brand-dark"><ShieldCheck className="h-4 w-4 text-muted" aria-hidden />Statut</dt>
                <dd className={cn("flex items-center gap-1.5 font-semibold", f.status === "active" ? "text-success" : "text-danger")}><span className="h-2 w-2 rounded-full bg-current" aria-hidden />{f.status === "active" ? "Actif" : "Inactif"}</dd></div>
              <div className="flex items-center justify-between gap-3 py-2"><dt className="flex items-center gap-2 text-brand-dark"><Lock className="h-4 w-4 text-muted" aria-hidden />Accès</dt><dd className="text-brand-dark">{f.passwordMode === "auto" ? "Mot de passe généré" : "Mot de passe défini"}</dd></div>
            </dl>
          </section>
          <section className="rounded-2xl border border-warning/40 bg-warning/10 p-5">
            <h2 className="mb-2 flex items-center gap-2 text-base font-extrabold text-brand-dark"><Info className="h-5 w-5 text-warning" aria-hidden />Informations importantes</h2>
            <ul className="list-disc space-y-1.5 pl-5 text-sm text-brand-dark marker:text-warning">
              <li>Le compte est créé confirmé ; transmettez ses identifiants à la personne (aucun e-mail n’est envoyé).</li>
              <li>Elle pourra compléter son profil dès sa première connexion.</li>
              <li>Vous pouvez modifier ses rôles et son statut à tout moment.</li>
            </ul>
          </section>
          <div className="flex gap-3">
            <Link href="/admin/utilisateurs" className="inline-flex flex-1 items-center justify-center rounded-lg border border-brand bg-white px-5 py-3 text-sm font-semibold text-brand hover:bg-brand-soft">Annuler</Link>
            <button type="submit" disabled={pending} className="inline-flex flex-[1.6] items-center justify-center gap-2 rounded-lg bg-brand px-5 py-3 text-sm font-semibold text-white hover:bg-brand-dark disabled:opacity-60">
              <UserPlus className="h-4 w-4" aria-hidden /> {pending ? "Création…" : "Créer l’utilisateur"}
            </button>
          </div>
        </aside>
      </div>
    </form>
  );
}
