"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Building2, Image as ImageIcon, MapPin, RotateCcw, Save, Settings, Users, type LucideIcon } from "lucide-react";
import { Alert } from "@/components/ui/feedback";
import { FileUpload } from "@/components/ui/file-upload";
import { Switch } from "@/components/ui/switch";
import { COUNTRIES, DESCRIPTION_MAX, LEGAL_FORMS, PARTNERSHIPS, SECTORS } from "@/lib/admin/companies";
import { createCompany } from "@/lib/admin/companies-create";
import type { FormState } from "@/lib/auth/actions";
import { cn } from "@/lib/utils";

const input = "w-full rounded-lg border border-line bg-white px-3 py-2.5 text-sm text-brand-dark outline-none focus:border-brand focus:ring-2 focus:ring-brand/20";
const lbl = "mb-1 block text-sm font-semibold text-brand-dark";

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

/** Création d'une entreprise : informations générales, adresse, identité visuelle, contacts et paramètres. */
export function CreateCompanyForm() {
  const [state, action, pending] = useActionState<FormState, FormData>(createCompany, {});
  const [formKey, setFormKey] = useState(0);
  return <Inner key={formKey} state={state} action={action} pending={pending} reset={() => setFormKey((k) => k + 1)} />;
}

function Inner({ state, action, pending, reset }: { state: FormState; action: (f: FormData) => void; pending: boolean; reset: () => void }) {
  const fe = state.fieldErrors ?? {};
  const sv = state.values ?? {};
  const [desc, setDesc] = useState(sv.description ?? "");
  const [second, setSecond] = useState(sv.hasSecondary === "1");
  const [allow, setAllow] = useState(sv.allowEnrollments !== "0");
  const [invoicing, setInvoicing] = useState(sv.invoicing === "1");
  const [primary, setPrimary] = useState(sv.primaryColor || "#1F3F6D");
  const [secondary, setSecondary] = useState(sv.secondaryColor || "#EED58E");
  const field = (name: string, label: string, o: { required?: boolean; type?: string; placeholder?: string; max?: number } = {}) => (
    <div><label htmlFor={`c-${name}`} className={lbl}>{label} {o.required && <Req />}</label>
      <input id={`c-${name}`} name={name} type={o.type ?? "text"} defaultValue={sv[name] ?? ""} maxLength={o.max} placeholder={o.placeholder} className={input} aria-invalid={!!fe[name]} /><Err e={fe[name]} /></div>
  );
  const pick = (name: string, label: string, options: readonly (string | readonly [string, string])[], o: { required?: boolean; def?: string } = {}) => (
    <div><label htmlFor={`c-${name}`} className={lbl}>{label} {o.required && <Req />}</label>
      <select id={`c-${name}`} name={name} defaultValue={sv[name] ?? o.def ?? ""} className={input} aria-invalid={!!fe[name]}>
        {!o.def && <option value="">Choisir…</option>}
        {options.map((x) => (typeof x === "string" ? <option key={x} value={x}>{x}</option> : <option key={x[0]} value={x[0]}>{x[1]}</option>))}
      </select><Err e={fe[name]} /></div>
  );

  return (
    <form action={action} noValidate className="space-y-6">
      {state.error && <Alert>{state.error}</Alert>}
      <div className="grid gap-6 xl:grid-cols-2">
        <div className="space-y-6">
          <Section icon={Building2} title="Informations générales">
            <div className="grid gap-4 md:grid-cols-2">
              {field("name", "Raison sociale", { required: true, max: 150 })}
              {field("shortName", "Sigle / Nom court", { max: 60 })}
              {pick("legalForm", "Forme juridique", LEGAL_FORMS, { required: true })}
              {field("registration", "N° RCCM / Registre de commerce", { required: true, max: 60 })}
              {field("taxId", "N° d’identification fiscale (NIF)", { required: true, max: 40 })}
              {pick("sector", "Secteur d’activité", SECTORS, { required: true })}
            </div>
            <div className="mt-4">
              <label htmlFor="c-desc" className={lbl}>Description</label>
              <textarea id="c-desc" name="description" rows={4} maxLength={DESCRIPTION_MAX} value={desc} onChange={(e) => setDesc(e.target.value)} className={input} />
              <p className="mt-1 text-right text-xs text-muted">{desc.length} / {DESCRIPTION_MAX}</p><Err e={fe.description} />
            </div>
          </Section>

          <Section icon={MapPin} title="Adresse et localisation">
            <div className="grid gap-4 md:grid-cols-3">
              {pick("country", "Pays", COUNTRIES, { required: true, def: "CI" })}
              {field("city", "Ville", { required: true, max: 100, placeholder: "Abidjan" })}
              {field("commune", "Commune", { max: 100, placeholder: "Cocody" })}
            </div>
            <div className="mt-4">{field("address", "Adresse complète", { required: true, max: 300, placeholder: "Boulevard Mitterrand, Immeuble Zénith" })}</div>
          </Section>

          <Section icon={ImageIcon} title="Identité visuelle" hint="Optionnelle">
            <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
              <div>
                <FileUpload name="logoUrl" label="Logo" bucket="company-logos" accept={["image/jpeg", "image/png", "image/webp"]} maxMb={2} store="url" hint="PNG, JPG ou WebP (2 Mo max)." />
                <Err e={fe.logoUrl} />
              </div>
              <div className="space-y-3">
                {([["primaryColor", "Couleur principale", primary, setPrimary], ["secondaryColor", "Couleur secondaire", secondary, setSecondary]] as const).map(([name, label, value, set]) => (
                  <div key={name}><label htmlFor={`c-${name}`} className={lbl}>{label}</label>
                    <div className="flex items-center gap-3 rounded-lg border border-line bg-white px-3 py-2">
                      <input id={`c-${name}`} name={name} type="color" value={value} onChange={(e) => set(e.target.value.toUpperCase())} className="h-8 w-10 cursor-pointer rounded border-0 bg-transparent p-0" />
                      <span className="text-sm font-semibold text-brand-dark">{value}</span>
                    </div><Err e={fe[name]} /></div>
                ))}
              </div>
            </div>
          </Section>
        </div>

        <div className="space-y-6">
          <Section icon={Users} title="Contacts de l’entreprise">
            <p className="mb-3 text-sm font-semibold text-brand-dark">Contact principal (référent formation)</p>
            <div className="grid gap-4 md:grid-cols-2">
              {field("contactName", "Nom et prénom", { required: true, max: 120 })}
              {field("contactRole", "Fonction", { required: true, max: 120, placeholder: "Responsable RH" })}
              {field("contactPhone", "Téléphone", { required: true, type: "tel", placeholder: "+225 07 07 08 09 10" })}
              {field("contactEmail", "E-mail", { required: true, type: "email" })}
            </div>
            <div className="mt-5 rounded-xl bg-brand-soft/60 p-4">
              <div className="flex items-center gap-3"><Switch name="hasSecondary" label="Ajouter un contact secondaire" on={second} onChange={setSecond} /><span className="text-sm font-semibold text-brand-dark">Ajouter un contact secondaire</span></div>
              {second && (
                <div className="mt-4 grid gap-4 md:grid-cols-2">
                  {field("contact2Name", "Nom et prénom", { required: true, max: 120 })}
                  {field("contact2Role", "Fonction", { max: 120 })}
                  {field("contact2Phone", "Téléphone", { type: "tel" })}
                  {field("contact2Email", "E-mail", { type: "email" })}
                </div>
              )}
            </div>
          </Section>

          <Section icon={Settings} title="Paramètres">
            <div className="grid gap-4 md:grid-cols-2">
              <div><label htmlFor="c-status" className={lbl}>Statut <Req /></label>
                <select id="c-status" name="status" defaultValue={sv.status ?? "active"} className={input}><option value="active">Active</option><option value="pending">En attente</option><option value="suspended">Suspendue</option></select><Err e={fe.status} /></div>
              <div><label htmlFor="c-partnership" className={lbl}>Type de partenariat</label>
                <select id="c-partnership" name="partnership" defaultValue={sv.partnership ?? "client"} className={input}>{Object.entries(PARTNERSHIPS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select><Err e={fe.partnership} /></div>
            </div>
            <div className="mt-5 space-y-4">
              <div className="flex items-start gap-3"><Switch name="allowEnrollments" label="Autoriser les inscriptions par l’entreprise" on={allow} onChange={setAllow} className="pt-0.5" />
                <div><p className="text-sm font-semibold text-brand-dark">Autoriser les inscriptions par l’entreprise</p><p className="text-xs text-muted">Permet à l’entreprise d’inscrire ses employés aux formations.</p></div></div>
              <div className="flex items-start gap-3"><Switch name="invoicing" label="Activer la facturation" on={invoicing} onChange={setInvoicing} className="pt-0.5" />
                <div><p className="text-sm font-semibold text-brand-dark">Activer la facturation</p><p className="text-xs text-muted">Générer des factures pour les formations de cette entreprise.</p></div></div>
            </div>
          </Section>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link href="/admin/entreprises" className="inline-flex items-center gap-2 rounded-lg border border-brand bg-white px-5 py-2.5 text-sm font-semibold text-brand hover:bg-brand-soft"><ArrowLeft className="h-4 w-4" aria-hidden /> Retour à la liste</Link>
        <div className="flex gap-3">
          <button type="button" onClick={reset} className="inline-flex items-center gap-2 rounded-lg border border-brand bg-white px-5 py-2.5 text-sm font-semibold text-brand hover:bg-brand-soft"><RotateCcw className="h-4 w-4" aria-hidden /> Réinitialiser</button>
          <button type="submit" disabled={pending} className="inline-flex items-center gap-2 rounded-lg bg-brand px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-dark disabled:opacity-60"><Save className="h-4 w-4" aria-hidden /> {pending ? "Enregistrement…" : "Enregistrer l’entreprise"}</button>
        </div>
      </div>
    </form>
  );
}
