import { Suspense } from "react";
import { connection } from "next/server";
import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { CreateInvoiceForm } from "@/components/admin/create-invoice-form";
import { loadBillingOptions } from "@/lib/admin/billing-queries";

export const metadata = { title: "Nouvelle facture" };

async function Form() {
  await connection();
  const options = await loadBillingOptions();
  return <CreateInvoiceForm options={options} today={new Date().toISOString().slice(0, 10)} />;
}

export default function NewInvoicePage() {
  return (
    <div className="space-y-5">
      <AdminPageHeader crumbs={[{ label: "Factures et remboursements", href: "/admin/factures" }, { label: "Nouvelle facture" }]} icon="document" title="Nouvelle facture" description="Créez une facture pour une formation, une certification, une session ou un autre service." />
      <Suspense fallback={<div className="h-96 animate-pulse rounded-2xl bg-white" aria-hidden />}>
        <Form />
      </Suspense>
    </div>
  );
}
