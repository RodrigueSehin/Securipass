import { Suspense } from "react";
import { CreateCategoryForm } from "@/components/admin/create-category-form";
import { Alert } from "@/components/ui/feedback";
import { createClient } from "@/lib/supabase/server";
import { AdminPageHeader } from "@/components/admin/admin-page-header";

export const metadata = { title: "Ajouter une catégorie" };

type SP = Promise<{ parent?: string; resultat?: string }>;

async function Form({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const supabase = await createClient();
  // Seules les catégories principales peuvent être parentes (un seul niveau de sous-catégories)
  const { data } = await supabase.from("categories").select("id, name").is("parent_id", null).order("name").returns<{ id: string; name: string }[]>();
  const parents = data ?? [];
  const defaultParent = parents.some((p) => p.id === sp.parent) ? sp.parent! : "";
  return (
    <>
      {sp.resultat === "cree" && <div className="mb-5"><Alert tone="success">La catégorie a été créée. Vous pouvez ajouter une sous-catégorie.</Alert></div>}
      <CreateCategoryForm key={defaultParent} parents={parents} defaultParent={defaultParent} />
    </>
  );
}

export default function NewCategoryPage({ searchParams }: { searchParams: SP }) {
  return (
    <div className="space-y-5">
      <AdminPageHeader crumbs={[{ label: "Catégories", href: "/admin/categories" }, { label: "Ajouter une catégorie" }]} icon="folder" title="Ajouter une catégorie" description="Créez une nouvelle catégorie pour organiser les formations de la plateforme." />
      <Suspense fallback={<div className="h-96 animate-pulse rounded-2xl bg-white" aria-hidden />}>
        <Form searchParams={searchParams} />
      </Suspense>
    </div>
  );
}
