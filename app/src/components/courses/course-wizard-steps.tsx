"use client";

import { useState } from "react";
import {
  Award, BarChart3, Clock, Coins, GraduationCap, Eye, FileText, Globe, Image as ImageIcon, Layers, Monitor, Shield, Tag, Target, Users,
  type LucideIcon,
} from "lucide-react";
import type { FormState } from "@/lib/auth/actions";
import { LANGUAGE_REQUIREMENTS, LEVELS } from "@/lib/courses/labels";
import { Field, SelectField } from "@/components/ui/field";
import { FileUpload, IMAGE_TYPES } from "@/components/ui/file-upload";
import { cn } from "@/lib/utils";
import { ObjectiveList } from "./objective-list";
import { RichTextEditor } from "@/components/ui/rich-text-editor";
import { TagInput } from "./tag-input";

/** Champs de chaque étape de l'assistant : sert à ramener le formateur sur l'étape qui contient une erreur. */
export const STEP_FIELDS: string[][] = [
  ["title", "subtitle", "categoryId", "language", "level", "deliveryMode", "durationHours", "priceAmount", "courseCode", "certificateTemplateId",
    "targetAudience", "prerequisites", "defaultCapacity", "languageRequirement", "description", "objectives", "competencies", "coverUrl"],
  [],
  ["evaluationEnabled", "evaluationTypes", "passMarkPercent", "gradingScale", "gradeRounding", "defaultAttempts", "showResults", "allowRetake", "certificateEnabled", "certificateTemplateId", "certificateTitle", "certificateDescription", "certificateDisplay", "certificateValidityMonths"],
  ["publicationMode", "publishAt", "priceAmount", "paymentMethods", "allowInstallments", "allowDownloads", "forumEnabled", "allowDiscussions", "showProgress", "notifyInstructor", "autoCertificate", "parentCourseId", "enrollmentMode", "accessCode", "audienceTypes", "prerequisiteCourseId", "cancellationPolicy", "accessibility", "keywords", "externalReference"],
  [],
];

export type WizardLookups = {
  categories: { id: string; name: string }[];
  otherCourses: { id: string; title: string }[];
  certificateTemplates: { id: string; name: string; layout: "classic" | "modern" | "minimal" | "professional" }[];
};

export type EnrollmentMode = "free" | "approval" | "code";

/** Mode d'inscription et code d'accès : un seul état, présenté à l'étape 1 (cases) et à l'étape 4 (choix détaillé). */
export type EnrollmentControl = { mode: EnrollmentMode; setMode: (m: EnrollmentMode) => void; code: string; setCode: (c: string) => void };

type StepProps = WizardLookups & { state: FormState };

/** Valeur à réafficher : la saisie renvoyée par le serveur après une erreur, sinon la valeur par défaut. */
const valueOf = (state: FormState, key: string, fallback = "") => String(state.values?.[key] ?? fallback);
const listOf = (state: FormState, key: string, sep: string) => (state.values?.[key] ?? "").split(sep).filter(Boolean);

function Section({ title, hint, icon: Icon, children }: { title: string; hint?: string; icon?: LucideIcon; children: React.ReactNode }) {
  return (
    <fieldset className="space-y-4 rounded-2xl border border-line bg-white p-6 shadow-card">
      <legend className="sr-only">{title}</legend>
      <div className="flex items-start gap-3">
        {Icon && <Icon className="mt-0.5 h-6 w-6 shrink-0 text-brand" aria-hidden />}
        <div>
          <h3 className="text-lg font-bold text-brand-dark">{title}</h3>
          {hint && <p className="text-sm text-muted">{hint}</p>}
        </div>
      </div>
      {children}
    </fieldset>
  );
}

/** Groupe de choix à carte (niveau, format, mode d'inscription). Une option peut être désactivée avec son explication. */
function ChoiceCards({ name, label, options, value, errors, disabled = [], icons }: {
  name: string; label: string; options: Record<string, string>; value: string; errors?: string[]; disabled?: string[];
  icons?: Record<string, LucideIcon>;
}) {
  return (
    <fieldset>
      <legend className="mb-1 text-sm font-medium text-brand-dark">{label}</legend>
      <div className="grid gap-2 sm:grid-cols-3">
        {Object.entries(options).map(([key, text]) => {
          const off = disabled.includes(key);
          return (
            <label key={key} className={cn(
              "flex items-center justify-center rounded-lg border px-3 py-2.5 text-center text-sm font-medium has-[:checked]:border-brand has-[:checked]:bg-brand-soft has-[:checked]:text-brand",
              off ? "cursor-not-allowed border-line text-muted opacity-60" : "cursor-pointer text-brand-dark",
              !off && errors?.length && "border-danger",
            )}>
              <input type="radio" name={name} value={key} defaultChecked={value === key} disabled={off} className="sr-only" />
              {icons?.[key] && (() => { const I = icons[key]; return <I className="mr-1.5 h-4 w-4 shrink-0" aria-hidden />; })()}
              {text}
            </label>
          );
        })}
      </div>
      {errors?.[0] && <p role="alert" className="mt-1 text-xs text-danger">{errors[0]}</p>}
    </fieldset>
  );
}

/** Compteur de caractères sous un champ texte court. */
function CountedField({ label, name, max, defaultValue, errors, placeholder }: {
  label: string; name: string; max: number; defaultValue: string; errors?: string[]; placeholder?: string;
}) {
  const [len, setLen] = useState(defaultValue.length);
  return (
    <div>
      <div className="flex items-baseline justify-between">
        <span className="mb-1 block text-sm font-medium text-brand-dark">{label}</span>
        <span className="text-xs text-muted">{len}/{max}</span>
      </div>
      <Field label={label} name={name} maxLength={max} placeholder={placeholder} defaultValue={defaultValue} errors={errors}
        onChange={(e) => setLen(e.target.value.length)} className="[&>label]:sr-only" />
    </div>
  );
}

/** Prix en FCFA avec l'option « Gratuite », qui fixe le prix à 0. */
function PriceInput({ defaultValue, errors }: { defaultValue: string; errors?: string[] }) {
  const [free, setFree] = useState(defaultValue === "0");
  const [price, setPrice] = useState(defaultValue);
  return (
    <div className="flex items-start gap-4">
      <div className="min-w-0 flex-1">
        <WithIcon icon={Coins}>
          <Field label="Prix (FCFA)" name="priceAmount" type="number" min="0" step="1" required readOnly={free}
            value={free ? "0" : price} onChange={(e) => setPrice(e.target.value)} errors={errors} />
        </WithIcon>
      </div>
      <label className="mt-8 flex shrink-0 cursor-pointer items-center gap-2 text-sm text-brand-dark">
        <input type="checkbox" checked={free} onChange={(e) => setFree(e.target.checked)} className="peer sr-only" />
        <span aria-hidden className="relative h-5 w-9 rounded-full bg-line transition-colors peer-checked:bg-brand peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-brand after:absolute after:left-0.5 after:top-0.5 after:h-4 after:w-4 after:rounded-full after:bg-white after:shadow after:transition-transform peer-checked:after:translate-x-4" />
        Gratuite
      </label>
    </div>
  );
}

/** Champ avec une icône à gauche, alignée sur la zone de saisie (étiquette d'une ligne au-dessus). */
function WithIcon({ icon: Icon, suffix, children }: { icon?: LucideIcon; suffix?: string; children: React.ReactNode }) {
  return (
    <div className="relative [&_input]:pl-10 [&_select]:pl-10">
      {children}
      {Icon && <Icon className="pointer-events-none absolute left-3 top-[2.3rem] h-4 w-4 text-brand" aria-hidden />}
      {suffix && <span className="pointer-events-none absolute right-3 top-[2.2rem] text-sm text-muted">{suffix}</span>}
    </div>
  );
}

const FORMAT_LABELS = { onsite: "En présentiel", online: "En ligne", hybrid: "Mixte" };
const FORMAT_ICONS: Record<string, LucideIcon> = { onsite: Users, online: Monitor, hybrid: Layers };

/** Compétences proposées à la saisie (la saisie libre reste possible). */
const COMPETENCY_SUGGESTIONS = [
  "Surveillance et contrôle d’accès", "Gestion des conflits", "Prévention des risques", "Secours aux personnes",
  "Communication professionnelle", "Cadre légal et réglementaire", "Sécurité incendie", "Évacuation et gestion de crise",
  "Accueil et filtrage", "Vidéosurveillance", "Cybersécurité de base", "Gestes de premiers secours",
];

export function StepGeneral({ categories, certificateTemplates, state, enrollment }: StepProps & { enrollment: EnrollmentControl }) {
  const fe = state.fieldErrors;
  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
      <div className="space-y-6">
        <Section icon={Users} title="Informations générales" hint="Définissez les informations de base de votre formation.">
          <div className="grid gap-x-6 gap-y-4 md:grid-cols-2">
            <div className="space-y-4">
              <Field label="Titre de la formation *" name="title" required defaultValue={valueOf(state, "title")} errors={fe?.title} />
              <WithIcon icon={Shield}>
                <SelectField label="Catégorie *" name="categoryId" required defaultValue={valueOf(state, "categoryId")} errors={fe?.categoryId}>
                  <option value="">Choisir…</option>
                  {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </SelectField>
              </WithIcon>
              <WithIcon icon={BarChart3}>
                <SelectField label="Niveau *" name="level" defaultValue={valueOf(state, "level", "beginner")} errors={fe?.level}>
                  {Object.entries(LEVELS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
                </SelectField>
              </WithIcon>
              <WithIcon icon={Clock} suffix="heures">
                <Field label="Durée totale estimée *" name="durationHours" type="number" step="0.5" min="0.5" required className="[&_input]:pr-16" defaultValue={valueOf(state, "durationHours")} errors={fe?.durationHours} />
              </WithIcon>
              <ChoiceCards name="deliveryMode" label="Format *" options={FORMAT_LABELS} icons={FORMAT_ICONS} value={valueOf(state, "deliveryMode", "onsite")} errors={fe?.deliveryMode} />
              <PriceInput defaultValue={valueOf(state, "priceAmount", "0")} errors={fe?.priceAmount} />
              <WithIcon icon={Globe}>
                <SelectField label="Langue principale *" name="language" defaultValue={valueOf(state, "language", "fr")} errors={fe?.language}>
                  <option value="fr">Français</option>
                  <option value="en">Anglais</option>
                </SelectField>
              </WithIcon>
              <WithIcon icon={Award}>
                <SelectField label="Certificat délivré *" name="certificateTemplateId" defaultValue={valueOf(state, "certificateTemplateId")} errors={fe?.certificateTemplateId}>
                  <option value="">Aucun modèle</option>
                  {certificateTemplates.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                </SelectField>
              </WithIcon>
            </div>

            <div className="space-y-4">
              <CountedField label="Sous-titre (facultatif)" name="subtitle" max={150} placeholder="Ex. : Maîtrisez les techniques et les bonnes pratiques du métier" defaultValue={valueOf(state, "subtitle")} errors={fe?.subtitle} />
              <WithIcon icon={Tag}>
                <Field label="Code de la formation *" name="courseCode" maxLength={40} placeholder="Ex. ASP-001" defaultValue={valueOf(state, "courseCode")} errors={fe?.courseCode} />
              </WithIcon>
              <TagInput name="targetAudience" mode="lines" label="Public cible *" icon={Users} initial={listOf(state, "targetAudience", "\n")}
                placeholder="Ex. Débutants, agents en reconversion…" errors={fe?.targetAudience} />
              <TagInput name="prerequisites" mode="lines" label="Prérequis" icon={GraduationCap} initial={listOf(state, "prerequisites", "\n")}
                placeholder="Ex. Aucun prérequis particulier" errors={fe?.prerequisites} />
              <fieldset className="space-y-2">
                <legend className="mb-1 text-sm font-medium text-brand-dark">Modalité d’inscription</legend>
                <div className="flex flex-wrap gap-x-6 gap-y-2">
                  <label className="flex items-center gap-2 text-sm text-brand-dark">
                    <input type="checkbox" checked={enrollment.mode === "free"} onChange={() => enrollment.setMode("free")} className="h-4 w-4 accent-brand" /> Inscription libre
                  </label>
                  <label className="flex items-center gap-2 text-sm text-brand-dark">
                    <input type="checkbox" checked={enrollment.mode === "approval"} onChange={(e) => enrollment.setMode(e.target.checked ? "approval" : "free")} className="h-4 w-4 accent-brand" /> Sur validation
                  </label>
                </div>
                {enrollment.mode === "code" && <p className="text-xs text-muted">Inscription par code d’accès (réglage à l’étape 4).</p>}
              </fieldset>
              <WithIcon icon={Users}>
                <Field label="Places par session" name="defaultCapacity" type="number" min="1" max="10000" hint="Proposé à la création d’une session."
                  defaultValue={valueOf(state, "defaultCapacity")} errors={fe?.defaultCapacity} />
              </WithIcon>
              <WithIcon icon={Globe}>
                <SelectField label="Niveau de langue requis" name="languageRequirement" defaultValue={valueOf(state, "languageRequirement")} errors={fe?.languageRequirement}>
                  <option value="">Aucun niveau requis</option>
                  {Object.entries(LANGUAGE_REQUIREMENTS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
                </SelectField>
              </WithIcon>
              <WithIcon icon={Eye}>
                <SelectField label="Statut" name="statusDisplay" disabled defaultValue="draft" hint="Toute formation est créée en brouillon.">
                  <option value="draft">Brouillon</option>
                </SelectField>
              </WithIcon>
            </div>
          </div>
        </Section>

        <Section icon={Target} title="Compétences visées" hint="Sélectionnez les compétences principales développées dans cette formation.">
          <TagInput name="competencies" mode="lines" variant="search" label="Compétences" initial={listOf(state, "competencies", "\n")}
            placeholder="Rechercher et sélectionner des compétences…" suggestions={COMPETENCY_SUGGESTIONS} errors={fe?.competencies} />
        </Section>
      </div>

      <div className="space-y-6">
        <Section icon={ImageIcon} title="Image et présentation">
          <FileUpload variant="cover" name="coverUrl" label="Image de couverture" bucket="course-covers" accept={IMAGE_TYPES} maxMb={5} store="url"
            defaultValue={valueOf(state, "coverUrl") || undefined} hint="Formats acceptés : JPG, PNG, WebP (max 5 Mo)." />
          {fe?.coverUrl && <p role="alert" className="text-xs text-danger">{fe.coverUrl[0]}</p>}
        </Section>

        <Section icon={FileText} title="Description de la formation *">
          <RichTextEditor name="description" label="Description" required max={5000} defaultValue={valueOf(state, "description")} error={fe?.description?.[0]} />
          <p className="-mt-2 text-xs text-muted">30 caractères minimum.</p>
        </Section>

        <Section icon={Target} title="Objectifs de la formation *">
          <ObjectiveList name="objectives" label="Objectifs" initial={listOf(state, "objectives", "\n")} errors={fe?.objectives} />
        </Section>
      </div>
    </div>
  );
}
