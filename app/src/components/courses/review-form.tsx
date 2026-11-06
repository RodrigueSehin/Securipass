"use client";

import { useActionState } from "react";
import { reviewCourse } from "@/lib/admin/actions";
import type { FormState } from "@/lib/auth/actions";
import type { CourseStatus } from "@/lib/courses/labels";
import { Button } from "@/components/ui/button";
import { TextareaField } from "@/components/ui/field";
import { Alert } from "@/components/ui/feedback";

export function ReviewForm({ courseId, status }: { courseId: string; status: CourseStatus }) {
  const [state, action, pending] = useActionState<FormState, FormData>(reviewCourse, {});
  return (
    <form action={action} className="space-y-4 rounded-2xl border border-line bg-white p-5 shadow-card">
      <input type="hidden" name="courseId" value={courseId} />
      <h2 className="text-lg font-bold text-brand-dark">Décision pédagogique</h2>
      {state.error && <Alert>{state.error}</Alert>}
      {state.message && <Alert tone="success">{state.message}</Alert>}
      {status === "in_review" || status === "published" ? (
        <TextareaField label="Motif (obligatoire en cas de refus)" name="reason" rows={3} errors={state.fieldErrors?.reason} hint="Soyez précis : ce motif est communiqué au formateur." />
      ) : (
        <p className="text-sm text-muted">Cette formation n’est pas en attente de validation.</p>
      )}
      <div className="flex flex-wrap gap-2">
        {status === "in_review" && (
          <>
            <Button type="submit" name="decision" value="publish" disabled={pending}>Valider et publier</Button>
            <Button type="submit" name="decision" value="reject" variant="outline" disabled={pending} className="border-danger text-danger hover:bg-danger/10">Refuser</Button>
          </>
        )}
        {(status === "published" || status === "in_review" || status === "draft" || status === "rejected") && (
          <Button type="submit" name="decision" value="archive" variant="ghost" disabled={pending}>Archiver</Button>
        )}
      </div>
    </form>
  );
}
