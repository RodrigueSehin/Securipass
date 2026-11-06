"use client";

import { useActionState, useState } from "react";
import { Award, ClipboardList, Info, Target } from "lucide-react";
import { saveCourseStep } from "@/lib/courses/actions";
import type { FormState } from "@/lib/auth/actions";
import { CERTIFICATE_DISPLAY } from "@/lib/courses/schemas";
import { EVALUATION_TYPES, GRADING_SCALES, ROUNDING_LABELS, type ActivityKind } from "@/lib/courses/grading";
import { Alert } from "@/components/ui/feedback";
import { Field, SelectField } from "@/components/ui/field";
import { Switch } from "@/components/ui/switch";
import { CertificateMiniature } from "@/components/certificates/miniature";
import { cn } from "@/lib/utils";
import { WIZARD_FORM_ID } from "./wizard-frame";

const F = { form: WIZARD_FORM_ID } as const;

const DISPLAY_LABELS: Record<(typeof CERTIFICATE_DISPLAY)[number], string> = {
  holder_name: "Nom et prénom de l’apprenant",
  course_title: "Intitulé de la formation",
  issue_date: "Date de délivrance",
  qr: "QR code de vérification",
  trainer_signature: "Signature du formateur",
  issuer_signature: "Signature de l’organisme",
  number: "Numéro de certificat",
};

type Template = { id: string; name: string; layout: "classic" | "modern" | "minimal" | "professional" };

const list = (value: string | undefined, sep = ",") => (value ?? "").split(sep).filter(Boolean);

/**
 * Étape 3 : évaluation (activités, critères de réussite) et certification.
 * Tous les champs sont rattachés au formulaire du pied de page (attribut `form`), ce qui permet d'insérer au milieu de la carte
 * la liste des activités, qui a ses propres formulaires (activation, duplication, suppression).
 */
export function EvaluationStep({ courseId, initialValues, templates, activitiesSlot }: {
  courseId: string; initialValues: Record<string, string>; templates: Template[]; activitiesSlot: React.ReactNode;
}) {
  const [state, action] = useActionState<FormState, FormData>(saveCourseStep, {});
  const v = (key: string) => state.values?.[key] ?? initialValues[key] ?? "";
  const fe = state.fieldErrors;

  const [evalOn, setEvalOn] = useState(v("evaluationEnabled") === "1");
  const [certOn, setCertOn] = useState(v("certificateEnabled") === "1");
  const [showResults, setShowResults] = useState(v("showResults") === "1");
  const [retake, setRetake] = useState(v("allowRetake") === "1");
  const [templateId, setTemplateId] = useState(v("certificateTemplateId"));
  const [descLength, setDescLength] = useState(v("certificateDescription").length);
  const types = list(v("evaluationTypes"));
  const display = list(v("certificateDisplay"));
  const template = templates.find((t) => t.id === templateId);

  return (
    <div onKeyDown={(e) => { if (e.key === "Enter" && e.target instanceof HTMLInputElement) e.preventDefault(); }}>
      <form id={WIZARD_FORM_ID} action={action} noValidate>
        <input type="hidden" name="courseId" value={courseId} />
        <input type="hidden" name="step" value="3" />
      </form>

      <div className="mb-4 space-y-3 empty:hidden">
        {state.error && <Alert>{state.error}</Alert>}
        {state.fieldErrors && <Alert>Certaines informations sont invalides. Corrigez les champs signalés.</Alert>}
        {state.message && <Alert tone="success">{state.message}</Alert>}
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)]">
        <section className="min-w-0 space-y-6 rounded-2xl border border-line bg-white p-6 shadow-card" aria-labelledby="eval-title">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <ClipboardList className="mt-0.5 h-6 w-6 shrink-0 text-brand" aria-hidden />
              <div>
                <h2 id="eval-title" className="text-lg font-bold text-brand-dark">Évaluation de la formation</h2>
                <p className="text-sm text-muted">Définissez les méthodes d’évaluation, les critères de réussite et les activités notées.</p>
              </div>
            </div>
            <Switch name="evaluationEnabled" form={WIZARD_FORM_ID} label="Activer l’évaluation" on={evalOn} onChange={setEvalOn} />
          </div>

          <div className="flex items-start gap-2 rounded-lg bg-brand-soft p-3 text-sm text-brand-dark">
            <Info className="mt-0.5 h-4 w-4 shrink-0 text-brand" aria-hidden />
            <p>Vous pouvez combiner plusieurs types d’évaluation : quiz en ligne, devoirs, études de cas, évaluations pratiques.</p>
          </div>

          <fieldset className={cn("space-y-3", !evalOn && "pointer-events-none opacity-50")} disabled={!evalOn}>
            <legend className="text-sm font-bold text-brand-dark">Types d’évaluation</legend>
            <input type="hidden" name="evaluationTypes" value="" {...F} />
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {(Object.keys(EVALUATION_TYPES) as ActivityKind[]).map((key) => (
                <label key={key} className="flex cursor-pointer flex-col gap-1 rounded-xl border border-line p-3 text-sm has-[:checked]:border-brand has-[:checked]:bg-brand-soft/50">
                  <span className="flex items-center gap-2 font-semibold text-brand-dark">
                    <input type="checkbox" name="evaluationTypes" value={key} defaultChecked={types.includes(key)} className="h-4 w-4 accent-brand" {...F} />
                    {EVALUATION_TYPES[key].label}
                  </span>
                  <span className="text-xs text-muted">{EVALUATION_TYPES[key].hint}</span>
                </label>
              ))}
            </div>
            {fe?.evaluationTypes && <p role="alert" className="text-xs text-danger">{fe.evaluationTypes[0]}</p>}
          </fieldset>

          <div className={cn(!evalOn && "pointer-events-none opacity-50")}>{activitiesSlot}</div>

          <fieldset className={cn("space-y-4", !evalOn && "pointer-events-none opacity-50")} disabled={!evalOn}>
            <legend className="flex items-center gap-2 text-sm font-bold text-brand-dark"><Target className="h-5 w-5 text-brand" aria-hidden />Critères de réussite</legend>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="relative [&_input]:pr-9">
                <Field label="Note minimale de réussite *" name="passMarkPercent" type="number" min="0" max="100" defaultValue={v("passMarkPercent")} errors={fe?.passMarkPercent} {...F}
                  hint="Moyenne pondérée des activités à atteindre pour réussir." />
                <span className="pointer-events-none absolute right-3 top-[2.2rem] text-sm text-muted">%</span>
              </div>
              <SelectField label="Type de notation" name="gradingScale" defaultValue={v("gradingScale")} errors={fe?.gradingScale} {...F}>
                {GRADING_SCALES.map((s) => <option key={s} value={s}>Sur {s}</option>)}
              </SelectField>
              <Field label="Nombre de tentatives autorisées" name="defaultAttempts" type="number" min="1" max="10" defaultValue={v("defaultAttempts")} errors={fe?.defaultAttempts} {...F}
                hint="Valeur proposée pour chaque nouvelle activité." />
              <SelectField label="Arrondi des notes" name="gradeRounding" defaultValue={v("gradeRounding")} errors={fe?.gradeRounding} {...F}>
                {Object.entries(ROUNDING_LABELS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
              </SelectField>
            </div>
            <div className="flex flex-wrap gap-x-8 gap-y-3">
              <Switch name="showResults" form={WIZARD_FORM_ID} label="Afficher les résultats aux apprenants" on={showResults} onChange={setShowResults} />
              <Switch name="allowRetake" form={WIZARD_FORM_ID} label="Autoriser le rattrapage (une tentative de plus)" on={retake} onChange={setRetake} />
            </div>
          </fieldset>
        </section>

        <section className="min-w-0 space-y-5 self-start rounded-2xl border border-line bg-white p-6 shadow-card" aria-labelledby="cert-title">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <Award className="mt-0.5 h-6 w-6 shrink-0 text-brand" aria-hidden />
              <div>
                <h2 id="cert-title" className="text-lg font-bold text-brand-dark">Certification</h2>
                <p className="text-sm text-muted">Configurez le certificat délivré à la fin de la formation.</p>
              </div>
            </div>
            <Switch name="certificateEnabled" form={WIZARD_FORM_ID} label="Délivrer une certification" on={certOn} onChange={setCertOn} />
          </div>

          <fieldset className={cn("space-y-4", !certOn && "pointer-events-none opacity-50")} disabled={!certOn}>
            <SelectField label="Type de certificat *" name="certificateTemplateId" value={templateId} onChange={(e) => setTemplateId(e.target.value)} errors={fe?.certificateTemplateId} {...F}>
              <option value="">Aucun modèle</option>
              {templates.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </SelectField>
            <Field label="Nom du certificat" name="certificateTitle" maxLength={200} placeholder="Ex. Certificat de réussite – Agent de sécurité privée" defaultValue={v("certificateTitle")} errors={fe?.certificateTitle} {...F}
              hint="Variables disponibles : {{apprenant}}, {{formation}}, {{date}}, {{numero}}." />
            <div>
              <label htmlFor="f-certificateDescription" className="mb-1 block text-sm font-medium text-brand-dark">Description du certificat</label>
              <textarea id="f-certificateDescription" name="certificateDescription" rows={4} maxLength={500} defaultValue={v("certificateDescription")} {...F}
                onChange={(e) => setDescLength(e.target.value.length)} aria-invalid={!!fe?.certificateDescription}
                className="w-full rounded-lg border border-line bg-white px-3 py-2.5 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20" />
              <p className="mt-1 text-right text-xs text-muted">{descLength}/500</p>
              {fe?.certificateDescription && <p role="alert" className="text-xs text-danger">{fe.certificateDescription[0]}</p>}
            </div>

            <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
              <div>
                <p className="mb-2 text-sm font-bold text-brand-dark">Modèle de certificat</p>
                {template ? <CertificateMiniature layout={template.layout} title={v("certificateTitle") || undefined} /> : <p className="rounded-lg bg-surface p-4 text-center text-xs text-muted">Aucun modèle choisi</p>}
                <details className="mt-2">
                  <summary className="flex cursor-pointer list-none items-center justify-center gap-1 rounded-lg border border-brand px-3 py-1.5 text-sm font-semibold text-brand hover:bg-brand-soft [&::-webkit-details-marker]:hidden">
                    + Changer le modèle
                  </summary>
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    {templates.map((t) => (
                      <button key={t.id} type="button" onClick={() => setTemplateId(t.id)} aria-pressed={t.id === templateId}
                        className={cn("rounded-lg border p-1.5 text-left text-xs", t.id === templateId ? "border-brand bg-brand-soft" : "border-line hover:border-brand")}>
                        <CertificateMiniature layout={t.layout} />
                        <span className="mt-1 block truncate font-medium text-brand-dark">{t.name}</span>
                      </button>
                    ))}
                  </div>
                </details>
              </div>
              <fieldset>
                <legend className="mb-2 text-sm font-bold text-brand-dark">Informations du certificat</legend>
                <input type="hidden" name="certificateDisplay" value="" {...F} />
                <ul className="space-y-2">
                  {CERTIFICATE_DISPLAY.map((key) => (
                    <li key={key}>
                      <label className="flex items-center gap-2 text-sm text-brand-dark">
                        <input type="checkbox" name="certificateDisplay" value={key} defaultChecked={display.includes(key)} className="h-4 w-4 accent-brand" {...F} />
                        {DISPLAY_LABELS[key]}
                      </label>
                    </li>
                  ))}
                </ul>
              </fieldset>
            </div>
            <Field label="Durée de validité du certificat (mois)" name="certificateValidityMonths" type="number" min="1" max="240" defaultValue={v("certificateValidityMonths")} errors={fe?.certificateValidityMonths} {...F}
              hint="Laisser vide si le certificat n’expire pas." className="max-w-xs" />
          </fieldset>

          <div className="flex items-start gap-2 rounded-lg bg-brand-soft p-3 text-sm text-brand-dark">
            <Info className="mt-0.5 h-4 w-4 shrink-0 text-brand" aria-hidden />
            <p>Le certificat est délivré par le formateur aux apprenants éligibles : leçons terminées, activités réussies et note minimale de réussite atteinte.</p>
          </div>
        </section>
      </div>
    </div>
  );
}
