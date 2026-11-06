"use client";

import { useActionState, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { RotateCcw, Save, Search, SlidersHorizontal } from "lucide-react";
import { Alert } from "@/components/ui/feedback";
import type { FormState } from "@/lib/auth/actions";
import { toScale } from "@/lib/courses/grading";
import { ASSESSMENT_STATUS, COMMENT_MAX, type AssessmentStatus } from "@/lib/instructor/assessments";
import { saveAssessment } from "@/lib/instructor/assessments-actions";

const field = "w-full rounded-lg border border-line bg-white px-3 py-2.5 text-sm text-brand-dark outline-none focus:border-brand focus:ring-2 focus:ring-brand/20";

/** Choix de la session évaluée : la page se recharge dès le choix. */
export function SessionPicker({ sessions, value }: { sessions: { id: string; label: string }[]; value: string }) {
  const router = useRouter();
  return (
    <select aria-label="Session" value={value} onChange={(e) => router.push(`/formateur/evaluations?session=${e.target.value}`)} className={`${field} min-w-64`}>
      {sessions.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
    </select>
  );
}

/** Recherche et filtre par statut, appliqués dès le choix. */
export function RosterFilters({ session, q, status, hrefReset }: { session: string; q: string; status: string; hrefReset: string }) {
  const form = useRef<HTMLFormElement>(null);
  return (
    <div className="flex flex-wrap items-center gap-2">
      <form ref={form} role="search" className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
        <input type="hidden" name="session" value={session} />
        <div className="relative min-w-48 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-brand" aria-hidden />
          <input name="q" type="search" defaultValue={q} placeholder="Rechercher un apprenant par nom ou email…" aria-label="Rechercher un apprenant" className={`${field} pl-9`} />
        </div>
        <select name="statut" defaultValue={status} aria-label="Statut" onChange={() => form.current?.requestSubmit()} className={`${field} sm:w-48`}>
          <option value="">Tous les statuts</option>
          {(Object.keys(ASSESSMENT_STATUS) as AssessmentStatus[]).map((k) => <option key={k} value={k}>{ASSESSMENT_STATUS[k].label}</option>)}
        </select>
      </form>
      <Link href={hrefReset} aria-label="Réinitialiser les filtres" title="Réinitialiser les filtres" className="rounded-lg border border-line p-2.5 text-brand hover:bg-brand-soft"><SlidersHorizontal className="h-4 w-4" aria-hidden /></Link>
    </div>
  );
}

export function PageSizeSelect({ value, options, hrefs }: { value: number; options: readonly number[]; hrefs: Record<number, string> }) {
  const router = useRouter();
  return (
    <label className="flex items-center gap-2 text-sm text-brand-dark">
      Éléments par page
      <select defaultValue={value} aria-label="Éléments par page" className="rounded-lg border border-line bg-white px-2 py-1.5 text-sm" onChange={(e) => router.push(hrefs[Number(e.target.value)])}>
        {options.map((n) => <option key={n} value={n}>{n}</option>)}
      </select>
    </label>
  );
}

type Saved = { scorePercent: number; passed: boolean; comment: string | null } | null;

/** Note finale, résultat et commentaire global de l'apprenant. */
export function AssessmentForm({ sessionId, learnerId, scale, passMark, saved }: { sessionId: string; learnerId: string; scale: number; passMark: number; saved: Saved }) {
  const [state, action, pending] = useActionState<FormState, FormData>(saveAssessment, {});
  const [formKey, setFormKey] = useState(0);
  const sv = state.values;
  const initialScore = sv?.score ?? (saved ? String(toScale(saved.scorePercent, scale)).replace(".", ",") : "");
  const [score, setScore] = useState(initialScore);
  const [result, setResult] = useState(sv?.result ?? (saved ? (saved.passed ? "passed" : "failed") : "passed"));
  const [comment, setComment] = useState(sv?.comment ?? saved?.comment ?? "");
  const fe = state.fieldErrors ?? {};

  const onScore = (v: string) => {
    setScore(v);
    const n = Number(v.replace(",", "."));
    if (v.trim() && Number.isFinite(n) && n >= 0 && n <= scale) setResult((n * 100) / scale >= passMark ? "passed" : "failed");
  };
  const reset = () => { setScore(saved ? String(toScale(saved.scorePercent, scale)).replace(".", ",") : ""); setResult(saved ? (saved.passed ? "passed" : "failed") : "passed"); setComment(saved?.comment ?? ""); setFormKey((k) => k + 1); };

  return (
    <form key={formKey} action={action} className="space-y-4" noValidate>
      <input type="hidden" name="sessionId" value={sessionId} />
      <input type="hidden" name="learnerId" value={learnerId} />
      {state.error && <Alert>{state.error}</Alert>}
      {state.message && <Alert tone="success">{state.message}</Alert>}
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor="score" className="mb-1 block text-sm font-semibold text-brand-dark">Note finale (sur {scale}) <span className="text-danger">*</span></label>
          <input id="score" name="score" inputMode="decimal" value={score} onChange={(e) => onScore(e.target.value)} aria-invalid={Boolean(fe.score)} className={field} />
          {fe.score?.[0] && <p role="alert" className="mt-1 text-xs text-danger">{fe.score[0]}</p>}
        </div>
        <div>
          <label htmlFor="result" className="mb-1 block text-sm font-semibold text-brand-dark">Statut</label>
          <select id="result" name="result" value={result} onChange={(e) => setResult(e.target.value)} className={`${field} ${result === "passed" ? "bg-success/10" : "bg-danger/10"}`}>
            <option value="passed">Réussi</option>
            <option value="failed">Non réussi</option>
          </select>
        </div>
      </div>
      <div>
        <label htmlFor="comment" className="mb-1 block text-sm font-semibold text-brand-dark">Commentaire global (optionnel)</label>
        <textarea id="comment" name="comment" rows={4} maxLength={COMMENT_MAX} value={comment} onChange={(e) => setComment(e.target.value)} aria-invalid={Boolean(fe.comment)} className={field} />
        <p className="mt-1 text-right text-xs text-muted">{comment.length}/{COMMENT_MAX}</p>
        {fe.comment?.[0] && <p role="alert" className="text-xs text-danger">{fe.comment[0]}</p>}
      </div>
      <div className="flex flex-wrap gap-3">
        <button type="button" onClick={reset} className="inline-flex items-center gap-2 rounded-lg border border-brand px-5 py-2.5 text-sm font-semibold text-brand hover:bg-brand-soft"><RotateCcw className="h-4 w-4" aria-hidden /> Réinitialiser</button>
        <button type="submit" disabled={pending} className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg bg-brand px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-dark disabled:opacity-60"><Save className="h-4 w-4" aria-hidden /> {pending ? "Enregistrement…" : "Enregistrer l’évaluation"}</button>
      </div>
    </form>
  );
}
