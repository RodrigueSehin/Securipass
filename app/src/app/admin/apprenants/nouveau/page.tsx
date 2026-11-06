import { Suspense } from "react";
import { CreateLearnerForm } from "@/components/admin/create-learner-form";
import { formatDayRange } from "@/lib/admin/sessions";
import { createClient } from "@/lib/supabase/server";
import { AdminPageHeader } from "@/components/admin/admin-page-header";

export const metadata = { title: "Nouvel apprenant" };

type SessionRow = { id: string; course_id: string; title: string; start_at: string; end_at: string; timezone: string };

async function Form() {
  const supabase = await createClient();
  const [courses, sessions, orgs] = await Promise.all([
    supabase.from("courses").select("id, title").eq("status", "published").order("title").returns<{ id: string; title: string }[]>(),
    supabase.from("sessions").select("id, course_id, title, start_at, end_at, timezone").eq("status", "scheduled").gt("end_at", new Date().toISOString()).order("start_at").limit(500).returns<SessionRow[]>(),
    supabase.from("organizations").select("id, name").eq("status", "active").order("name").returns<{ id: string; name: string }[]>(),
  ]);
  const sessionChoices = (sessions.data ?? []).map((s) => ({ id: s.id, courseId: s.course_id, label: `${s.title} (${formatDayRange(s.start_at, s.end_at, s.timezone)})` }));
  return <CreateLearnerForm courses={courses.data ?? []} sessions={sessionChoices} organizations={orgs.data ?? []} />;
}

export default function NewLearnerPage() {
  return (
    <div className="space-y-5">
      <AdminPageHeader crumbs={[{ label: "Apprenants", href: "/admin/apprenants" }, { label: "Nouvel apprenant" }]} icon="user-plus" title="Nouvel apprenant" description="Inscrivez un nouvel apprenant sur la plateforme." />
      <Suspense fallback={<div className="h-96 animate-pulse rounded-2xl bg-white" aria-hidden />}>
        <Form />
      </Suspense>
    </div>
  );
}
