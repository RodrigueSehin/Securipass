import { Suspense } from "react";
import { CreateUserForm } from "@/components/admin/create-user-form";
import { createClient } from "@/lib/supabase/server";
import { AdminPageHeader } from "@/components/admin/admin-page-header";

export const metadata = { title: "Ajouter un utilisateur" };

async function Form() {
  const supabase = await createClient();
  const { data } = await supabase.from("organizations").select("id, name").eq("status", "active").order("name").returns<{ id: string; name: string }[]>();
  return <CreateUserForm organizations={data ?? []} />;
}

export default function NewUserPage() {
  return (
    <div className="space-y-5">
      <AdminPageHeader crumbs={[{ label: "Utilisateurs", href: "/admin/utilisateurs" }, { label: "Ajouter un utilisateur" }]} icon="user-plus" title="Ajouter un utilisateur" description="Créez un nouvel utilisateur et attribuez-lui un ou plusieurs rôles." />
      <Suspense fallback={<div className="h-96 animate-pulse rounded-2xl bg-white" aria-hidden />}>
        <Form />
      </Suspense>
    </div>
  );
}
