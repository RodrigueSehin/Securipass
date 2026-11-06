import { Suspense } from "react";
import { CreateEvaluationForm, type SessionChoice } from "@/components/admin/create-evaluation-form";
import { formatDayRange } from "@/lib/admin/sessions";
import { createClient } from "@/lib/supabase/server";
import { AdminPageHeader } from "@/components/admin/admin-page-header";

export const metadata = { title: "Nouvelle évaluation" };

type SessionRow = { id: string; course_id: string; title: string; start_at: string; end_at: string; timezone: string };

const part = (iso: string, timeZone: string, o: Intl.DateTimeFormatOptions, locale: string) => new Intl.DateTimeFormat(locale, { ...o, timeZone }).format(new Date(iso));

async function Form() {
  const supabase = await createClient();
  const [courses, sessions] = await Promise.all([
    supabase.from("courses").select("id, title").eq("status", "published").order("title").returns<{ id: string; title: string }[]>(),
    supabase.from("sessions").select("id, course_id, title, start_at, end_at, timezone").neq("status", "draft").neq("status", "cancelled").gt("end_at", new Date().toISOString()).order("start_at").limit(500).returns<SessionRow[]>(),
  ]);
  const choices: SessionChoice[] = (sessions.data ?? []).map((s) => ({
    id: s.id, courseId: s.course_id, label: `${s.title} (${formatDayRange(s.start_at, s.end_at, s.timezone)})`, timezone: s.timezone,
    startDate: part(s.start_at, s.timezone, { year: "numeric", month: "2-digit", day: "2-digit" }, "en-CA"),
    startTime: part(s.start_at, s.timezone, { hour: "2-digit", minute: "2-digit", hourCycle: "h23" }, "en-GB"),
    endDate: part(s.end_at, s.timezone, { year: "numeric", month: "2-digit", day: "2-digit" }, "en-CA"),
    endTime: part(s.end_at, s.timezone, { hour: "2-digit", minute: "2-digit", hourCycle: "h23" }, "en-GB"),
  }));
  return <CreateEvaluationForm courses={courses.data ?? []} sessions={choices} />;
}

export default function NewEvaluationPage() {
  return (
    <div className="space-y-5">
      <AdminPageHeader crumbs={[{ label: "Évaluations", href: "/admin/evaluations" }, { label: "Nouvelle évaluation" }]} icon="evaluation" title="Nouvelle évaluation" description="Créez une nouvelle évaluation (QCM, pratique, devoir…) et paramétrez ses conditions." />
      <Suspense fallback={<div className="h-96 animate-pulse rounded-2xl bg-white" aria-hidden />}>
        <Form />
      </Suspense>
    </div>
  );
}
