import { Suspense } from "react";
import { BadgeCheck, BookOpen, CalendarDays, CreditCard, GraduationCap, Headphones, Hourglass, Users, UserPlus, ShieldCheck, type LucideIcon } from "lucide-react";
import { ActivityTable, AlertList, EnrollmentsChart, Panel, RangePill, RolesDonut, StatCard } from "@/components/admin/dashboard-widgets";
import { Alert, EmptyState } from "@/components/ui/feedback";
import { buildAlerts, percentChange } from "@/lib/admin/dashboard";
import { loadAdminDashboard } from "@/lib/admin/queries";

export const metadata = { title: "Administration" };

const currentTime = () => Date.now();
const nf = new Intl.NumberFormat("fr-FR");
const TZ = "Africa/Abidjan";
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

const ALERT_ICONS: Record<string, LucideIcon> = { review: BookOpen, payment: CreditCard, support: Headphones, certs: ShieldCheck, users: UserPlus };

async function Dashboard() {
  const data = await loadAdminDashboard();
  const now = currentTime(); // après la lecture des données : la page est rendue à la demande
  if (data.failed || !data.stats) {
    return <Alert>Impossible de charger le tableau de bord. Vérifiez que la migration 27 est appliquée, puis réessayez.</Alert>;
  }
  const s = data.stats;
  const first = data.name.split(/\s+/)[0] || "Administrateur";
  const day = cap(new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: TZ }).format(now));
  const time = new Intl.DateTimeFormat("fr-FR", { hour: "2-digit", minute: "2-digit", timeZone: TZ }).format(now);

  const sameDay = (iso: string) => new Date(iso).toLocaleDateString("fr-CA", { timeZone: TZ }) === new Date(now).toLocaleDateString("fr-CA", { timeZone: TZ });
  const whenShort = (iso: string | null) => {
    if (!iso) return "";
    if (sameDay(iso)) return new Intl.DateTimeFormat("fr-FR", { hour: "2-digit", minute: "2-digit", timeZone: TZ }).format(new Date(iso));
    const days = Math.floor((now - Date.parse(iso)) / 86_400_000);
    if (days === 1) return "Hier";
    return new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short", timeZone: TZ }).format(new Date(iso));
  };
  const whenLong = (iso: string) => new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: TZ }).format(new Date(iso)).replace(" à ", " ");

  const alerts = buildAlerts({
    inReview: s.courses.in_review, inReviewAt: s.courses.in_review_at,
    pendingPayment: s.enrollments.pending_payment, pendingPaymentAt: s.enrollments.pending_payment_at,
    supportNew: s.support.new, supportNewAt: s.support.new_at, expiring: s.certificates.expiring, expiringAt: s.certificates.expiring_at,
    newUsers: s.users.week, newUsersAt: s.users.latest_at,
  });

  return (
    <div className="space-y-6">
      <section className="flex flex-wrap items-center justify-between gap-4 overflow-hidden rounded-2xl border border-line bg-[linear-gradient(110deg,#ffffff_0%,#eaf2ff_55%,#cfe0fb_100%)] px-7 py-6 shadow-card">
        <div>
          <h1 className="text-3xl font-extrabold text-brand-dark">Bienvenue, <span className="text-brand">{first}</span></h1>
          <p className="mt-1 text-brand-dark/80">Voici un aperçu de l’activité globale de la plateforme SECURIPASS.</p>
        </div>
        <div className="flex items-center gap-3 rounded-xl bg-white/70 px-4 py-3 backdrop-blur">
          <CalendarDays className="h-6 w-6 text-brand" aria-hidden />
          <p className="text-sm text-brand-dark"><span className="block font-bold">{day}</span><span className="text-xs text-muted">Il est {time} (GMT+0)</span></p>
        </div>
      </section>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard icon={Users} tone="blue" label="Utilisateurs actifs" value={nf.format(s.users.active)} trend={percentChange(s.users.month, s.users.prev)} note={`+ ${nf.format(s.users.month)} ce mois-ci`} series={s.series.users} />
        <StatCard icon={GraduationCap} tone="green" label="Inscriptions" value={nf.format(s.enrollments.total)} trend={percentChange(s.enrollments.month, s.enrollments.prev)} note={`+ ${nf.format(s.enrollments.month)} ce mois-ci`} series={s.series.enrollments} />
        <StatCard icon={BookOpen} tone="orange" label="Formations publiées" value={nf.format(s.courses.published)} trend={percentChange(s.courses.month, s.courses.prev)} note={`+ ${nf.format(s.courses.month)} ce mois-ci`} series={s.series.courses} />
        <StatCard icon={CalendarDays} tone="purple" label="Sessions à venir" value={nf.format(s.sessions.upcoming)} trend={percentChange(s.sessions.month, s.sessions.prev)} note={`+ ${nf.format(s.sessions.week)} cette semaine`} series={s.series.sessions} />
        <StatCard icon={BadgeCheck} tone="red" label="Certificats émis" value={nf.format(s.certificates.total)} trend={percentChange(s.certificates.month, s.certificates.prev)} note={`+ ${nf.format(s.certificates.month)} ce mois-ci`} series={s.series.certificates} />
        <StatCard icon={CreditCard} tone="blue" label="Paiements encaissés" value="—" note="Disponible avec le module Paiements" />
        <StatCard icon={Hourglass} tone="amber" label="Transactions en attente" value={nf.format(s.enrollments.pending_payment)} note="Inscriptions en attente de paiement" />
        <StatCard icon={Headphones} tone="teal" label="Demandes de support" value={nf.format(s.support.open)} trend={percentChange(s.support.month, s.support.prev)} note={`${nf.format(s.support.in_progress)} en cours`} series={s.series.support} />
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <Panel title="Évolution des inscriptions" aside={<RangePill />}><EnrollmentsChart values={s.series.enrollments} now={now} /></Panel>
        <Panel title="Répartition des utilisateurs"><RolesDonut roles={s.roles} /></Panel>
        <Panel title="Revenus mensuels (XOF)" aside={<RangePill />}>
          <EmptyState title="Revenus indisponibles">Le suivi des revenus s’affichera ici avec le module Paiements.</EmptyState>
        </Panel>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <Panel title="Activité récente"><ActivityTable rows={data.activity} format={whenLong} /></Panel>
        <Panel title={<span className="flex items-center gap-2">Notifications importantes {alerts.length > 0 && <span className="rounded-full bg-danger px-2 py-0.5 text-xs font-bold text-white">{alerts.length}</span>}</span>}>
          <AlertList alerts={alerts} icons={ALERT_ICONS} when={whenShort} />
        </Panel>
      </div>
    </div>
  );
}

export default function AdminHome() {
  return (
    <Suspense fallback={<div className="h-96 animate-pulse rounded-2xl bg-white" aria-hidden />}>
      <Dashboard />
    </Suspense>
  );
}
