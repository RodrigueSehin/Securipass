import { Suspense } from "react";
import { redirect } from "next/navigation";
import { Award, BookOpen, CalendarDays, Users } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { ButtonLink } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/feedback";
import { BucketDonut, EvolutionChart } from "@/components/instructor/dashboard-charts";
import { ActionsPanel, ActivityPanel, CoursesPanel, KpiTile, Panel, PerformancePanel, SessionsPanel } from "@/components/instructor/dashboard-panels";
import { loadInstructorDashboard } from "@/lib/instructor/dashboard-data";

export const metadata = { title: "Tableau de bord formateur" };

const DATE_FORMAT = new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "Africa/Abidjan" });

async function Dashboard() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/connexion");
  const data = await loadInstructorDashboard(supabase, user.id);
  const today = DATE_FORMAT.format(new Date(data.now));

  return (
    <>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <p className="text-lg font-semibold text-brand-dark">
          Bienvenue{data.name ? ` ${data.name}` : ""} <span aria-hidden>👋</span>
        </p>
        <p className="rounded-xl border border-line bg-white px-4 py-2 text-sm font-medium text-brand-dark">
          {today.charAt(0).toUpperCase() + today.slice(1)}
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiTile href="/formateur/apprenants" icon={Users} value={data.kpis.learners} label="Apprenants" tone="bg-brand" />
        <KpiTile href="/formateur/formations" icon={BookOpen} value={data.kpis.courses} label="Formations" tone="bg-cta" />
        <KpiTile href="/formateur/sessions" icon={CalendarDays} value={data.kpis.upcomingSessions} label="Sessions à venir" tone="bg-[#7c3aed]" />
        <KpiTile href="/formateur/certifications" icon={Award} value={data.kpis.certificates} label="Certifications délivrées" tone="bg-success" />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-3">
        <PerformancePanel performance={data.performance} />
        <Panel title="Évolution des apprenants (6 derniers mois)" className="xl:col-span-2">
          <EvolutionChart monthly={data.monthly} />
        </Panel>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-3">
        <CoursesPanel courses={data.courses} />
        <SessionsPanel sessions={data.sessions} />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-3">
        <ActionsPanel actions={data.actions} />
        <Panel title="Répartition des apprenants">
          <BucketDonut buckets={data.buckets} />
        </Panel>
        <ActivityPanel activity={data.activity} now={data.now} />
      </div>
    </>
  );
}

function DashboardSkeleton() {
  return <div className="space-y-6" aria-hidden><div className="h-28 animate-pulse rounded-2xl bg-white" /><div className="h-96 animate-pulse rounded-2xl bg-white" /></div>;
}

export default function InstructorHome() {
  return (
    <>
      <PageHeader
        title="Tableau de bord"
        description="Vos indicateurs sont calculés à partir de vos données réelles."
        actions={<ButtonLink href="/formateur/formations/nouveau" variant="cta">Créer une formation</ButtonLink>}
      />
      <Suspense fallback={<DashboardSkeleton />}>
        <Dashboard />
      </Suspense>
    </>
  );
}
