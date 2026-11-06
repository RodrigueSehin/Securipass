import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import { EmptyState, KpiCard, PageHeader } from "@/components/ui/feedback";

export const metadata = { title: "Tableau de bord entreprise" };

async function OrgContent() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: memberships } = await supabase
    .from("organization_members")
    .select("organization_id, role, organizations(name)")
    .eq("user_id", user!.id)
    .eq("status", "active");

  if (!memberships?.length) {
    return (
      <EmptyState title="Aucune organisation rattachée à votre compte">
        Votre organisation sera créée par notre équipe après étude de votre demande. Vous pouvez aussi nous écrire depuis la page Contact.
      </EmptyState>
    );
  }
  const orgIds = memberships.map((m) => m.organization_id);
  const { count } = await supabase.from("organization_members").select("id", { count: "exact", head: true }).in("organization_id", orgIds).eq("status", "active");
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <KpiCard label="Organisations" value={memberships.length} />
      <KpiCard label="Collaborateurs actifs" value={count ?? 0} />
    </div>
  );
}

export default function CompanyHome() {
  return (
    <>
      <PageHeader title="Tableau de bord" description="Les inscriptions collectives, certifications et rapports arrivent avec le Lot 7." />
      <Suspense fallback={<div className="h-28 animate-pulse rounded-2xl bg-white" aria-hidden />}>
        <OrgContent />
      </Suspense>
    </>
  );
}
