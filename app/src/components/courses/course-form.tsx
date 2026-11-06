"use client";

import { useActionState } from "react";
import { saveCourse } from "@/lib/courses/actions";
import type { FormState } from "@/lib/auth/actions";
import { LEVELS, MODES } from "@/lib/courses/labels";
import { Button } from "@/components/ui/button";
import { Field, SelectField, TextareaField } from "@/components/ui/field";
import { Alert } from "@/components/ui/feedback";
import { FileUpload, IMAGE_TYPES } from "@/components/ui/file-upload";

export type CourseFormDefaults = {
  id?: string;
  title?: string;
  category_id?: string | null;
  description?: string | null;
  objectives?: string[];
  target_audience?: string | null;
  prerequisites?: string | null;
  prerequisite_course_id?: string | null;
  competencies?: string[];
  level?: string;
  delivery_mode?: string;
  duration_minutes?: number;
  price_amount?: number;
  language?: string;
  evaluation_modalities?: string | null;
  certificate_conditions?: string | null;
  certificate_validity_months?: number | null;
  cancellation_policy?: string | null;
  accessibility?: string | null;
  cover_url?: string | null;
  default_capacity?: number | null;
};

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <fieldset className="space-y-4 rounded-2xl border border-line bg-white p-6 shadow-card">
      <legend className="px-2 text-lg font-bold text-brand-dark">{title}</legend>
      {children}
    </fieldset>
  );
}

export function CourseForm({
  defaults = {}, categories, otherCourses,
}: {
  defaults?: CourseFormDefaults;
  categories: { id: string; name: string }[];
  otherCourses: { id: string; title: string }[];
}) {
  const [state, action, pending] = useActionState<FormState, FormData>(saveCourse, {});
  const fe = state.fieldErrors;
  const v = state.values;
  const val = (key: string, fallback: string | number | null | undefined) => v?.[key] ?? (fallback ?? "");

  return (
    <form action={action} className="space-y-6" noValidate>
      {defaults.id && <input type="hidden" name="id" value={defaults.id} />}
      {state.error && <Alert>{state.error}</Alert>}
      {state.message && <Alert tone="success">{state.message}</Alert>}

      <Section title="Informations générales">
        <Field label="Titre" name="title" required defaultValue={val("title", defaults.title)} errors={fe?.title} />
        <SelectField label="Catégorie" name="categoryId" required defaultValue={String(val("categoryId", defaults.category_id))} errors={fe?.categoryId}>
          <option value="">Choisir…</option>
          {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </SelectField>
        <TextareaField label="Description" name="description" required rows={6} defaultValue={String(val("description", defaults.description))} errors={fe?.description} />
        <TextareaField label="Objectifs pédagogiques" name="objectives" rows={4} hint="Un objectif par ligne." defaultValue={String(val("objectives", defaults.objectives?.join("\n")))} errors={fe?.objectives} />
        <TextareaField label="Compétences visées" name="competencies" rows={3} hint="Une compétence par ligne." defaultValue={String(val("competencies", defaults.competencies?.join("\n")))} errors={fe?.competencies} />
        <TextareaField label="Public cible" name="targetAudience" rows={2} defaultValue={String(val("targetAudience", defaults.target_audience))} errors={fe?.targetAudience} />
        <TextareaField label="Prérequis" name="prerequisites" rows={2} defaultValue={String(val("prerequisites", defaults.prerequisites))} errors={fe?.prerequisites} />
        <SelectField label="Formation à avoir terminée (prérequis d’accès)" name="prerequisiteCourseId" defaultValue={String(val("prerequisiteCourseId", defaults.prerequisite_course_id))} hint="L’inscription sera refusée tant que cette formation n’est pas terminée." errors={fe?.prerequisiteCourseId}>
          <option value="">Aucune</option>
          {otherCourses.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
        </SelectField>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <SelectField label="Niveau" name="level" defaultValue={String(val("level", defaults.level ?? "beginner"))} errors={fe?.level}>
            {Object.entries(LEVELS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
          </SelectField>
          <SelectField label="Format" name="deliveryMode" defaultValue={String(val("deliveryMode", defaults.delivery_mode ?? "onsite"))} errors={fe?.deliveryMode}>
            {Object.entries(MODES).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
          </SelectField>
          <Field label="Durée (heures)" name="durationHours" type="number" step="0.5" min="0.5" required defaultValue={String(val("durationHours", defaults.duration_minutes ? defaults.duration_minutes / 60 : ""))} errors={fe?.durationHours} />
          <SelectField label="Langue" name="language" defaultValue={String(val("language", defaults.language ?? "fr"))} errors={fe?.language}>
            <option value="fr">Français</option>
            <option value="en">Anglais</option>
          </SelectField>
        </div>
        <FileUpload name="coverUrl" label="Image de couverture" bucket="course-covers" accept={IMAGE_TYPES} maxMb={5} store="url" defaultValue={defaults.cover_url ?? undefined} hint="JPEG, PNG ou WebP, 5 Mo maximum." />
        {fe?.coverUrl && <p role="alert" className="text-xs text-danger">{fe.coverUrl[0]}</p>}
      </Section>

      <Section title="Évaluation et certification">
        <TextareaField label="Modalités d’évaluation" name="evaluationModalities" rows={3} hint="Type d’épreuves, barème, note minimale, tentatives… (obligatoire pour soumettre)." defaultValue={String(val("evaluationModalities", defaults.evaluation_modalities))} errors={fe?.evaluationModalities} />
        <TextareaField label="Conditions d’obtention du certificat" name="certificateConditions" rows={3} hint="Réussite aux évaluations, assiduité… Ne mentionnez aucune reconnaissance officielle non obtenue." defaultValue={String(val("certificateConditions", defaults.certificate_conditions))} errors={fe?.certificateConditions} />
        <Field label="Durée de validité du certificat (mois)" name="certificateValidityMonths" type="number" min="1" hint="Laisser vide si le certificat n’expire pas." defaultValue={String(val("certificateValidityMonths", defaults.certificate_validity_months))} errors={fe?.certificateValidityMonths} className="max-w-xs" />
      </Section>

      <Section title="Tarif et conditions">
        <Field label="Prix (FCFA)" name="priceAmount" type="number" min="0" step="1" required hint="0 pour une formation gratuite. Les formations payantes ouvriront aux inscriptions en ligne avec le paiement sécurisé." defaultValue={String(val("priceAmount", defaults.price_amount ?? 0))} errors={fe?.priceAmount} className="max-w-xs" />
        <TextareaField label="Conditions d’annulation" name="cancellationPolicy" rows={3} defaultValue={String(val("cancellationPolicy", defaults.cancellation_policy))} errors={fe?.cancellationPolicy} />
        <TextareaField label="Accessibilité" name="accessibility" rows={2} hint="Aménagements possibles pour les personnes en situation de handicap." defaultValue={String(val("accessibility", defaults.accessibility))} errors={fe?.accessibility} />
      </Section>

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={pending}>{pending ? "Enregistrement…" : defaults.id ? "Enregistrer les modifications" : "Créer la formation"}</Button>
        {!defaults.id && <p className="text-xs text-muted">Vous ajouterez ensuite le programme et les sessions.</p>}
      </div>
    </form>
  );
}
