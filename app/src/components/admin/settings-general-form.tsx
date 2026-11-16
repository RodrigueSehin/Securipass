"use client";

import { useId, useState } from "react";
import Image from "next/image";
import { Bell, Calendar, Clock, Coins, Globe, Info, Mail, MapPin, MonitorCog, Palette, Phone, RefreshCw, Save, SlidersHorizontal, Trash2, Upload, Users, Wrench } from "lucide-react";
import { CURRENCIES, DATE_FORMATS, TIMEZONES, TIME_FORMATS, type BoolField, type PlatformSettings } from "@/lib/admin/settings";
import { updatePlatformSettings } from "@/lib/admin/settings-actions";
import { cn } from "@/lib/utils";

const card = "rounded-2xl border border-line bg-white p-5 shadow-card";
const input = "w-full rounded-lg border border-line bg-white px-3 py-2.5 text-sm text-brand-dark outline-none focus:border-brand focus:ring-2 focus:ring-brand/20";
const HEX = /^#[0-9a-f]{6}$/i;
const COLORS = [["color_primary", "Couleur principale"], ["color_secondary", "Couleur secondaire"], ["color_accent", "Couleur d’accent"]] as const;
const TOGGLES: { name: BoolField; icon: typeof Users; title: string; text: string }[] = [
  { name: "allow_registrations", icon: Users, title: "Autoriser les inscriptions en ligne", text: "Permettre aux apprenants de créer un compte et de s’inscrire." },
  { name: "email_notifications", icon: Mail, title: "Activer les notifications par email", text: "Envoyer les notifications importantes par email." },
  { name: "sms_notifications", icon: Bell, title: "Activer les notifications SMS", text: "Envoyer les notifications essentielles par SMS." },
  { name: "maintenance_mode", icon: Wrench, title: "Mode maintenance", text: "Mettre la plateforme temporairement hors ligne." },
];

function Field({ label, required, children, id }: { label: string; required?: boolean; children: React.ReactNode; id: string }) {
  return <div><label htmlFor={id} className="mb-1 block text-sm font-bold text-brand-dark">{label}{required && <span className="text-danger"> *</span>}</label>{children}</div>;
}
function IconInput({ icon: Icon, children }: { icon: typeof Mail; children: React.ReactNode }) {
  return <div className="relative"><Icon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-brand" aria-hidden />{children}</div>;
}
function Switch({ name, checked, onChange, label }: { name: BoolField; checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <>
      <input type="hidden" name={name} value={checked ? "true" : "false"} />
      <button type="button" role="switch" aria-checked={checked} aria-label={label} onClick={() => onChange(!checked)}
        className={cn("relative h-7 w-12 shrink-0 rounded-full transition-colors", checked ? "bg-brand" : "bg-[#b8c0cc]")}>
        <span className={cn("absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-all", checked ? "left-[1.4rem]" : "left-0.5")} />
      </button>
    </>
  );
}

/** Page « Paramètres généraux » : un seul formulaire ; « Réinitialiser » rétablit les valeurs enregistrées. */
export function SettingsGeneralForm({ settings }: { settings: PlatformSettings }) {
  const [version, setVersion] = useState(0);
  return <Inner key={version} settings={settings} onReset={() => setVersion((v) => v + 1)} />;
}

function Inner({ settings, onReset }: { settings: PlatformSettings; onReset: () => void }) {
  const uid = useId();
  const [description, setDescription] = useState(settings.description);
  const [colors, setColors] = useState({ color_primary: settings.color_primary, color_secondary: settings.color_secondary, color_accent: settings.color_accent });
  const [toggles, setToggles] = useState<Record<BoolField, boolean>>({
    allow_registrations: settings.allow_registrations, email_notifications: settings.email_notifications, sms_notifications: settings.sms_notifications, maintenance_mode: settings.maintenance_mode,
  });
  const colorsValid = Object.values(colors).every((c) => HEX.test(c));
  const disabledBtn = "inline-flex items-center justify-center gap-2 rounded-lg border border-line bg-white px-4 py-2.5 text-sm font-semibold opacity-50 cursor-not-allowed";
  const id = (n: string) => `${uid}-${n}`;

  return (
    <form action={updatePlatformSettings} className="space-y-6">
      <input type="hidden" name="back" value="/admin/parametres/general" />
      <div className="grid items-start gap-6 xl:grid-cols-2">
        <div className={cn(card, "space-y-5")}>
          <div>
            <h2 className="flex items-center gap-3 text-xl font-extrabold text-brand-dark"><span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand text-white" aria-hidden><Info className="h-5 w-5" /></span>Informations de la plateforme</h2>
            <p className="mt-1 text-sm text-muted">Informations générales et identité de votre plateforme.</p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field id={id("name")} label="Nom de la plateforme" required><input id={id("name")} name="name" defaultValue={settings.name} required minLength={2} maxLength={80} className={input} /></Field>
            <Field id={id("tagline")} label="Slogan (optionnel)"><input id={id("tagline")} name="tagline" defaultValue={settings.tagline} maxLength={120} className={input} /></Field>
          </div>
          <Field id={id("description")} label="Description de la plateforme" required>
            <textarea id={id("description")} name="description" value={description} onChange={(e) => setDescription(e.target.value)} required maxLength={250} rows={3} className={input} />
            <p className="mt-1 text-right text-xs text-muted">{description.length} / 250</p>
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field id={id("sender_email")} label="Email d’expédition (notifications)" required><IconInput icon={Mail}><input id={id("sender_email")} name="sender_email" type="email" defaultValue={settings.sender_email} required maxLength={200} className={cn(input, "pl-9")} /></IconInput></Field>
            <Field id={id("contact_phone")} label="Téléphone de contact"><IconInput icon={Phone}><input id={id("contact_phone")} name="contact_phone" type="tel" defaultValue={settings.contact_phone} maxLength={40} className={cn(input, "pl-9")} /></IconInput></Field>
            <Field id={id("website")} label="Site web (optionnel)"><IconInput icon={Globe}><input id={id("website")} name="website" type="url" defaultValue={settings.website} maxLength={200} placeholder="https://" className={cn(input, "pl-9")} /></IconInput></Field>
            <Field id={id("address")} label="Adresse (optionnelle)"><IconInput icon={MapPin}><input id={id("address")} name="address" defaultValue={settings.address} maxLength={200} className={cn(input, "pl-9")} /></IconInput></Field>
          </div>

          <div className="border-t border-line pt-5">
            <h2 className="flex items-center gap-3 text-xl font-extrabold text-brand-dark"><SlidersHorizontal className="h-6 w-6 text-brand" aria-hidden />Paramètres système</h2>
            <p className="mb-4 mt-1 text-sm text-muted">Configuration générale du comportement de la plateforme.</p>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field id={id("timezone")} label="Fuseau horaire" required><IconInput icon={Globe}><select id={id("timezone")} name="timezone" defaultValue={settings.timezone} className={cn(input, "pl-9")}>{Object.entries(TIMEZONES).map(([v, t]) => <option key={v} value={v}>{t}</option>)}</select></IconInput></Field>
              <Field id={id("date_format")} label="Format de date" required><IconInput icon={Calendar}><select id={id("date_format")} name="date_format" defaultValue={settings.date_format} className={cn(input, "pl-9")}>{Object.entries(DATE_FORMATS).map(([v, t]) => <option key={v} value={v}>{t}</option>)}</select></IconInput></Field>
              <Field id={id("time_format")} label="Format d’heure" required><IconInput icon={Clock}><select id={id("time_format")} name="time_format" defaultValue={settings.time_format} className={cn(input, "pl-9")}>{Object.entries(TIME_FORMATS).map(([v, t]) => <option key={v} value={v}>{t}</option>)}</select></IconInput></Field>
              <Field id={id("currency")} label="Devise" required><IconInput icon={Coins}><select id={id("currency")} name="currency" defaultValue={settings.currency} className={cn(input, "pl-9")}>{Object.entries(CURRENCIES).map(([v, t]) => <option key={v} value={v}>{t}</option>)}</select></IconInput></Field>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <section className={card}>
            <h2 className="flex items-center gap-3 text-xl font-extrabold text-brand-dark"><Palette className="h-6 w-6 text-brand" aria-hidden />Identité visuelle</h2>
            <p className="mb-4 mt-1 text-sm text-muted">Logo et couleurs de la plateforme.</p>
            <div className="grid gap-5 md:grid-cols-2">
              <div>
                <h3 className="mb-2 text-sm font-extrabold text-brand-dark">Logo de la plateforme</h3>
                <div className="flex h-44 items-center justify-center rounded-xl border-2 border-dashed border-brand/40 bg-white p-4"><Image src="/images/brand/logo.png" alt="Logo SECURIPASS" width={220} height={110} className="max-h-full w-auto object-contain" /></div>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <button type="button" disabled title="Changement de logo : bientôt disponible" className={cn(disabledBtn, "text-brand")}><Upload className="h-4 w-4" aria-hidden />Changer le logo</button>
                  <button type="button" disabled title="Bientôt disponible" className={cn(disabledBtn, "text-danger")}><Trash2 className="h-4 w-4" aria-hidden />Supprimer</button>
                </div>
              </div>
              <div>
                <h3 className="mb-2 text-sm font-extrabold text-brand-dark">Couleurs de la plateforme</h3>
                <div className="space-y-3">
                  {COLORS.map(([name, label]) => (
                    <div key={name}>
                      <label htmlFor={id(name)} className="mb-1 block text-sm font-bold text-brand-dark">{label}</label>
                      <div className="flex items-center gap-2">
                        <input type="color" aria-label={`${label} : sélecteur`} value={HEX.test(colors[name]) ? colors[name] : "#000000"} onChange={(e) => setColors({ ...colors, [name]: e.target.value.toUpperCase() })} className="h-10 w-10 shrink-0 cursor-pointer rounded-lg border border-line bg-white p-0.5" />
                        <input id={id(name)} name={name} value={colors[name]} onChange={(e) => setColors({ ...colors, [name]: e.target.value.toUpperCase() })} maxLength={7} pattern="#[0-9A-Fa-f]{6}" className={input} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </section>

          <section className={card}>
            <h2 className="mb-2 flex items-center gap-3 text-xl font-extrabold text-brand-dark"><MonitorCog className="h-6 w-6 text-brand" aria-hidden />Options générales</h2>
            <ul className="divide-y divide-line">
              {TOGGLES.map(({ name, icon: Icon, title, text }) => (
                <li key={name} className="flex items-center gap-4 py-3">
                  <Icon className="h-6 w-6 shrink-0 text-brand" aria-hidden />
                  <div className="min-w-0 flex-1"><p className="text-sm font-extrabold text-brand-dark">{title}</p><p className="text-xs text-muted">{text}</p></div>
                  <Switch name={name} checked={toggles[name]} onChange={(v) => setToggles({ ...toggles, [name]: v })} label={title} />
                </li>
              ))}
            </ul>
            <p className="mt-2 text-xs text-muted">Ces options sont enregistrées ; leur application au reste de la plateforme (inscriptions, envois, maintenance) sera branchée dans un prochain lot.</p>
          </section>
        </div>
      </div>

      <div className={cn(card, "flex flex-wrap justify-end gap-3")}>
        <button type="button" onClick={onReset} className="inline-flex items-center gap-2 rounded-lg border border-brand bg-white px-6 py-2.5 text-sm font-semibold text-brand hover:bg-brand-soft"><RefreshCw className="h-4 w-4" aria-hidden />Réinitialiser</button>
        <button disabled={!colorsValid} className="inline-flex items-center gap-2 rounded-lg bg-brand px-6 py-2.5 text-sm font-semibold text-white hover:bg-brand-dark disabled:cursor-not-allowed disabled:opacity-50"><Save className="h-4 w-4" aria-hidden />Enregistrer les modifications</button>
      </div>
    </form>
  );
}
