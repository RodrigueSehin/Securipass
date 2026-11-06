"use client";

import { useActionState, useState } from "react";
import { Star } from "lucide-react";
import { submitReview } from "@/lib/learner/actions";
import type { FormState } from "@/lib/auth/actions";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/feedback";
import { TextareaField } from "@/components/ui/field";
import { cn } from "@/lib/utils";

/** Avis de l'apprenant sur une formation terminée : note de 1 à 5 et commentaire facultatif. */
export function ReviewForm({ courseId, rating, comment }: { courseId: string; rating?: number; comment?: string | null }) {
  const [state, action, pending] = useActionState<FormState, FormData>(submitReview, {});
  const [value, setValue] = useState(rating ?? 0);
  const fe = state.fieldErrors;
  return (
    <form action={action} className="mt-3 space-y-3" noValidate>
      <input type="hidden" name="courseId" value={courseId} />
      {state.error && <Alert>{state.error}</Alert>}
      {state.message && <Alert tone="success">{state.message}</Alert>}
      <fieldset>
        <legend className="mb-1 text-sm font-medium text-brand-dark">Votre note</legend>
        <div className="flex gap-1">
          {[1, 2, 3, 4, 5].map((n) => (
            <label key={n} className="cursor-pointer">
              <input type="radio" name="rating" value={n} checked={value === n} onChange={() => setValue(n)} className="peer sr-only" />
              <span className="sr-only">{n} sur 5</span>
              <Star className={cn("h-7 w-7 peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-brand", n <= value ? "fill-warning text-warning" : "text-line")} aria-hidden />
            </label>
          ))}
        </div>
        {fe?.rating && <p role="alert" className="mt-1 text-xs text-danger">{fe.rating[0]}</p>}
      </fieldset>
      <TextareaField label="Commentaire (facultatif)" name="comment" rows={3} maxLength={1000} defaultValue={comment ?? ""} errors={fe?.comment} />
      <Button type="submit" disabled={pending}>{pending ? "Envoi…" : rating ? "Mettre à jour mon avis" : "Publier mon avis"}</Button>
    </form>
  );
}
