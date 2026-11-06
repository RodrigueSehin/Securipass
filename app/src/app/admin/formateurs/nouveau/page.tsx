import { Suspense } from "react";
import { CreateTrainerForm, type CourseOption } from "@/components/admin/create-trainer-form";
import { createClient } from "@/lib/supabase/server";
import { AdminPageHeader } from "@/components/admin/admin-page-header";

export const metadata = { title: "Ajouter un formateur" };

type CourseRow = Omit<CourseOption, "category"> & { category: { name: string } | null };

async function Form() {
  const supabase = await createClient();
  const [cats, orgs, courses] = await Promise.all([
    supabase.from("categories").select("id, name").order("name").returns<{ id: string; name: string }[]>(),
    supabase.from("organizations").select("id, name").eq("status", "active").order("name").returns<{ id: string; name: string }[]>(),
    supabase.from("courses").select("id, title, duration_minutes, price_amount, cover_url, category:categories(name)").eq("status", "published").order("title").returns<CourseRow[]>(),
  ]);
  const options: CourseOption[] = (courses.data ?? []).map((c) => ({ ...c, category: c.category?.name ?? null }));
  return <CreateTrainerForm categories={cats.data ?? []} organizations={orgs.data ?? []} courses={options} />;
}

export default function NewTrainerPage() {
  return (
    <div className="space-y-5">
      <AdminPageHeader crumbs={[{ label: "Formateurs", href: "/admin/formateurs" }, { label: "Ajouter un formateur" }]} icon="user-plus" title="Ajouter un formateur" description="Créez un nouveau formateur et attribuez-lui ses spécialités et formations." />
      <Suspense fallback={<div className="h-96 animate-pulse rounded-2xl bg-white" aria-hidden />}>
        <Form />
      </Suspense>
    </div>
  );
}
