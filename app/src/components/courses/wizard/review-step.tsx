"use client";

import { useActionState } from "react";
import { Rocket } from "lucide-react";
import { courseTransition } from "@/lib/courses/actions";
import type { FormState } from "@/lib/auth/actions";
import { Alert } from "@/components/ui/feedback";

/** Soumission de la formation à la validation pédagogique (dernière étape). Les éléments manquants s'affichent au-dessus du bouton. */
export function SubmitForReview({ courseId }: { courseId: string }) {
  const [state, action, pending] = useActionState<FormState, FormData>(courseTransition, {});
  return (
    <form action={action} className="relative">
      <input type="hidden" name="courseId" value={courseId} />
      <input type="hidden" name="action" value="submit" />
      {(state.error || state.message) && (
        <div className="absolute bottom-full right-0 mb-3 w-80 max-w-[85vw] rounded-xl border border-line bg-white p-3 shadow-card">
          {state.error && <Alert>{state.error}</Alert>}
          {state.message && <Alert tone="success">{state.message}</Alert>}
          {state.list && state.list.length > 0 && (
            <ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-brand-dark">{state.list.map((m) => <li key={m}>{m}</li>)}</ul>
          )}
        </div>
      )}
      <button
        type="submit"
        disabled={pending}
        className="inline-flex items-center justify-center gap-2 rounded-lg bg-cta px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-cta-dark disabled:cursor-not-allowed disabled:opacity-50"
      >
        <Rocket className="h-4 w-4" aria-hidden /> {pending ? "Envoi…" : "Soumettre à la validation"}
      </button>
    </form>
  );
}
