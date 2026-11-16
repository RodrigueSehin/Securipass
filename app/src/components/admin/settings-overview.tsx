"use client";

import { useState } from "react";
import { Building2, Check, CircleDollarSign, Clock, Globe, Mail, Pencil, ShieldCheck, X } from "lucide-react";
import { CURRENCIES, LANGUAGES, TIMEZONES, type PlatformSettings, type SettingsField } from "@/lib/admin/settings";
import { updatePlatformSettings } from "@/lib/admin/settings-actions";

type Row = { field: SettingsField; label: string; icon: typeof Globe; options?: Record<string, string>; type?: string };
const ROWS: Row[] = [
  { field: "name", label: "Nom de la plateforme", icon: Building2 },
  { field: "default_language", label: "Langue par défaut", icon: Globe, options: LANGUAGES },
  { field: "currency", label: "Devise", icon: CircleDollarSign, options: CURRENCIES },
  { field: "timezone", label: "Fuseau horaire", icon: Clock, options: TIMEZONES },
  { field: "sender_email", label: "Email d’expédition", icon: Mail, type: "email" },
];

/** Aperçu de la configuration : chaque valeur se modifie sur place (crayon), une à la fois. */
export function SettingsOverview({ settings }: { settings: PlatformSettings }) {
  const [editing, setEditing] = useState<SettingsField | null>(null);
  return (
    <ul className="divide-y divide-line">
      {ROWS.map(({ field, label, icon: Icon, options, type }) => (
        <li key={field} className="grid grid-cols-[minmax(0,12rem)_minmax(0,1fr)_auto] items-center gap-3 py-3 text-sm">
          <span className="flex items-center gap-3 font-bold text-brand-dark"><Icon className="h-5 w-5 shrink-0 text-brand" aria-hidden />{label}</span>
          {editing === field ? (
            <form id={`f-${field}`} action={updatePlatformSettings} className="col-span-2 col-start-2 flex items-center gap-2">
              {options ? (
                <select name={field} defaultValue={String(settings[field])} aria-label={label} className="min-w-0 flex-1 rounded-lg border border-line bg-white px-3 py-2 text-sm">
                  {Object.entries(options).map(([v, text]) => <option key={v} value={v}>{text}</option>)}
                </select>
              ) : <input name={field} type={type ?? "text"} defaultValue={String(settings[field])} aria-label={label} required maxLength={field === "name" ? 80 : 200} className="min-w-0 flex-1 rounded-lg border border-line bg-white px-3 py-2 text-sm" />}
              <button aria-label={`Enregistrer : ${label}`} className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand text-white hover:bg-brand-dark"><Check className="h-4 w-4" aria-hidden /></button>
              <button type="button" onClick={() => setEditing(null)} aria-label="Annuler" className="flex h-9 w-9 items-center justify-center rounded-lg border border-line text-brand-dark hover:bg-surface"><X className="h-4 w-4" aria-hidden /></button>
            </form>
          ) : (
            <>
              <span className="min-w-0 truncate text-brand-dark">{options ? options[String(settings[field])] ?? String(settings[field]) : String(settings[field])}</span>
              <button type="button" onClick={() => setEditing(field)} aria-label={`Modifier : ${label}`} className="flex h-9 w-9 items-center justify-center rounded-lg border border-line text-brand hover:bg-brand-soft"><Pencil className="h-4 w-4" aria-hidden /></button>
            </>
          )}
        </li>
      ))}
      <li className="grid grid-cols-[minmax(0,12rem)_minmax(0,1fr)_auto] items-center gap-3 py-3 text-sm">
        <span className="flex items-center gap-3 font-bold text-brand-dark"><ShieldCheck className="h-5 w-5 shrink-0 text-brand" aria-hidden />Authentification à deux facteurs (2FA)</span>
        <span className="text-muted">Non disponible</span>
        <span aria-hidden className="h-9 w-9" />
      </li>
    </ul>
  );
}
