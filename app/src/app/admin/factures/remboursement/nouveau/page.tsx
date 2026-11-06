import { Suspense } from "react";
import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { CreateRefundForm } from "@/components/admin/create-refund-form";
import { loadBillingOptions } from "@/lib/admin/billing-queries";

export const metadata = { title: "Nouveau remboursement" };

async function Form({ searchParams }: { searchParams: Promise<{ facture?: string }> }) {
  const { facture } = await searchParams;
  const options = await loadBillingOptions();
  return <CreateRefundForm refundable={options.refundable} defaultInvoice={options.refundable.some((r) => r.id === facture) ? facture! : ""} />;
}

export default function NewRefundPage({ searchParams }: { searchParams: Promise<{ facture?: string }> }) {
  return (
    <div className="space-y-5">
      <AdminPageHeader crumbs={[{ label: "Factures et remboursements", href: "/admin/factures" }, { label: "Nouveau remboursement" }]} icon="document" title="Nouveau remboursement" description="Remboursez tout ou partie d’une facture payée, ou émettez un avoir." />
      <Suspense fallback={<div className="h-72 animate-pulse rounded-2xl bg-white" aria-hidden />}>
        <Form searchParams={searchParams} />
      </Suspense>
    </div>
  );
}
