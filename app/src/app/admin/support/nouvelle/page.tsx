import { Suspense } from "react";
import { connection } from "next/server";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { CreateSupportForm } from "@/components/admin/create-support-form";
import { Alert } from "@/components/ui/feedback";
import { loadCourseOptions, loadSupportRequesters } from "@/lib/admin/support-queries";

export const metadata = { title: "Nouvelle demande" };

async function Form() {
  await connection();
  const [requesters, courses] = await Promise.all([loadSupportRequesters(), loadCourseOptions()]);
  if (!requesters) return <Alert>Impossible de charger les utilisateurs. Vérifiez que les migrations 58 et 59 sont appliquées, puis réessayez.</Alert>;
  return <CreateSupportForm requesters={requesters} courses={courses} />;
}

export default function NewSupportTicketPage() {
  return (
    <div className="space-y-5">
      <AdminPageHeader crumbs={[{ label: "Support", href: "/admin/support" }, { label: "Nouvelle demande" }]} icon="document" title="Nouvelle demande"
        description="Ouvrez une demande d’assistance au nom d’un utilisateur."
        actions={<Link href="/admin/support" className="inline-flex items-center gap-2 rounded-lg border border-brand bg-white px-5 py-2.5 text-sm font-semibold text-brand hover:bg-brand-soft"><ArrowLeft className="h-4 w-4" aria-hidden /> Retour aux tickets</Link>} />
      <Suspense fallback={<div className="h-96 max-w-3xl animate-pulse rounded-2xl bg-white" aria-hidden />}>
        <Form />
      </Suspense>
    </div>
  );
}
