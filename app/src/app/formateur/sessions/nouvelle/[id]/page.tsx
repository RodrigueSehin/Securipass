import { Suspense } from "react";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ConfirmButtons, SessionWizardReview } from "@/components/sessions/session-wizard-review";
import { SessionWizardForm } from "@/components/sessions/session-wizard-form";
import { SessionWizardFrame } from "@/components/sessions/session-wizard-frame";
import { withCovers } from "@/lib/sessions/covers";
import { parseSessionStep } from "@/lib/sessions/wizard";
import { getSessionDraft, loadWizardCourses } from "@/lib/sessions/wizard-queries";

export const metadata = { title: "Créer une session" };

const currentTime = () => Date.now();

/** Jours (AAAA-MM-JJ) où le formateur a déjà une session, pour le calendrier de planification. */
async function busyDates(): Promise<string[]> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];
  const { data } = await supabase.from("sessions").select("start_at").eq("instructor_id", user.id).neq("status", "cancelled").returns<{ start_at: string }[]>();
  return [...new Set((data ?? []).map((s) => s.start_at.slice(0, 10)))];
}

type Props = { params: Promise<{ id: string }>; searchParams: Promise<{ etape?: string; erreur?: string }> };

async function Wizard({ params, searchParams }: Props) {
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const [draft, courses] = await Promise.all([getSessionDraft(id), loadWizardCourses()]);
  if (!draft) notFound();
  const step = parseSessionStep(sp.etape);
  const options = withCovers(courses);

  if (step === 4) {
    return (
      <SessionWizardFrame draftId={id} step={4} hasForm={false} lastAction={<ConfirmButtons draftId={id} />}>
        <SessionWizardReview draftId={id} data={draft.data} course={courses.find((c) => c.id === draft.data.courseId)} error={sp.erreur} />
      </SessionWizardFrame>
    );
  }
  return (
    <SessionWizardFrame draftId={id} step={step}>
      <SessionWizardForm key={step} step={step as 1 | 2 | 3} draftId={id} initial={draft.data} courses={options}
        busyDates={step === 2 ? await busyDates() : []} nowMs={currentTime()} />
    </SessionWizardFrame>
  );
}

export default function SessionWizardPage(props: Props) {
  return (
    <Suspense fallback={<div className="h-96 animate-pulse rounded-2xl bg-white" aria-hidden />}>
      <Wizard {...props} />
    </Suspense>
  );
}
