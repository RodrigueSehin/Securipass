"use client";

import { useActionState } from "react";
import { askQuestion, replyToThread } from "@/lib/forum/actions";
import type { FormState } from "@/lib/auth/actions";
import { Alert } from "@/components/ui/feedback";
import { Button } from "@/components/ui/button";
import { Field, TextareaField } from "@/components/ui/field";

export function AskForm({ courseId }: { courseId: string }) {
  const [state, action, pending] = useActionState<FormState, FormData>(askQuestion, {});
  return (
    <form action={action} className="space-y-3" noValidate>
      <input type="hidden" name="courseId" value={courseId} />
      {state.error && <Alert>{state.error}</Alert>}
      {state.message && <Alert tone="success">{state.message}</Alert>}
      <Field label="Titre de votre question" name="title" id="forum-title" maxLength={200} required defaultValue={state.values?.title} />
      <TextareaField label="Détails" name="body" id="forum-body" rows={4} maxLength={4000} required defaultValue={state.values?.body} />
      <Button type="submit" disabled={pending}>{pending ? "Publication…" : "Publier la question"}</Button>
    </form>
  );
}

export function ReplyForm({ courseId, threadId }: { courseId: string; threadId: string }) {
  const [state, action, pending] = useActionState<FormState, FormData>(replyToThread, {});
  return (
    <form action={action} className="space-y-2" noValidate>
      <input type="hidden" name="courseId" value={courseId} />
      <input type="hidden" name="threadId" value={threadId} />
      {state.error && <Alert>{state.error}</Alert>}
      {state.message && <Alert tone="success">{state.message}</Alert>}
      <TextareaField label="Votre réponse" name="body" id={`reply-${threadId}`} rows={3} maxLength={4000} required defaultValue={state.values?.body} />
      <Button type="submit" disabled={pending}>{pending ? "Envoi…" : "Répondre"}</Button>
    </form>
  );
}
