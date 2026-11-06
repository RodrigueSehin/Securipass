"use client";

import { useState } from "react";
import Image from "next/image";
import { BookOpen, Info, Monitor, Smartphone } from "lucide-react";
import { cn } from "@/lib/utils";

export const PREVIEW_TABS = [
  { id: "presentation", label: "Présentation" },
  { id: "programme", label: "Programme" },
  { id: "objectifs", label: "Objectifs" },
  { id: "public", label: "Public cible" },
  { id: "prerequis", label: "Prérequis" },
  { id: "evaluation", label: "Évaluation" },
  { id: "certification", label: "Certification" },
  { id: "avis", label: "Avis" },
] as const;
export type PreviewTab = (typeof PREVIEW_TABS)[number]["id"];

const VIEWS = [
  { id: "learner", label: "Vue apprenant", short: "Apprenant", icon: Monitor },
  { id: "mobile", label: "Vue mobile", short: "Mobile", icon: Smartphone },
  { id: "technical", label: "Détails techniques", short: "Technique", icon: Info },
] as const;
type View = (typeof VIEWS)[number]["id"];

export type PreviewHero = { title: string; summary: string; cover: string | null; certifying: boolean; facts: string[] };

/**
 * Aperçu d'une formation comme la verront les apprenants : bandeau, onglets de contenu, vue mobile (cadre étroit)
 * et détails techniques. Le contenu de chaque onglet est préparé côté serveur à partir des données enregistrées.
 */
export function PreviewShell({ hero, panels, technical }: {
  hero: PreviewHero; panels: Record<PreviewTab, React.ReactNode>; technical: React.ReactNode;
}) {
  const [view, setView] = useState<View>("learner");
  const [tab, setTab] = useState<PreviewTab>("presentation");

  return (
    <div>
      <div role="tablist" aria-label="Type d’aperçu" className="mb-4 grid grid-cols-3 overflow-hidden rounded-xl border border-line text-sm font-semibold">
        {VIEWS.map((v) => (
          <button key={v.id} role="tab" aria-selected={view === v.id} onClick={() => setView(v.id)} type="button"
            className={cn("flex items-center justify-center gap-2 px-3 py-2.5", view === v.id ? "bg-brand text-white" : "bg-white text-brand-dark hover:bg-brand-soft")}>
            <v.icon className="h-4 w-4" aria-hidden /><span className="hidden sm:inline">{v.label}</span><span className="sm:hidden">{v.short}</span>
          </button>
        ))}
      </div>

      {view === "technical" ? technical : (
        <div className={cn("overflow-hidden rounded-2xl border border-line bg-white", view === "mobile" && "mx-auto max-w-sm")}>
          <div className="relative overflow-hidden bg-[linear-gradient(135deg,#092a66,#0639d9)] text-white">
            {hero.cover
              ? <Image src={hero.cover} alt="" fill sizes="(min-width: 1280px) 50vw, 100vw" className="object-cover opacity-40" unoptimized={hero.cover.startsWith("http")} />
              : <BookOpen className="absolute right-6 top-6 h-14 w-14 text-white/20" aria-hidden />}
            <div className="relative space-y-3 p-6">
              {hero.certifying && <span className="inline-block rounded-md bg-brand px-2.5 py-1 text-xs font-bold">Formation certifiante</span>}
              <h3 className="text-2xl font-extrabold md:text-3xl">{hero.title}</h3>
              {hero.summary && <p className="max-w-2xl text-sm text-white/90 md:text-base">{hero.summary}</p>}
              <p className="flex flex-wrap gap-x-5 gap-y-1 text-sm text-white/90">{hero.facts.map((f) => <span key={f}>{f}</span>)}</p>
              <div className="flex flex-wrap gap-3 pt-1">
                <button type="button" disabled title="Aperçu : l’inscription n’est pas active" className="cursor-not-allowed rounded-lg bg-white px-5 py-2.5 text-sm font-semibold text-brand-dark opacity-90">S’inscrire à la formation</button>
                <button type="button" onClick={() => setTab("programme")} className="rounded-lg border border-white/70 px-5 py-2.5 text-sm font-semibold text-white hover:bg-white/10">Voir le programme</button>
              </div>
            </div>
          </div>
          <div role="tablist" aria-label="Sections de la formation" className="flex gap-1 overflow-x-auto border-b border-line px-3">
            {PREVIEW_TABS.map((t) => (
              <button key={t.id} role="tab" type="button" aria-selected={tab === t.id} onClick={() => setTab(t.id)}
                className={cn("-mb-px whitespace-nowrap border-b-2 px-3 py-3 text-sm font-semibold", tab === t.id ? "border-brand text-brand" : "border-transparent text-muted hover:text-brand-dark")}>
                {t.label}
              </button>
            ))}
          </div>
          <div role="tabpanel" className="p-5">{panels[tab]}</div>
        </div>
      )}
    </div>
  );
}
