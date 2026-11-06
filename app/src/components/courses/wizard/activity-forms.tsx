"use client";

import { useActionState, useState } from "react";
import { Plus, Trash } from "lucide-react";
import { saveActivity, saveQuestion } from "@/lib/courses/evaluation-actions";
import type { FormState } from "@/lib/auth/actions";
import type { Activity, Question } from "@/lib/courses/evaluation-queries";
import { ACTIVITY_KINDS, toScale, type ActivityKind } from "@/lib/courses/grading";
import { Alert } from "@/components/ui/feedback";
import { Button } from "@/components/ui/button";
import { Field, SelectField, TextareaField } from "@/components/ui/field";

/** Création ou modification d'une activité d'évaluation. La note minimale se saisit sur l'échelle de la formation. */
export function ActivityForm({ courseId, scale, defaultAttempts, kinds, activity }: {
  courseId: string; scale: number; defaultAttempts: number; kinds: ActivityKind[]; activity?: Activity;
}) {
  const [state, action, pending] = useActionState<FormState, FormData>(saveActivity, {});
  const [kind, setKind] = useState<ActivityKind>(activity?.kind ?? kinds[0] ?? "quiz");
  const fe = state.fieldErrors;
  const v = state.values;
  const id = activity?.id ?? "new";
  const options = activity && !kinds.includes(activity.kind) ? [activity.kind, ...kinds] : kinds;
  const minDefault = activity ? toScale(activity.passing_score, scale) : toScale(60, scale);

  return (
    <form action={action} className="space-y-4" noValidate>
      <input type="hidden" name="courseId" value={courseId} />
      {activity && <input type="hidden" name="evaluationId" value={activity.id} />}
      {state.error && <Alert>{state.error}</Alert>}
      {state.message && <Alert tone="success">{state.message}</Alert>}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Titre de l’activité *" name="title" id={`a-title-${id}`} required defaultValue={v?.title ?? activity?.title} errors={fe?.title} />
        <SelectField label="Type d’activité" name="kind" id={`a-kind-${id}`} value={kind} onChange={(e) => setKind(e.target.value as ActivityKind)} errors={fe?.kind}
          hint={kind === "quiz" ? "Corrigé automatiquement à partir des questions." : "Noté par le formateur après la remise du travail."}>
          {options.map((k) => <option key={k} value={k}>{ACTIVITY_KINDS[k]}</option>)}
        </SelectField>
        <Field label="Pondération (%)" name="weightPercent" id={`a-weight-${id}`} type="number" min="0" max="100" defaultValue={v?.weightPercent ?? String(activity?.weight_percent ?? 0)} errors={fe?.weightPercent}
          hint="0 : l’activité compte pour la réussite mais pas dans la moyenne." />
        <Field label={`Note minimale (sur ${scale})`} name="minScore" id={`a-min-${id}`} type="number" min="0" max={scale} step="0.5" defaultValue={v?.minScore ?? String(minDefault)} errors={fe?.minScore} />
        <Field label="Tentatives autorisées" name="maxAttempts" id={`a-att-${id}`} type="number" min="1" max="10" defaultValue={v?.maxAttempts ?? String(activity?.max_attempts ?? defaultAttempts)} errors={fe?.maxAttempts} />
        {kind === "quiz" && (
          <Field label="Durée limitée (minutes, facultatif)" name="timeLimitMinutes" id={`a-time-${id}`} type="number" min="1" defaultValue={v?.timeLimitMinutes ?? (activity?.time_limit_minutes ? String(activity.time_limit_minutes) : "")} errors={fe?.timeLimitMinutes} />
        )}
      </div>
      <TextareaField label="Consignes (facultatif)" name="instructions" id={`a-ins-${id}`} rows={3} defaultValue={v?.instructions ?? activity?.instructions ?? ""} errors={fe?.instructions} />
      <Button type="submit" disabled={pending}>{pending ? "Enregistrement…" : activity ? "Enregistrer l’activité" : "Créer l’activité"}</Button>
    </form>
  );
}

type Row = { key: number; label: string; correct: boolean };

/** Question de quiz : énoncé, type, points et 2 à 10 propositions dont les bonnes réponses sont cochées. */
export function QuestionForm({ courseId, evaluationId, question }: { courseId: string; evaluationId: string; question?: Question }) {
  const [state, action, pending] = useActionState<FormState, FormData>(saveQuestion, {});
  const [kind, setKind] = useState<"single" | "multiple">(question?.kind ?? "single");
  const [rows, setRows] = useState<Row[]>(() =>
    question
      ? question.options.map((o, i) => ({ key: i, label: o.label, correct: question.key?.correct_option_ids.includes(o.id) ?? false }))
      : [0, 1, 2, 3].map((i) => ({ key: i, label: "", correct: false })));
  const fe = state.fieldErrors;
  const uid = question?.id ?? "new";

  const toggle = (key: number, checked: boolean) =>
    setRows(rows.map((r) => (r.key === key ? { ...r, correct: checked } : kind === "single" && checked ? { ...r, correct: false } : r)));

  return (
    <form action={action} className="space-y-3" noValidate>
      <input type="hidden" name="courseId" value={courseId} />
      <input type="hidden" name="evaluationId" value={evaluationId} />
      {question && <input type="hidden" name="questionId" value={question.id} />}
      {state.error && <Alert>{state.error}</Alert>}
      {state.message && <Alert tone="success">{state.message}</Alert>}
      <TextareaField label="Énoncé de la question" name="prompt" id={`q-prompt-${uid}`} rows={2} required defaultValue={state.values?.prompt ?? question?.prompt} errors={fe?.prompt} />
      <div className="grid gap-3 sm:grid-cols-2">
        <SelectField label="Type de réponse" name="kind" id={`q-kind-${uid}`} value={kind} onChange={(e) => {
          const next = e.target.value as "single" | "multiple";
          setKind(next);
          if (next === "single") setRows((rs) => { let seen = false; return rs.map((r) => (r.correct && !seen ? ((seen = true), r) : { ...r, correct: false })); });
        }} errors={fe?.kind}>
          <option value="single">Une seule bonne réponse</option>
          <option value="multiple">Plusieurs bonnes réponses</option>
        </SelectField>
        <Field label="Points" name="points" id={`q-points-${uid}`} type="number" min="1" max="100" defaultValue={state.values?.points ?? String(question?.points ?? 1)} errors={fe?.points} />
      </div>
      <fieldset className="space-y-2">
        <legend className="text-sm font-medium text-brand-dark">Propositions (cochez les bonnes réponses)</legend>
        {rows.map((r, i) => (
          <div key={r.key} className="flex items-center gap-2">
            <input type="checkbox" checked={r.correct} onChange={(e) => toggle(r.key, e.target.checked)} aria-label={`Proposition ${i + 1} : bonne réponse`} className="h-4 w-4 accent-success" />
            <input
              value={r.label} onChange={(e) => setRows(rows.map((x) => (x.key === r.key ? { ...x, label: e.target.value } : x)))}
              aria-label={`Proposition ${i + 1}`} maxLength={300} placeholder={`Proposition ${i + 1}`}
              className="min-w-0 flex-1 rounded-lg border border-line bg-white px-3 py-2 text-sm"
            />
            <input type="hidden" name="option" value={r.label} />
            {r.correct && <input type="hidden" name="correct" value={i} />}
            {rows.length > 2 && (
              <button type="button" aria-label={`Retirer la proposition ${i + 1}`} onClick={() => setRows(rows.filter((x) => x.key !== r.key))} className="rounded p-1.5 text-danger hover:bg-danger/10">
                <Trash className="h-4 w-4" aria-hidden />
              </button>
            )}
          </div>
        ))}
        {rows.length < 10 && (
          <button type="button" onClick={() => setRows([...rows, { key: Math.max(...rows.map((x) => x.key)) + 1, label: "", correct: false }])}
            className="inline-flex items-center gap-1 text-sm font-semibold text-brand hover:underline">
            <Plus className="h-4 w-4" aria-hidden /> Ajouter une proposition
          </button>
        )}
      </fieldset>
      <Button type="submit" disabled={pending}>{pending ? "Enregistrement…" : question ? "Enregistrer la question" : "Ajouter la question"}</Button>
    </form>
  );
}
