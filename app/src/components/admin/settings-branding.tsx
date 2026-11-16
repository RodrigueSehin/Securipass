"use client";

import { useState } from "react";
import Image from "next/image";
import { Eye, RefreshCw, Save, Trash2, Upload } from "lucide-react";
import { resetPlatformColors, updatePlatformSettings } from "@/lib/admin/settings-actions";
import type { PlatformSettings } from "@/lib/admin/settings";
import { cn } from "@/lib/utils";

const COLORS = [["color_primary", "Couleur principale"], ["color_secondary", "Couleur secondaire"], ["color_accent", "Couleur d’accent"]] as const;
const HEX = /^#[0-9a-f]{6}$/i;

/** Personnalisation rapide : logo (lecture seule pour l'instant) et trois couleurs avec aperçu avant enregistrement. */
export function SettingsBranding({ settings }: { settings: PlatformSettings }) {
  const [colors, setColors] = useState({ color_primary: settings.color_primary, color_secondary: settings.color_secondary, color_accent: settings.color_accent });
  const [preview, setPreview] = useState(false);
  const valid = Object.values(colors).every((c) => HEX.test(c));
  const disabledBtn = "inline-flex items-center justify-center gap-2 rounded-lg border border-line bg-white px-4 py-2.5 text-sm font-semibold opacity-50 cursor-not-allowed";

  return (
    <form action={updatePlatformSettings}>
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-xl font-extrabold text-brand-dark">Personnalisation rapide</h2>
        <button type="button" onClick={() => setPreview((p) => !p)} aria-pressed={preview} className="inline-flex items-center gap-2 rounded-lg border border-brand bg-white px-4 py-2 text-sm font-semibold text-brand hover:bg-brand-soft"><Eye className="h-4 w-4" aria-hidden />Aperçu</button>
      </div>
      <div className="grid gap-6 md:grid-cols-2">
        <div>
          <h3 className="mb-2 text-sm font-extrabold text-brand-dark">Logo de la plateforme</h3>
          <div className="flex h-44 items-center justify-center rounded-xl border-2 border-dashed border-brand/40 bg-white p-4">
            <Image src="/images/brand/logo.png" alt="Logo SECURIPASS" width={220} height={110} className="max-h-full w-auto object-contain" />
          </div>
          <div className="mt-3 grid grid-cols-[1fr_auto] gap-2">
            <button type="button" disabled title="Changement de logo : bientôt disponible" className={cn(disabledBtn, "text-brand")}><Upload className="h-4 w-4" aria-hidden />Changer le logo</button>
            <button type="button" disabled aria-label="Supprimer le logo" title="Bientôt disponible" className={cn(disabledBtn, "text-danger")}><Trash2 className="h-4 w-4" aria-hidden /></button>
          </div>
        </div>
        <div>
          <h3 className="mb-2 text-sm font-extrabold text-brand-dark">Couleurs de la plateforme</h3>
          <div className="space-y-3">
            {COLORS.map(([name, label]) => (
              <div key={name}>
                <label htmlFor={name} className="mb-1 block text-sm font-bold text-brand-dark">{label}</label>
                <div className="flex items-center gap-2">
                  <input type="color" aria-label={`${label} : sélecteur`} value={HEX.test(colors[name]) ? colors[name] : "#000000"} onChange={(e) => setColors({ ...colors, [name]: e.target.value.toUpperCase() })} className="h-10 w-10 shrink-0 cursor-pointer rounded-lg border border-line bg-white p-0.5" />
                  <input id={name} name={name} value={colors[name]} onChange={(e) => setColors({ ...colors, [name]: e.target.value.toUpperCase() })} maxLength={7} pattern="#[0-9A-Fa-f]{6}" aria-invalid={!HEX.test(colors[name])}
                    className="min-w-0 flex-1 rounded-lg border border-line bg-white px-3 py-2 text-sm text-brand-dark" />
                </div>
              </div>
            ))}
          </div>
          {preview && valid && (
            <div role="status" className="mt-3 rounded-lg border border-line p-3 text-sm" aria-label="Aperçu des couleurs">
              <p className="mb-2 text-xs text-muted">Aperçu (non enregistré)</p>
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-lg px-3 py-1.5 font-semibold text-white" style={{ background: colors.color_primary }}>Principale</span>
                <span className="rounded-lg px-3 py-1.5 font-semibold text-brand-dark" style={{ background: colors.color_secondary }}>Secondaire</span>
                <span className="rounded-lg px-3 py-1.5 font-semibold text-white" style={{ background: colors.color_accent }}>Accent</span>
              </div>
            </div>
          )}
        </div>
      </div>
      <p className="mt-3 text-xs text-muted">Les couleurs sont enregistrées ; leur application à l’ensemble de l’interface sera branchée dans un prochain lot.</p>
      <div className="mt-4 flex flex-wrap justify-end gap-3">
        <button type="submit" formAction={resetPlatformColors} formNoValidate className="inline-flex items-center gap-2 rounded-lg border border-brand bg-white px-5 py-2.5 text-sm font-semibold text-brand hover:bg-brand-soft"><RefreshCw className="h-4 w-4" aria-hidden />Réinitialiser</button>
        <button disabled={!valid} className="inline-flex items-center gap-2 rounded-lg bg-brand px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-dark disabled:cursor-not-allowed disabled:opacity-50"><Save className="h-4 w-4" aria-hidden />Enregistrer les modifications</button>
      </div>
    </form>
  );
}
