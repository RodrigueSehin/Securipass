import { Suspense } from "react";
import { connection } from "next/server";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { CreatePayoutForm } from "@/components/admin/create-payout-form";
import { Alert, EmptyState } from "@/components/ui/feedback";
import { loadPayoutOptions } from "@/lib/admin/commissions-queries";

export const metadata = { title: "Nouveau versement" };

async function Form({ searchParams }: { searchParams: Promise<{ formateur?: string }> }) {
  await connection();
  const { formateur } = await searchParams;
  const instructors = await loadPayoutOptions();
  if (!instructors) return <Alert>Impossible de charger les commissions à verser. Vérifiez que la migration 55 est appliquée, puis réessayez.</Alert>;
  if (instructors.length === 0) return <EmptyState title="Aucune commission à verser"><Link href="/admin/commissions" className="font-semibold text-brand hover:underline">Retour aux commissions</Link></EmptyState>;
  const initial = instructors.some((i) => i.id === formateur) ? formateur! : "";
  return <CreatePayoutForm instructors={instructors} today={new Date().toISOString().slice(0, 10)} initialInstructor={initial} />;
}

export default function NewPayoutPage({ searchParams }: { searchParams: Promise<{ formateur?: string }> }) {
  return (
    <div className="space-y-5">
      <AdminPageHeader crumbs={[{ label: "Commissions et versements", href: "/admin/commissions" }, { label: "Nouveau versement" }]} icon="payment" title="Nouveau versement"
        description="Effectuez un versement de commissions à un formateur et enregistrez la transaction."
        actions={<Link href="/admin/commissions" className="inline-flex items-center gap-2 rounded-lg border border-brand bg-white px-5 py-2.5 text-sm font-semibold text-brand hover:bg-brand-soft"><ArrowLeft className="h-4 w-4" aria-hidden /> Retour à la liste</Link>} />
      <Suspense fallback={<div className="h-96 animate-pulse rounded-2xl bg-white" aria-hidden />}>
        <Form searchParams={searchParams} />
      </Suspense>
    </div>
  );
}
