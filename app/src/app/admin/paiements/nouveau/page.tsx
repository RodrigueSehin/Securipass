import { Suspense } from "react";
import { connection } from "next/server";
import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { CreatePaymentForm, type PayCourse, type PaySession } from "@/components/admin/create-payment-form";
import { categoryUi } from "@/content/categories";
import { loadPaymentOptions } from "@/lib/admin/payments-queries";
import { formatDayRange } from "@/lib/admin/sessions";
import { LEVELS } from "@/lib/courses/labels";
import { publicImage } from "@/lib/images";
import { createClient } from "@/lib/supabase/server";
import { formatDuration } from "@/lib/utils";

export const metadata = { title: "Nouveau paiement" };

type CourseRow = { id: string; title: string; price_amount: number | null; level: keyof typeof LEVELS | null; duration_minutes: number | null; cover_url: string | null; category: { slug: string; name: string } | null };
type SessionRow = { id: string; course_id: string; title: string; start_at: string; end_at: string; timezone: string };

async function Form() {
  await connection();
  const supabase = await createClient();
  const [options, courses, sessions] = await Promise.all([
    loadPaymentOptions(),
    supabase.from("courses").select("id, title, price_amount, level, duration_minutes, cover_url, category:categories(slug, name)").eq("status", "published").order("title").returns<CourseRow[]>(),
    supabase.from("sessions").select("id, course_id, title, start_at, end_at, timezone").neq("status", "draft").order("start_at", { ascending: false }).limit(500).returns<SessionRow[]>(),
  ]);
  const courseChoices: PayCourse[] = (courses.data ?? []).map((c) => {
    const ui = categoryUi(c.category?.slug, c.category?.name);
    return {
      id: c.id, title: c.title, price: Math.round(Number(c.price_amount ?? 0)), level: c.level ? LEVELS[c.level].toLowerCase() : null,
      durationLabel: c.duration_minutes ? formatDuration(c.duration_minutes) : null, cover: c.cover_url ?? (ui.image ? publicImage(`home/${ui.image}`) : null),
    };
  });
  const sessionChoices: PaySession[] = (sessions.data ?? []).map((s) => ({ id: s.id, courseId: s.course_id, label: `${s.title} (${formatDayRange(s.start_at, s.end_at, s.timezone)})` }));
  const now = new Date().toISOString();
  return <CreatePaymentForm options={options} courses={courseChoices} sessions={sessionChoices} today={now.slice(0, 10)} nowTime={now.slice(11, 16)} />;
}

export default function NewPaymentPage() {
  return (
    <div className="space-y-5">
      <AdminPageHeader crumbs={[{ label: "Paiements", href: "/admin/paiements" }, { label: "Nouveau paiement" }]} icon="payment" title="Nouveau paiement" description="Enregistrez un paiement pour une formation, une certification, une session ou un autre service." />
      <Suspense fallback={<div className="h-96 animate-pulse rounded-2xl bg-white" aria-hidden />}>
        <Form />
      </Suspense>
    </div>
  );
}
