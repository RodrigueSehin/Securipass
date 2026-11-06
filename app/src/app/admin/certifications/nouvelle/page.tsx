import { Suspense } from "react";
import { CreateCertificationForm } from "@/components/admin/create-certification-form";
import { loadCertificationOptions } from "@/lib/admin/certifications-queries";
import { AdminPageHeader } from "@/components/admin/admin-page-header";

export const metadata = { title: "Nouvelle certification" };

async function Form() {
  const options = await loadCertificationOptions();
  return <CreateCertificationForm options={options} />;
}

export default function NewCertificationPage() {
  return (
    <div className="space-y-5">
      <AdminPageHeader crumbs={[{ label: "Certifications", href: "/admin/certifications" }, { label: "Nouvelle certification" }]} icon="award" title="Nouvelle certification" description="Créez une certification et définissez ses paramètres de délivrance." />
      <Suspense fallback={<div className="h-64 animate-pulse rounded-2xl bg-white" aria-hidden />}>
        <Form />
      </Suspense>
    </div>
  );
}
