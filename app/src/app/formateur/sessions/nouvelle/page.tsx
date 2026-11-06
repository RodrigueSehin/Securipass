import { Suspense } from "react";
import { SessionWizardFrame } from "@/components/sessions/session-wizard-frame";
import { SessionWizardForm } from "@/components/sessions/session-wizard-form";
import { EmptyState } from "@/components/ui/feedback";
import { withCovers } from "@/lib/sessions/covers";
import { loadWizardCourses } from "@/lib/sessions/wizard-queries";
import Link from "next/link";

export const metadata = { title: "Créer une session" };

async function Step1({ searchParams }: { searchParams: Promise<{ formation?: string }> }) {
  const [{ formation }, courses] = await Promise.all([searchParams, loadWizardCourses()]);
  if (courses.length === 0) {
    return (
      <EmptyState title="Aucune formation disponible">
        Créez d’abord une formation : une session est toujours rattachée à une formation.{" "}
        <Link href="/formateur/formations/nouveau" className="font-semibold text-brand hover:underline">Créer une formation</Link>
      </EmptyState>
    );
  }
  const initial = courses.some((c) => c.id === formation) ? { courseId: formation } : {};
  return (
    <SessionWizardFrame step={1}>
      <SessionWizardForm step={1} initial={initial} courses={withCovers(courses)} />
    </SessionWizardFrame>
  );
}

export default function NewSessionPage(props: { searchParams: Promise<{ formation?: string }> }) {
  return (
    <Suspense fallback={<div className="h-96 animate-pulse rounded-2xl bg-white" aria-hidden />}>
      <Step1 searchParams={props.searchParams} />
    </Suspense>
  );
}
