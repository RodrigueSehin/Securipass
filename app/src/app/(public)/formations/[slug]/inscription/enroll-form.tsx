"use client";

import Link from "next/link";
import { useActionState } from "react";
import { enrollSelf } from "@/lib/enrollments/actions";
import type { FormState } from "@/lib/auth/actions";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Alert, StatusBadge } from "@/components/ui/feedback";
import { sessionState, type PublicSession } from "@/lib/courses/types";
import { MODES } from "@/lib/courses/labels";
import { formatDate, formatTimeRange } from "@/lib/format";

export function EnrollForm({
  courseId, sessions, cancellationPolicy, mode = "free",
}: { courseId: string; sessions: PublicSession[]; cancellationPolicy: string | null; mode?: "free" | "approval" | "code" }) {
  const [state, action, pending] = useActionState<FormState, FormData>(enrollSelf, {});
  const needsSession = sessions.length > 0;
  const selectable = sessions.filter((s) => ["open", "waitlist"].includes(sessionState(s)));

  return (
    <form action={action} className="space-y-5" noValidate>
      <input type="hidden" name="courseId" value={courseId} />
      {state.error && <Alert>{state.error}</Alert>}

      {needsSession && (
        <fieldset className="space-y-2">
          <legend className="mb-1 text-sm font-semibold text-brand-dark">Choisissez une session</legend>
          {selectable.length === 0 && <Alert tone="info">Aucune session n’est ouverte à l’inscription pour le moment.</Alert>}
          {sessions.map((s) => {
            const st = sessionState(s);
            const ok = st === "open" || st === "waitlist";
            return (
              <label key={s.id} className={`flex items-start gap-3 rounded-xl border p-4 ${ok ? "cursor-pointer border-line bg-white hover:border-brand" : "border-line bg-surface opacity-60"}`}>
                <input type="radio" name="sessionId" value={s.id} disabled={!ok} required className="mt-1" />
                <span className="flex-1 text-sm">
                  <span className="block font-semibold text-brand-dark">{s.title}</span>
                  <span className="block text-muted">{formatDate(s.start_at, s.timezone)} · {formatTimeRange(s.start_at, s.end_at, s.timezone)}</span>
                  <span className="block text-muted">{MODES[s.delivery_mode]}{s.location ? ` · ${s.location}` : ""}</span>
                </span>
                {st === "waitlist" && <StatusBadge tone="info">Liste d’attente</StatusBadge>}
                {st === "full" && <StatusBadge tone="danger">Complète</StatusBadge>}
                {st === "closed" && <StatusBadge tone="neutral">Clôturée</StatusBadge>}
              </label>
            );
          })}
          {state.fieldErrors?.sessionId && <p role="alert" className="text-xs text-danger">{state.fieldErrors.sessionId[0]}</p>}
        </fieldset>
      )}

      {mode === "approval" && <Alert tone="info">L’inscription à cette formation est soumise à la validation du formateur : vous serez notifié de sa décision.</Alert>}
      {mode === "code" && (
        <Field label="Code d’accès" name="accessCode" required autoComplete="off" hint="Code communiqué par le formateur ou l’organisme." errors={state.fieldErrors?.accessCode} className="max-w-xs" />
      )}

      {cancellationPolicy && (
        <div className="rounded-xl bg-surface p-4 text-sm text-muted">
          <p className="font-semibold text-brand-dark">Conditions d’annulation</p>
          <p className="mt-1 whitespace-pre-line">{cancellationPolicy}</p>
        </div>
      )}

      <div>
        <label className="flex items-start gap-2 text-sm text-muted">
          <input type="checkbox" name="accept" className="mt-0.5" required />
          <span>J’ai lu et j’accepte les <Link href="/conditions" className="text-brand underline">conditions d’utilisation</Link>{cancellationPolicy ? " et les conditions d’annulation ci-dessus" : ""}.</span>
        </label>
        {state.fieldErrors?.accept && <p role="alert" className="mt-1 text-xs text-danger">{state.fieldErrors.accept[0]}</p>}
      </div>

      <Button type="submit" variant="cta" disabled={pending || (needsSession && selectable.length === 0)}>
        {pending ? "Envoi…" : mode === "approval" ? "Envoyer ma demande d’inscription" : "Confirmer mon inscription"}
      </Button>
    </form>
  );
}
