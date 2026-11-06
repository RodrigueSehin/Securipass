import { Suspense } from "react";
import { CreateEnrollmentForm, type CourseChoice, type LearnerChoice, type SessionChoice } from "@/components/admin/create-enrollment-form";
import { formatDayRange } from "@/lib/admin/sessions";
import type { MODES } from "@/lib/courses/labels";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { AdminPageHeader } from "@/components/admin/admin-page-header";

export const metadata = { title: "Nouvelle inscription" };

type SessionRow = { id: string; course_id: string; title: string; start_at: string; end_at: string; timezone: string; delivery_mode: keyof typeof MODES; location: string | null; capacity: number };

async function Form() {
  const supabase = await createClient();
  const admin = createAdminClient();
  const { data: role } = await admin.from("roles").select("id").eq("code", "learner").single<{ id: number }>();
  const { data: members } = await admin.from("user_roles").select("user_id").eq("role_id", role?.id ?? -1).limit(2000);
  const ids = (members ?? []).map((m) => m.user_id as string);
  const [people, courses, sessions] = await Promise.all([
    ids.length ? admin.from("profiles").select("id, full_name, email, phone, gender, birth_date").in("id", ids).eq("status", "active").order("full_name").limit(1000)
      .returns<{ id: string; full_name: string | null; email: string; phone: string | null; gender: string | null; birth_date: string | null }[]>() : Promise.resolve({ data: [] }),
    supabase.from("courses").select("id, title, price_amount").eq("status", "published").order("title").returns<{ id: string; title: string; price_amount: number | null }[]>(),
    supabase.from("sessions").select("id, course_id, title, start_at, end_at, timezone, delivery_mode, location, capacity")
      .eq("status", "scheduled").gt("end_at", new Date().toISOString()).order("start_at").limit(500).returns<SessionRow[]>(),
  ]);

  const learners: LearnerChoice[] = (people.data ?? []).map((p) => {
    const [first, ...rest] = (p.full_name || p.email).split(" ");
    return { id: p.id, firstName: first, lastName: rest.join(" "), email: p.email, phone: p.phone ?? "", gender: p.gender === "male" || p.gender === "female" || p.gender === "other" ? p.gender : "", birthDate: p.birth_date ?? "" };
  });
  const courseChoices: CourseChoice[] = (courses.data ?? []).map((c) => ({ id: c.id, title: c.title, price: Math.round(Number(c.price_amount ?? 0)) }));
  const rows = sessions.data ?? [];
  const taken = await Promise.all(rows.map(async (s) => (await supabase.rpc("session_seats_taken", { _session: s.id })).data as number | null));
  const sessionChoices: SessionChoice[] = rows.map((s, i) => ({
    id: s.id, courseId: s.course_id, label: `${s.title} (${formatDayRange(s.start_at, s.end_at, s.timezone)})`,
    mode: s.delivery_mode, location: s.location, capacity: s.capacity, free: Math.max(0, s.capacity - (taken[i] ?? 0)),
  }));
  return <CreateEnrollmentForm learners={learners} courses={courseChoices} sessions={sessionChoices} today={new Date().toISOString().slice(0, 10)} />;
}

export default function NewEnrollmentPage() {
  return (
    <div className="space-y-5">
      <AdminPageHeader crumbs={[{ label: "Inscriptions", href: "/admin/inscriptions" }, { label: "Nouvelle inscription" }]} icon="user-plus" title="Nouvelle inscription" description="Enregistrez l’inscription d’un apprenant à une formation et une session." />
      <Suspense fallback={<div className="h-96 animate-pulse rounded-2xl bg-white" aria-hidden />}>
        <Form />
      </Suspense>
    </div>
  );
}
