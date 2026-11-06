import { Suspense } from "react";
import { notFound } from "next/navigation";
import { AttendanceForm } from "@/components/admin/attendance-form";
import { Alert } from "@/components/ui/feedback";
import { loadAttendanceList, loadAttendanceOptions } from "@/lib/admin/attendance-queries";
import { AdminPageHeader } from "@/components/admin/admin-page-header";

export const metadata = { title: "Enregistrer une présence" };

async function Content({ searchParams }: { searchParams: Promise<{ session?: string }> }) {
  const { session } = await searchParams;
  if (!session || !/^[0-9a-f-]{36}$/i.test(session)) notFound();
  const [list, options] = await Promise.all([loadAttendanceList(session, 200, 0), loadAttendanceOptions()]);
  if (list.failed || !list.session) return <Alert>Session introuvable ou migration 44 non appliquée.</Alert>;
  return (
    <div className="space-y-4">
      {list.total > 200 && <Alert>Seuls les 200 premiers inscrits sont affichés.</Alert>}
      {list.rows.length === 0 ? <Alert>Aucun apprenant inscrit à cette session.</Alert> : <AttendanceForm key={session} head={list.session} options={options} rows={list.rows} />}
    </div>
  );
}

export default function RecordAttendancePage({ searchParams }: { searchParams: Promise<{ session?: string }> }) {
  return (
    <div className="space-y-5">
      <AdminPageHeader crumbs={[{ label: "Présences", href: "/admin/presences" }, { label: "Enregistrer une présence" }]} icon="calendar-check" title="Enregistrer une présence" description="Renseignez les informations de la séance et marquez la présence des apprenants." />
      <Suspense fallback={<div className="h-96 animate-pulse rounded-2xl bg-white" aria-hidden />}>
        <Content searchParams={searchParams} />
      </Suspense>
    </div>
  );
}
