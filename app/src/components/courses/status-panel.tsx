"use client";

import { useActionState } from "react";
import Link from "next/link";
import { courseTransition } from "@/lib/courses/actions";
import type { FormState } from "@/lib/auth/actions";
import type { CourseStatus } from "@/lib/courses/labels";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/feedback";

const HELP: Record<CourseStatus, string> = {
  draft: "Votre formation est en brouillon. Quand le programme est complet, soumettez-la à la validation pédagogique.",
  in_review: "Votre formation est en cours de validation par un responsable pédagogique.",
  published: "Votre formation est publiée au catalogue. Toute modification substantielle la renvoie en validation.",
  rejected: "Votre formation a été refusée. Corrigez-la selon le motif, puis soumettez-la à nouveau.",
  archived: "Votre formation est archivée et n’apparaît plus au catalogue.",
};

export function StatusPanel({
  courseId, status, rejectionReason, slug,
}: { courseId: string; status: CourseStatus; rejectionReason: string | null; slug: string }) {
  const [state, action, pending] = useActionState<FormState, FormData>(courseTransition, {});
  const btn = (name: string, label: string, variant: "primary" | "outline" | "ghost" = "outline") => (
    <Button type="submit" name="action" value={name} variant={variant} disabled={pending}>{label}</Button>
  );

  return (
    <form action={action} className="mb-6 space-y-3 rounded-2xl border border-line bg-white p-5 shadow-card">
      <input type="hidden" name="courseId" value={courseId} />
      <p className="text-sm text-muted">{HELP[status]}</p>
      {status === "rejected" && rejectionReason && (
        <div className="rounded-lg bg-danger/10 p-3 text-sm text-danger"><span className="font-semibold">Motif du refus :</span> {rejectionReason}</div>
      )}
      {state.error && (
        <Alert>
          {state.error}
          {state.list && <ul className="mt-1 list-disc pl-5">{state.list.map((m) => <li key={m}>{m}</li>)}</ul>}
        </Alert>
      )}
      {state.message && <Alert tone="success">{state.message}</Alert>}
      <div className="flex flex-wrap gap-2">
        {(status === "draft" || status === "rejected") && btn("submit", "Soumettre à la validation", "primary")}
        {status === "in_review" && btn("withdraw", "Retirer de la validation")}
        {status === "published" && <Link href={`/formations/${slug}`} className="inline-flex items-center rounded-lg border border-brand px-5 py-2.5 text-sm font-semibold text-brand hover:bg-brand-soft">Voir la fiche publique</Link>}
        {status !== "archived" && btn("archive", "Archiver", "ghost")}
        {status === "archived" && btn("restore", "Remettre en brouillon")}
      </div>
    </form>
  );
}
