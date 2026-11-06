"use client";

import { useActionState, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Award, BookOpen, Briefcase, Building2, Check, Clock, Copy, GraduationCap, Info, Lock, MapPin, Search, ShieldCheck, Star, User, UserPlus, FileText, type LucideIcon } from "lucide-react";
import { PhotoPicker } from "@/components/admin/create-user-form";
import { TagInput } from "@/components/courses/tag-input";
import { Avatar } from "@/components/ui/avatar";
import { Alert } from "@/components/ui/feedback";
import { BIO_MAX, CONTRACTS, type ContractType } from "@/lib/admin/trainers";
import { createTrainer } from "@/lib/admin/trainers-actions";
import { GENDER_OPTIONS } from "@/lib/admin/users";
import type { FormState } from "@/lib/auth/actions";
import { formatMinutes } from "@/lib/format";
import { PHONE_CODES } from "@/lib/learners/wizard";
import { cn } from "@/lib/utils";

export type CourseOption = { id: string; title: string; category: string | null; duration_minutes: number; price_amount: number; cover_url: string | null };

const input = "w-full rounded-lg border border-line bg-white px-3 py-2.5 text-sm text-brand-dark outline-none focus:border-brand focus:ring-2 focus:ring-brand/20";
const lbl = "mb-1 block text-sm font-semibold text-brand-dark";
const nf = new Intl.NumberFormat("fr-FR");
const TONES = ["bg-brand-soft text-brand", "bg-success/15 text-success", "bg-cta/15 text-cta-dark", "bg-[#ede9fe] text-[#6d28d9]", "bg-danger/10 text-danger", "bg-[#ccfbf1] text-[#0f766e]"];

function Section({ icon: Icon, title, hint, aside, children }: { icon: LucideIcon; title: string; hint?: string; aside?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-line bg-white p-5 shadow-card">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="flex items-center gap-3 text-base font-extrabold text-brand-dark"><Icon className="h-5 w-5 text-brand" aria-hidden />{title}</h2>
          {hint && <p className="mt-0.5 pl-8 text-xs text-muted">{hint}</p>}
        </div>
        {aside}
      </div>
      {children}
    </section>
  );
}

const Err = ({ e }: { e?: string[] }) => (e?.[0] ? <p role="alert" className="mt-1 text-xs text-danger">{e[0]}</p> : null);
const Req = () => <span className="text-danger">*</span>;

/** Création d'un formateur : identité, profil professionnel, biographie, formations à animer, accès. Le mot de passe généré n'est montré qu'une fois. */
export function CreateTrainerForm({ categories, organizations, courses }: {
  categories: { id: string; name: string }[]; organizations: { id: string; name: string }[]; courses: CourseOption[];
}) {
  const [state, action, pending] = useActionState<FormState, FormData>(createTrainer, {});
  const fe = state.fieldErrors ?? {};
  const sv = state.values ?? {};
  const [f, setF] = useState({
    fullName: sv.fullName ?? "", gender: sv.gender ?? "", birthDate: sv.birthDate ?? "", email: sv.email ?? "", phoneCode: sv.phoneCode ?? "+225", phoneNumber: sv.phoneNumber ?? "",
    jobTitle: sv.jobTitle ?? "", mainCategory: sv.mainCategory ?? "", organizationId: sv.organizationId ?? "", contract: sv.contract ?? "", experience: sv.experience ?? "",
    city: sv.city ?? "", bio: sv.bio ?? "", passwordMode: sv.passwordMode ?? "auto",
  });
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setF((p) => ({ ...p, [k]: e.target.value }));
  const [photo, setPhoto] = useState<{ path: string; url: string | null }>({ path: "", url: null });
  const [extra, setExtra] = useState<string[]>([]);
  const [picked, setPicked] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [copied, setCopied] = useState(false);

  const catName = (id: string) => categories.find((c) => c.id === id)?.name ?? "";
  const org = organizations.find((o) => o.id === f.organizationId);
  const shownSpecialties = [f.mainCategory, ...extra.filter((c) => c !== f.mainCategory)].filter(Boolean);
  const visible = courses.filter((c) => `${c.title} ${c.category ?? ""}`.toLowerCase().includes(search.trim().toLowerCase()));
  const allVisiblePicked = visible.length > 0 && visible.every((c) => picked.includes(c.id));
  const toggleCourse = (id: string) => setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));

  if (state.message && sv.id) {
    return (
      <div className="max-w-xl space-y-4 rounded-2xl border border-line bg-white p-6 shadow-card">
        <Alert tone="success">Le formateur {sv.email} a été créé.</Alert>
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
          <Link href="/admin/formateurs" className="rounded-lg bg-brand px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-dark">Retour à la liste</Link>
          <Link href="/admin/formateurs/nouveau" className="rounded-lg border border-brand px-5 py-2.5 text-sm font-semibold text-brand hover:bg-brand-soft">Ajouter un autre formateur</Link>
        </div>
      </div>
    );
  }

  return (
    <form action={action} noValidate className="space-y-6">
      {state.error && <Alert>{state.error}</Alert>}
      <input type="hidden" name="photoPath" value={photo.path} />
      {picked.map((id) => <input key={id} type="hidden" name="courseId" value={id} />)}
      {extra.map((id) => <input key={id} type="hidden" name="extraCategory" value={id} />)}
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="space-y-5">
          <Section icon={User} title="Informations personnelles" hint="Identité et coordonnées du formateur.">
            <div className="grid gap-4 md:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)_minmax(0,1fr)]">
              <div><label htmlFor="t-name" className={lbl}>Nom complet <Req /></label><input id="t-name" name="fullName" value={f.fullName} onChange={set("fullName")} className={input} aria-invalid={!!fe.fullName} /><Err e={fe.fullName} /></div>
              <div><label htmlFor="t-gender" className={lbl}>Genre <Req /></label>
                <select id="t-gender" name="gender" value={f.gender} onChange={set("gender")} className={input} aria-invalid={!!fe.gender}>
                  <option value="">Choisir…</option>
                  {Object.entries(GENDER_OPTIONS).filter(([k]) => k).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
                </select><Err e={fe.gender} /></div>
              <div><label htmlFor="t-birth" className={lbl}>Date de naissance</label><input id="t-birth" name="birthDate" type="date" min="1900-01-01" value={f.birthDate} onChange={set("birthDate")} className={input} /><Err e={fe.birthDate} /></div>
            </div>
            <div className="mt-4 grid gap-4 md:grid-cols-3">
              <div><label htmlFor="t-email" className={lbl}>Email <Req /></label><input id="t-email" name="email" type="email" autoComplete="off" value={f.email} onChange={set("email")} className={input} aria-invalid={!!fe.email} /><Err e={fe.email} /></div>
              <div>
                <label htmlFor="t-phone" className={lbl}>Téléphone <Req /></label>
                <div className={cn("flex overflow-hidden rounded-lg border bg-white", fe.phoneNumber ? "border-danger" : "border-line")}>
                  <select name="phoneCode" value={f.phoneCode} onChange={set("phoneCode")} aria-label="Indicatif" className="border-r border-line bg-surface px-2 text-sm">{PHONE_CODES.map(([c, n]) => <option key={c} value={c}>{c} {n}</option>)}</select>
                  <input id="t-phone" name="phoneNumber" type="tel" value={f.phoneNumber} onChange={set("phoneNumber")} placeholder="07 07 07 07 07" className="min-w-0 flex-1 px-3 py-2.5 text-sm outline-none" aria-invalid={!!fe.phoneNumber} />
                </div>
                <Err e={fe.phoneNumber} />
              </div>
              <PhotoPicker url={photo.url} onChange={(path, url) => setPhoto({ path, url })} error={fe.photoPath?.[0]} />
            </div>
          </Section>

          <Section icon={Briefcase} title="Informations professionnelles" hint="Profil professionnel du formateur.">
            <div className="grid gap-4 md:grid-cols-2">
              <div><label htmlFor="t-job" className={lbl}>Poste / Titre <Req /></label><input id="t-job" name="jobTitle" value={f.jobTitle} onChange={set("jobTitle")} placeholder="Formateur en sécurité incendie" className={input} aria-invalid={!!fe.jobTitle} /><Err e={fe.jobTitle} /></div>
              <div><label htmlFor="t-main" className={lbl}>Spécialité principale <Req /></label>
                <select id="t-main" name="mainCategory" value={f.mainCategory} onChange={set("mainCategory")} className={input} aria-invalid={!!fe.mainCategory}>
                  <option value="">Choisir…</option>
                  {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select><Err e={fe.mainCategory} /></div>
            </div>
            {categories.length > 1 && (
              <fieldset className="mt-4">
                <legend className={lbl}>Autres spécialités</legend>
                <div className="flex flex-wrap gap-2">
                  {categories.filter((c) => c.id !== f.mainCategory).map((c) => {
                    const on = extra.includes(c.id);
                    return (
                      <label key={c.id} className={cn("cursor-pointer rounded-lg border px-3 py-1.5 text-xs font-semibold", on ? "border-brand bg-brand-soft text-brand" : "border-line text-brand-dark hover:bg-brand-soft/40")}>
                        <input type="checkbox" checked={on} onChange={() => setExtra(on ? extra.filter((x) => x !== c.id) : [...extra, c.id])} className="sr-only" />
                        {on && <Check className="mr-1 inline h-3 w-3" aria-hidden />}{c.name}
                      </label>
                    );
                  })}
                </div>
                <Err e={fe.extraCategories} />
              </fieldset>
            )}
            <div className="mt-4 grid gap-4 md:grid-cols-4">
              <div><label htmlFor="t-org" className={lbl}>Organisation <span className="font-normal text-muted">(optionnel)</span></label>
                <select id="t-org" name="organizationId" value={f.organizationId} onChange={set("organizationId")} className={input}>
                  <option value="">Aucune</option>
                  {organizations.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
                </select><Err e={fe.organizationId} /></div>
              <div><label htmlFor="t-contract" className={lbl}>Type de contrat <Req /></label>
                <select id="t-contract" name="contract" value={f.contract} onChange={set("contract")} className={input} aria-invalid={!!fe.contract}>
                  <option value="">Choisir…</option>
                  {(Object.keys(CONTRACTS) as ContractType[]).map((k) => <option key={k} value={k}>{CONTRACTS[k].label}</option>)}
                </select><Err e={fe.contract} /></div>
              <div><label htmlFor="t-exp" className={lbl}>Expérience (années) <Req /></label><input id="t-exp" name="experience" type="number" min={0} max={60} inputMode="numeric" value={f.experience} onChange={set("experience")} className={input} aria-invalid={!!fe.experience} /><Err e={fe.experience} /></div>
              <div><label htmlFor="t-city" className={lbl}>Ville de résidence</label>
                <div className="relative"><MapPin className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden /><input id="t-city" name="city" value={f.city} onChange={set("city")} placeholder="Abidjan" className={cn(input, "pl-9")} /></div><Err e={fe.city} /></div>
            </div>
          </Section>

          <Section icon={FileText} title="Biographie et compétences" hint="Présentez le formateur et ses domaines d’expertise.">
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label htmlFor="t-bio" className={lbl}>Biographie <Req /></label>
                <textarea id="t-bio" name="bio" rows={7} maxLength={BIO_MAX} value={f.bio} onChange={set("bio")} aria-invalid={!!fe.bio} className={input} />
                <p className="mt-1 text-right text-xs text-muted">{f.bio.length}/{BIO_MAX}</p><Err e={fe.bio} />
              </div>
              <div className="space-y-4">
                <TagInput name="skills" label="Compétences clés" initial={[]} mode="multi" placeholder="Ajouter une compétence" max={10} errors={fe.skills} />
                <TagInput name="diplomas" label="Diplômes et certifications (optionnel)" initial={[]} mode="multi" placeholder="Ajouter un diplôme" max={10} errors={fe.diplomas} />
              </div>
            </div>
          </Section>

          <Section icon={GraduationCap} title="Formations à animer" hint="Sélectionnez les formations que ce formateur pourra animer."
            aside={courses.length > 0 && (
              <label className="flex items-center gap-2 text-sm font-semibold text-brand">
                <input type="checkbox" checked={allVisiblePicked}
                  onChange={() => setPicked(allVisiblePicked ? picked.filter((id) => !visible.some((c) => c.id === id)) : [...new Set([...picked, ...visible.map((c) => c.id)])])} className="h-4 w-4" />
                Sélectionner tout
              </label>
            )}>
            {courses.length === 0 ? <p className="rounded-lg bg-surface p-4 text-sm text-muted">Aucune formation publiée pour le moment.</p> : (
              <>
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden />
                  <input type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Rechercher une formation…" aria-label="Rechercher une formation" className={cn(input, "pl-9")} />
                </div>
                <div className="mt-3 max-h-80 overflow-auto rounded-xl border border-line">
                  <table className="w-full min-w-[34rem] text-left text-sm">
                    <thead className="sticky top-0 bg-surface text-xs text-brand-dark"><tr><th className="w-10 px-3 py-2" /><th className="px-3 py-2 font-semibold">Formation</th><th className="px-3 py-2 font-semibold">Catégorie</th><th className="px-3 py-2 font-semibold">Durée</th><th className="px-3 py-2 font-semibold">Prix</th></tr></thead>
                    <tbody>
                      {visible.map((c) => (
                        <tr key={c.id} className="border-t border-line">
                          <td className="px-3 py-2"><input type="checkbox" checked={picked.includes(c.id)} onChange={() => toggleCourse(c.id)} aria-label={`Sélectionner ${c.title}`} className="h-4 w-4" /></td>
                          <td className="px-3 py-2">
                            <div className="flex items-center gap-3">
                              <span className="relative h-9 w-9 shrink-0 overflow-hidden rounded-md bg-brand-soft">{c.cover_url && <Image src={c.cover_url} alt="" fill sizes="36px" className="object-cover" unoptimized />}</span>
                              <span className="font-semibold text-brand-dark">{c.title}</span>
                            </div>
                          </td>
                          <td className="px-3 py-2">{c.category ? <span className="rounded-md bg-brand-soft px-2 py-0.5 text-xs font-semibold text-brand">{c.category}</span> : <span className="text-muted">—</span>}</td>
                          <td className="whitespace-nowrap px-3 py-2 text-brand-dark"><Clock className="mr-1 inline h-3.5 w-3.5 text-muted" aria-hidden />{formatMinutes(c.duration_minutes)}</td>
                          <td className="whitespace-nowrap px-3 py-2 font-semibold text-brand-dark">{nf.format(c.price_amount)} FCFA</td>
                        </tr>
                      ))}
                      {visible.length === 0 && <tr><td colSpan={5} className="px-3 py-6 text-center text-muted">Aucune formation ne correspond.</td></tr>}
                    </tbody>
                  </table>
                </div>
                <Err e={fe.courseId} />
              </>
            )}
          </Section>
        </div>

        <aside className="space-y-5 xl:sticky xl:top-4 xl:self-start">
          <section className="rounded-2xl border border-line bg-white p-5 shadow-card">
            <h2 className="mb-4 text-lg font-extrabold text-brand-dark">Aperçu du profil</h2>
            <div className="flex items-center gap-4">
              <Avatar name={f.fullName || "?"} src={photo.url} size={72} />
              <div className="min-w-0"><p className="text-lg font-extrabold text-brand-dark">{f.fullName || "Nouveau formateur"}</p>
                {f.email && <p className="truncate text-xs text-brand">{f.email}</p>}
                {f.phoneNumber && <p className="text-xs text-muted">{f.phoneCode} {f.phoneNumber}</p>}</div>
            </div>
            <dl className="mt-4 divide-y divide-line text-sm">
              {([
                [Briefcase, "Poste", f.jobTitle || "—"],
                [Building2, "Organisation", org?.name ?? "—"],
                [ShieldCheck, "Type de contrat", f.contract ? CONTRACTS[f.contract as ContractType].label : "—"],
                [Award, "Expérience", f.experience !== "" ? `${f.experience} an${Number(f.experience) > 1 ? "s" : ""}` : "—"],
              ] as const).map(([I, l, v]) => (
                <div key={l} className="flex items-center justify-between gap-3 py-2"><dt className="flex items-center gap-2 text-brand-dark"><I className="h-4 w-4 text-muted" aria-hidden />{l}</dt><dd className="text-right text-brand-dark">{v}</dd></div>
              ))}
              <div className="flex items-start justify-between gap-3 py-2"><dt className="flex items-center gap-2 text-brand-dark"><Star className="h-4 w-4 text-muted" aria-hidden />Spécialités</dt>
                <dd className="flex flex-wrap justify-end gap-1">{shownSpecialties.length ? shownSpecialties.map((c, i) => <span key={c} className={cn("rounded-md px-2 py-0.5 text-xs font-semibold", TONES[i % TONES.length])}>{catName(c)}</span>) : "—"}</dd></div>
              <div className="flex items-center justify-between gap-3 py-2"><dt className="flex items-center gap-2 text-brand-dark"><BookOpen className="h-4 w-4 text-muted" aria-hidden />Formations</dt><dd className="text-brand-dark">{picked.length} formation{picked.length > 1 ? "s" : ""} sélectionnée{picked.length > 1 ? "s" : ""}</dd></div>
            </dl>
          </section>

          <section className="rounded-2xl border border-line bg-white p-5 shadow-card">
            <h2 className="flex items-center gap-2 text-base font-extrabold text-brand-dark"><Lock className="h-5 w-5 text-brand" aria-hidden />Rôles et accès</h2>
            <p className="mt-1 text-xs text-muted">Le compte est créé avec le rôle Formateur.</p>
            <label className="mt-3 flex items-start gap-3 text-sm"><input type="checkbox" checked disabled className="mt-1 h-4 w-4" />
              <span><span className="font-bold text-brand-dark">Formateur</span><span className="block text-xs text-muted">Peut animer des formations, gérer ses sessions et évaluer les apprenants.</span></span></label>
            <fieldset className="mt-4">
              <legend className={lbl}>Mot de passe</legend>
              <div className="flex flex-wrap gap-4 py-1 text-sm text-brand-dark">
                <label className="flex items-center gap-2"><input type="radio" name="passwordMode" value="auto" checked={f.passwordMode === "auto"} onChange={set("passwordMode")} /> Générer automatiquement</label>
                <label className="flex items-center gap-2"><input type="radio" name="passwordMode" value="manual" checked={f.passwordMode === "manual"} onChange={set("passwordMode")} /> Définir un mot de passe</label>
              </div>
              {f.passwordMode === "manual" && (
                <div className="mt-2"><label htmlFor="t-pass" className="sr-only">Mot de passe</label><input id="t-pass" name="password" type="password" autoComplete="new-password" className={input} aria-invalid={!!fe.password} /><Err e={fe.password} />
                  <p className="mt-1 text-xs text-muted">10 caractères minimum, avec au moins une lettre et un chiffre.</p></div>
              )}
            </fieldset>
            <p className="mt-3 flex items-start gap-2 rounded-lg bg-brand-soft p-3 text-xs text-brand-dark"><Info className="mt-0.5 h-4 w-4 shrink-0 text-brand" aria-hidden />Le compte est créé déjà confirmé. Aucun e-mail n’est envoyé : {f.passwordMode === "auto" ? "le mot de passe généré vous est affiché une seule fois à la création." : "transmettez vous-même le mot de passe défini."}</p>
          </section>

          <div className="flex gap-3">
            <Link href="/admin/formateurs" className="inline-flex flex-1 items-center justify-center rounded-lg border border-brand bg-white px-5 py-3 text-sm font-semibold text-brand hover:bg-brand-soft">Annuler</Link>
            <button type="submit" disabled={pending} className="inline-flex flex-[1.6] items-center justify-center gap-2 rounded-lg bg-brand px-5 py-3 text-sm font-semibold text-white hover:bg-brand-dark disabled:opacity-60">
              <UserPlus className="h-4 w-4" aria-hidden /> {pending ? "Création…" : "Créer le formateur"}
            </button>
          </div>
        </aside>
      </div>
    </form>
  );
}
