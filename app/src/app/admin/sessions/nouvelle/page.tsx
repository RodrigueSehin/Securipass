import { Suspense } from "react";
import { CreateSessionForm, type CourseChoice, type TrainerChoice } from "@/components/admin/create-session-form";
import { categoryUi } from "@/content/categories";
import { loadTrainers } from "@/lib/admin/trainers-queries";
import { publicImage } from "@/lib/images";
import { createClient } from "@/lib/supabase/server";
import { AdminPageHeader } from "@/components/admin/admin-page-header";

export const metadata = { title: "Ajouter une session" };

type CourseRow = { id: string; title: string; cover_url: string | null; category: { slug: string; name: string } | null };

async function Form({ searchParams }: { searchParams: Promise<{ formation?: string }> }) {
  const { formation } = await searchParams;
  const supabase = await createClient();
  const [courses, trainers] = await Promise.all([
    supabase.from("courses").select("id, title, cover_url, category:categories(slug, name)").eq("status", "published").order("title").returns<CourseRow[]>(),
    loadTrainers({ q: "", category: "", status: "active", contract: "", sort: "recent" }, 100, 0),
  ]);
  const choices: CourseChoice[] = (courses.data ?? []).map((c) => {
    const ui = categoryUi(c.category?.slug, c.category?.name);
    return { id: c.id, title: c.title, cover: c.cover_url ?? (ui.image ? publicImage(`home/${ui.image}`) : null) };
  });
  const people: TrainerChoice[] = trainers.rows.map((t) => ({ id: t.id, name: t.full_name || t.email, avatar: t.avatar_url }));
  return <CreateSessionForm courses={choices} trainers={people} defaultCourse={choices.some((c) => c.id === formation) ? formation! : ""} />;
}

export default function NewSessionPage({ searchParams }: { searchParams: Promise<{ formation?: string }> }) {
  return (
    <div className="space-y-5">
      <AdminPageHeader crumbs={[{ label: "Sessions", href: "/admin/sessions" }, { label: "Ajouter une session" }]} icon="calendar" title="Ajouter une session" description="Planifiez une nouvelle session de formation et configurez tous les paramètres en une seule étape." />
      <Suspense fallback={<div className="h-96 animate-pulse rounded-2xl bg-white" aria-hidden />}>
        <Form searchParams={searchParams} />
      </Suspense>
    </div>
  );
}
