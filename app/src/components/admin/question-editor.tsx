"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { ArrowLeft, BarChart3, CheckCircle2, ClipboardList, FileText, Layers, ListChecks, Plus, RotateCcw, Save, Settings, Target, Trash2 } from "lucide-react";
import { Alert } from "@/components/ui/feedback";
import { DIFFICULTIES, EXPLANATION_MAX, PROMPT_MAX, QUESTION_TYPES, questionProgress } from "@/lib/admin/evaluations";
import { addQuestion, deleteQuestion } from "@/lib/admin/evaluations-actions";
import type { FormState } from "@/lib/auth/actions";
import { cn } from "@/lib/utils";

const input = "w-full rounded-lg border border-line bg-white px-3 py-2.5 text-sm text-brand-dark outline-none focus:border-brand focus:ring-2 focus:ring-brand/20";
const lbl = "mb-1 block text-sm font-semibold text-brand-dark";

export type EditorEvaluation = { id: string; title: string; planned: number | null };
export type EditorQuestion = { id: string; position: number; prompt: string; kind: string; optionCount: number; points: number };

const Err = ({ e }: { e?: string[] }) => (e?.[0] ? <p role="alert" className="mt-1 text-xs text-danger">{e[0]}</p> : null);
const Req = () => <span className="text-danger">*</span>;

/** Éditeur de questions d'un QCM : formulaire de question, aperçu des questions ajoutées et répartition des points. */
export function QuestionEditor({ evaluation, questions, categories, error }: { evaluation: EditorEvaluation; questions: EditorQuestion[]; categories: string[]; error?: string }) {
  const [state, action, pending] = useActionState<FormState, FormData>(addQuestion, {});
  const [another, setAnother] = useState(true);
  const [formKey, setFormKey] = useState(0);
  const total = questions.reduce((n, q) => n + q.points, 0);
  const p = questionProgress(questions.length, evaluation.planned, total);
  const R = 52;
  const C = 2 * Math.PI * R;

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
      <form action={action} noValidate className="space-y-6">
        {error && <Alert>{error}</Alert>}
        {state.error && <Alert>{state.error}</Alert>}
        {state.message && <Alert tone="success">{state.message}</Alert>}
        <input type="hidden" name="evaluationId" value={evaluation.id} />
        <input type="hidden" name="another" value={another ? "1" : "0"} />
        <Fields key={`${formKey}-${state.values?.saved ?? ""}`} state={state} categories={categories} />
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link href="/admin/evaluations" className="inline-flex items-center gap-2 rounded-lg border border-brand bg-white px-5 py-2.5 text-sm font-semibold text-brand hover:bg-brand-soft"><ArrowLeft className="h-4 w-4" aria-hidden /> Retour aux évaluations</Link>
          <div className="flex flex-wrap items-center gap-3">
            <label className="flex cursor-pointer items-center gap-2 text-sm text-brand-dark"><input type="checkbox" checked={another} onChange={(e) => setAnother(e.target.checked)} className="h-4 w-4 accent-[var(--color-brand)]" />Ajouter une autre question</label>
            <button type="button" onClick={() => setFormKey((k) => k + 1)} className="inline-flex items-center gap-2 rounded-lg border border-brand bg-white px-5 py-2.5 text-sm font-semibold text-brand hover:bg-brand-soft"><RotateCcw className="h-4 w-4" aria-hidden /> Réinitialiser</button>
            <button type="submit" disabled={pending} className="inline-flex items-center gap-2 rounded-lg bg-brand px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-dark disabled:opacity-60"><Save className="h-4 w-4" aria-hidden /> {pending ? "Enregistrement…" : "Enregistrer la question"}</button>
          </div>
        </div>
      </form>

      <aside className="space-y-6">
        <section className="rounded-2xl border border-line bg-white p-5 shadow-card">
          <h2 className="mb-3 flex items-center gap-2 text-base font-extrabold text-brand-dark"><ClipboardList className="h-5 w-5 text-brand" aria-hidden />Aperçu de l’évaluation</h2>
          <div className="rounded-xl bg-brand-soft/60 p-3"><p className="font-bold text-brand-dark">{evaluation.title}</p><p className="text-xs text-brand-dark/80">QCM{evaluation.planned ? ` • ${evaluation.planned} questions` : ""} • 100 points</p></div>
          <div className="mt-4 flex items-center justify-between"><h3 className="text-sm font-extrabold text-brand-dark">Questions ajoutées ({questions.length})</h3><span className="text-xs font-semibold text-brand-dark">Total : {total} point{total > 1 ? "s" : ""}</span></div>
          {questions.length === 0 ? <p className="mt-3 text-sm text-muted">Aucune question pour l’instant.</p> : (
            <ul className="mt-2 divide-y divide-line">
              {questions.map((q) => (
                <li key={q.id} className="flex items-center gap-2 py-2.5">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-brand-soft text-sm font-bold text-brand">{q.position}</span>
                  <p className="min-w-0 flex-1 truncate text-sm text-brand-dark" title={q.prompt}>{q.prompt}</p>
                  <span className="shrink-0 rounded-md bg-[#ede9fe] px-2 py-0.5 text-xs font-semibold text-[#6d28d9]">{q.kind === "multiple" ? "Choix multiple" : "QCM"}</span>
                  <span className="shrink-0 text-xs text-muted">{q.points} pts</span>
                  <form action={deleteQuestion}>
                    <input type="hidden" name="evaluationId" value={evaluation.id} /><input type="hidden" name="questionId" value={q.id} />
                    <button aria-label={`Supprimer la question ${q.position}`} className="rounded p-1 text-danger hover:bg-danger/10"><Trash2 className="h-4 w-4" aria-hidden /></button>
                  </form>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="rounded-2xl border border-line bg-white p-5 shadow-card">
          <h2 className="mb-3 flex items-center gap-2 text-base font-extrabold text-brand-dark"><BarChart3 className="h-5 w-5 text-brand" aria-hidden />Répartition actuelle</h2>
          <div className="flex items-center gap-4">
            <div className="relative h-32 w-32 shrink-0">
              <svg viewBox="0 0 120 120" className="h-full w-full -rotate-90" role="img" aria-label={`${total} points, ${p.pct} % des questions prévues`}>
                <circle cx="60" cy="60" r={R} fill="none" strokeWidth="12" className="stroke-line" />
                <circle cx="60" cy="60" r={R} fill="none" strokeWidth="12" strokeLinecap="round" className="stroke-brand" strokeDasharray={`${(p.pct / 100) * C} ${C}`} />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center"><span className="text-2xl font-extrabold text-brand-dark">{total}</span><span className="text-xs text-muted">points</span></div>
            </div>
            <ul className="min-w-0 flex-1 space-y-2 text-sm text-brand-dark">
              <li className="flex items-center gap-2"><Target className="h-4 w-4 text-brand" aria-hidden />Questions : <b>{questions.length}{evaluation.planned ? ` / ${evaluation.planned}` : ""}</b></li>
              <li className="flex items-center gap-2"><Layers className="h-4 w-4 text-brand" aria-hidden />Points : <b>{total} / 100</b></li>
              <li className="flex items-center gap-2"><BarChart3 className="h-4 w-4 text-brand" aria-hidden />Progression : <b>{String(p.pct).replace(".", ",")} %</b></li>
            </ul>
          </div>
          {total !== 100 && questions.length > 0 && <p className="mt-3 text-xs text-muted">Le score est calculé en pourcentage des points : le total n’a pas besoin d’atteindre 100.</p>}
        </section>
      </aside>
    </div>
  );
}

function Fields({ state, categories }: { state: FormState; categories: string[] }) {
  const fe = state.fieldErrors ?? {};
  const sv = state.values ?? {};
  const [type, setType] = useState<string>(sv.type ?? "single");
  const [prompt, setPrompt] = useState(sv.prompt ?? "");
  const [explanation, setExplanation] = useState(sv.explanation ?? "");
  const [options, setOptions] = useState<{ label: string; correct: boolean }[]>(["", "", "", ""].map((label) => ({ label, correct: false })));
  const [tf, setTf] = useState<number | null>(null);
  const multi = type === "multiple";
  const trueFalse = type === "true_false";

  const mark = (i: number) => setOptions((o) => o.map((x, j) => (multi ? (j === i ? { ...x, correct: !x.correct } : x) : { ...x, correct: j === i })));
  const edit = (i: number, label: string) => setOptions((o) => o.map((x, j) => (j === i ? { ...x, label } : x)));
  const remove = (i: number) => setOptions((o) => o.filter((_, j) => j !== i));

  return (
    <>
      <section className="rounded-2xl border border-line bg-white p-5 shadow-card">
        <h2 className="mb-4 flex items-center gap-3 text-base font-extrabold text-brand-dark"><FileText className="h-5 w-5 text-brand" aria-hidden />Détails de la question</h2>
        <div>
          <label htmlFor="q-prompt" className={lbl}>Question <Req /></label>
          <textarea id="q-prompt" name="prompt" rows={3} maxLength={PROMPT_MAX} value={prompt} onChange={(e) => setPrompt(e.target.value)} className={input} aria-invalid={!!fe.prompt} />
          <p className="mt-1 text-right text-xs text-muted">{prompt.length} / {PROMPT_MAX}</p><Err e={fe.prompt} />
        </div>
        <div className="mt-3 grid gap-4 md:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
          <div><label htmlFor="q-type" className={lbl}>Type de question <Req /></label>
            <select id="q-type" name="type" value={type} onChange={(e) => { setType(e.target.value); setTf(null); setOptions((o) => o.map((x) => ({ ...x, correct: false }))); }} className={input}>
              {Object.entries(QUESTION_TYPES).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select><Err e={fe.type} /></div>
          <div><label htmlFor="q-points" className={lbl}>Points <Req /></label><input id="q-points" name="points" type="number" min={1} max={100} defaultValue={sv.points ?? "5"} className={input} aria-invalid={!!fe.points} /><Err e={fe.points} /></div>
        </div>
      </section>

      <section className="rounded-2xl border border-line bg-white p-5 shadow-card">
        <h2 className="mb-1 flex items-center gap-3 text-base font-extrabold text-brand-dark"><ListChecks className="h-5 w-5 text-brand" aria-hidden />Options de réponse <Req /></h2>
        <p className="mb-3 text-xs text-muted">{trueFalse ? "Indiquez si l’affirmation est vraie ou fausse." : multi ? "Cochez toutes les bonnes réponses." : "Sélectionnez la bonne réponse."}</p>
        {trueFalse ? (
          <ul className="space-y-2">
            {["Vrai", "Faux"].map((label, i) => (
              <li key={label} className="flex items-center gap-3">
                <input type="radio" name="tf" checked={tf === i} onChange={() => setTf(i)} aria-label={`${label} est la bonne réponse`} className="h-5 w-5 accent-[var(--color-success)]" />
                <span className={cn("flex-1 rounded-lg border px-3 py-2.5 text-sm", tf === i ? "border-success/40 bg-success/10 font-semibold text-brand-dark" : "border-line text-brand-dark")}>{label}{tf === i && <span className="float-right inline-flex items-center gap-1 text-xs text-success"><CheckCircle2 className="h-4 w-4" aria-hidden />Bonne réponse</span>}</span>
              </li>
            ))}
            {tf !== null && <input type="hidden" name="correct" value={tf} />}
          </ul>
        ) : (
          <ul className="space-y-2">
            {options.map((o, i) => (
              <li key={i} className="flex items-center gap-3">
                <input type={multi ? "checkbox" : "radio"} name="mark" checked={o.correct} onChange={() => mark(i)} aria-label={`Option ${i + 1} : bonne réponse`} className="h-5 w-5 accent-[var(--color-success)]" />
                <div className={cn("flex flex-1 items-center gap-2 rounded-lg border px-3", o.correct ? "border-success/40 bg-success/10" : "border-line bg-white")}>
                  <input name="option" value={o.label} onChange={(e) => edit(i, e.target.value)} maxLength={300} placeholder={`Option ${i + 1}`} aria-label={`Texte de l’option ${i + 1}`} className="min-w-0 flex-1 bg-transparent py-2.5 text-sm text-brand-dark outline-none" />
                  {o.correct && <span className="inline-flex shrink-0 items-center gap-1 text-xs font-semibold text-success"><CheckCircle2 className="h-4 w-4" aria-hidden />Bonne réponse</span>}
                </div>
                {o.correct && <input type="hidden" name="correct" value={i} />}
                <button type="button" onClick={() => remove(i)} disabled={options.length <= 2} aria-label={`Supprimer l’option ${i + 1}`} className="rounded p-1.5 text-danger hover:bg-danger/10 disabled:opacity-30"><Trash2 className="h-4 w-4" aria-hidden /></button>
              </li>
            ))}
          </ul>
        )}
        <Err e={fe.options} />
        {!trueFalse && options.length < 10 && (
          <button type="button" onClick={() => setOptions((o) => [...o, { label: "", correct: false }])} className="mt-3 inline-flex items-center gap-2 rounded-lg bg-brand-soft px-4 py-2 text-sm font-semibold text-brand hover:bg-brand-soft/70"><Plus className="h-4 w-4" aria-hidden />Ajouter une option</button>
        )}
      </section>

      <section className="rounded-2xl border border-line bg-white p-5 shadow-card">
        <h2 className="mb-4 flex items-center gap-3 text-base font-extrabold text-brand-dark"><Settings className="h-5 w-5 text-brand" aria-hidden />Paramètres de la question <span className="text-sm font-normal text-muted">(optionnel)</span></h2>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-4">
            <div><label htmlFor="q-cat" className={lbl}>Catégorie / Thématique</label>
              <select id="q-cat" name="category" defaultValue={sv.category ?? ""} className={input}><option value="">Non précisée</option>{categories.map((c) => <option key={c} value={c}>{c}</option>)}</select></div>
            <div><label htmlFor="q-diff" className={lbl}>Niveau de difficulté</label>
              <select id="q-diff" name="difficulty" defaultValue={sv.difficulty ?? ""} className={input}><option value="">Non précisé</option>{Object.entries(DIFFICULTIES).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></div>
          </div>
          <div><label htmlFor="q-expl" className={lbl}>Explication / Feedback <span className="font-normal text-muted">(après la correction)</span></label>
            <textarea id="q-expl" name="explanation" rows={5} maxLength={EXPLANATION_MAX} value={explanation} onChange={(e) => setExplanation(e.target.value)} className={input} />
            <p className="mt-1 text-right text-xs text-muted">{explanation.length} / {EXPLANATION_MAX}</p><Err e={fe.explanation} /></div>
        </div>
      </section>
    </>
  );
}
