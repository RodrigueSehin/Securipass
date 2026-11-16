import { Suspense } from "react";
import Link from "next/link";
import { REPORT_FORMATS } from "@/lib/admin/report-generation";
import { BarChart3, CalendarCheck, CalendarDays, ClipboardCheck, Coins, Download, FileText, GraduationCap, History, LineChart, PieChart, Plus, ShieldCheck, Trophy, Users, Wallet, BookOpen, Hourglass, ChevronRight, type LucideIcon } from "lucide-react";
import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { StatCard } from "@/components/admin/dashboard-widgets";
import { CoursesDonut, EnrollmentsChart } from "@/components/admin/reports-charts";
import { ReportsPeriod } from "@/components/admin/reports-period";
import { Alert, EmptyState } from "@/components/ui/feedback";
import { monthLabel } from "@/lib/admin/commissions";
import { percentChange } from "@/lib/admin/dashboard";
import { REPORT_TYPES, REPORT_TYPE_KEYS, courseShares, lastMonths, parseMonth, type ReportType } from "@/lib/admin/reports";
import { loadRecentReports, loadReportsOverview } from "@/lib/admin/reports-queries";
import { cn, formatFcfa } from "@/lib/utils";

export const metadata = { title: "Rapports" };

const nf = new Intl.NumberFormat("fr-FR");
const card = "rounded-2xl border border-line bg-white p-5 shadow-card";
const when = (iso: string) => {
  const d = new Date(iso);
  const day = new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "short", year: "numeric", timeZone: "Africa/Abidjan" }).format(d);
  const time = new Intl.DateTimeFormat("fr-FR", { hour: "2-digit", minute: "2-digit", timeZone: "Africa/Abidjan" }).format(d);
  return `${day} – ${time}`;
};
const TYPE_ICON: Record<ReportType, LucideIcon> = {
  inscriptions: FileText, formations: GraduationCap, sessions: CalendarDays, apprenants: Users, evaluations: ClipboardCheck,
  certifications: ShieldCheck, financier: Wallet, presences: CalendarCheck, activite: FileText,
};

function Rate({ value }: { value: number | null }) {
  if (value === null) return <span className="text-muted">—</span>;
  return <span className={cn("rounded-md px-3 py-1 text-sm font-bold", value >= 80 ? "bg-success/15 text-success" : value >= 50 ? "bg-warning/15 text-[#a16207]" : "bg-danger/10 text-danger")}>{value} %</span>;
}

async function Content({ searchParams }: { searchParams: Promise<{ mois?: string }> }) {
  const sp = await searchParams;
  const month = parseMonth(sp.mois);
  const [o, recent] = await Promise.all([loadReportsOverview(month), loadRecentReports(5)]);
  if (!o) return <Alert>Impossible de charger les rapports. Vérifiez que la migration 56 est appliquée, puis réessayez.</Alert>;

  const trend = (b: { value: number; prev: number }) => percentChange(b.value, b.prev);
  const shares = courseShares(o.courses, o.enrollments.value);
  const topMax = Math.max(1, ...o.courses.map((c) => c.count));
  const rate = `${o.commissions.rate} %`.replace(".", ",");
  const label = monthLabel(month, "long");
  const dl = (type: string, extra = "") => `/admin/rapports/export?type=${type}&mois=${month}${extra}`;

  return (
    <div className="space-y-6">
      <AdminPageHeader crumbs={[{ label: "Rapports" }]} icon="document" title="Rapports" description="Analysez les performances, suivez les activités et générez des rapports détaillés de la plateforme."
        actions={<div className="flex flex-wrap items-center gap-2">
          <ReportsPeriod value={month} months={lastMonths()} />
          <a href={dl("synthese")} download className="inline-flex items-center gap-2 rounded-lg border border-brand bg-white px-5 py-2.5 text-sm font-semibold text-brand hover:bg-brand-soft"><Download className="h-4 w-4" aria-hidden /> Exporter</a>
          <Link href={`/admin/rapports/generer?mois=${month}`} className="inline-flex items-center gap-2 rounded-lg bg-brand px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-dark"><Plus className="h-4 w-4" aria-hidden /> Générer un rapport</Link>
        </div>}
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <StatCard icon={Users} tone="blue" label="Inscriptions" value={nf.format(o.enrollments.value)} trend={trend(o.enrollments)} note={`en ${label}`} />
        <StatCard icon={GraduationCap} tone="green" label="Apprenants actifs" value={nf.format(o.active_learners.value)} trend={trend(o.active_learners)} note={`en ${label}`} />
        <StatCard icon={BookOpen} tone="orange" label="Sessions" value={nf.format(o.sessions.value)} trend={trend(o.sessions)} note={`en ${label}`} />
        <StatCard icon={Hourglass} tone="purple" label="Certifications" value={nf.format(o.certifications.value)} trend={trend(o.certifications)} note="Délivrées" />
        <StatCard icon={Coins} tone="blue" label={`Commissions (${rate})`} value={formatFcfa(o.commissions.value)} trend={trend(o.commissions)} note={`en ${label}`} />
      </div>

      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_21rem]">
        <div className="space-y-6">
          <div className="grid gap-6 lg:grid-cols-2">
            <section className={card}>
              <h2 className="mb-3 flex items-center gap-2 text-base font-bold text-brand-dark"><LineChart className="h-5 w-5 text-brand" aria-hidden /> Évolution des inscriptions</h2>
              <EnrollmentsChart months={o.months} />
            </section>
            <section className={card}>
              <h2 className="mb-3 flex items-center gap-2 text-base font-bold text-brand-dark"><PieChart className="h-5 w-5 text-brand" aria-hidden /> Répartition par formation (inscriptions)</h2>
              {shares.length === 0 ? <p className="py-10 text-center text-sm text-muted">Aucune inscription en {label}.</p> : <CoursesDonut items={shares} total={o.enrollments.value} />}
            </section>
            <section className={card}>
              <h2 className="mb-3 flex items-center gap-2 text-base font-bold text-brand-dark"><BarChart3 className="h-5 w-5 text-brand" aria-hidden /> Synthèse ({label})</h2>
              <dl className="divide-y divide-line text-sm">
                <div className="flex items-center justify-between gap-3 py-2.5"><dt className="text-brand-dark">Taux de complétion des formations</dt><dd><Rate value={o.completion_rate} /></dd></div>
                <div className="flex items-center justify-between gap-3 py-2.5"><dt className="text-brand-dark">Taux de réussite aux évaluations</dt><dd><Rate value={o.evaluation_success_rate} /></dd></div>
                <div className="flex items-center justify-between gap-3 py-2.5"><dt className="text-brand-dark">Taux de présence moyen</dt><dd><Rate value={o.attendance_rate} /></dd></div>
                <div className="flex items-center justify-between gap-3 py-2.5"><dt className="text-brand-dark">Chiffre d’affaires total</dt><dd className="font-bold text-brand-dark">{formatFcfa(o.revenue)}</dd></div>
                <div className="flex items-center justify-between gap-3 py-2.5"><dt className="text-brand-dark">Commissions totales ({rate})</dt><dd className="font-bold text-brand-dark">{formatFcfa(o.commissions.value)}</dd></div>
              </dl>
            </section>
            <section className={card}>
              <h2 className="mb-3 flex items-center gap-2 text-base font-bold text-brand-dark"><Trophy className="h-5 w-5 text-cta" aria-hidden /> Top 5 des formations (par inscriptions)</h2>
              {o.courses.length === 0 ? <p className="py-10 text-center text-sm text-muted">Aucune inscription en {label}.</p> : (
                <ol className="space-y-3 text-sm">
                  {o.courses.map((c) => (
                    <li key={c.id} className="grid grid-cols-[minmax(0,10rem)_1fr_auto] items-center gap-3 text-brand-dark">
                      <span className="truncate" title={c.title}>{c.title}</span>
                      <span className="h-2.5 overflow-hidden rounded-full bg-brand-soft" aria-hidden><span className="block h-full rounded-full bg-brand" style={{ width: `${Math.max(4, (c.count / topMax) * 100)}%` }} /></span>
                      <span className="w-10 text-right font-bold">{nf.format(c.count)}</span>
                    </li>
                  ))}
                </ol>
              )}
            </section>
          </div>

          <section className={card}>
            <h2 className="mb-3 flex items-center gap-2 text-base font-bold text-brand-dark"><History className="h-5 w-5 text-brand" aria-hidden /> Rapports récents</h2>
            {recent.length === 0 ? <EmptyState title="Aucun rapport généré pour le moment" /> : (
              <div className="overflow-x-auto rounded-xl border border-line">
                <table className="w-full min-w-[46rem] text-left text-sm">
                  <thead className="bg-surface text-xs text-brand-dark">
                    <tr>{["Nom du rapport", "Type", "Période", "Généré le", "Généré par", "Format", "Actions"].map((h) => <th key={h} scope="col" className="px-3 py-3 font-semibold">{h}</th>)}</tr>
                  </thead>
                  <tbody>
                    {recent.map((r) => {
                      const t = REPORT_TYPES[r.type];
                      return (
                        <tr key={r.id} className="border-t border-line">
                          <td className="px-3 py-3 font-semibold text-brand-dark"><span className="inline-flex items-center gap-2"><FileText className="h-4 w-4 shrink-0 text-brand" aria-hidden />{r.name}</span></td>
                          <td className="px-3 py-3"><span className={cn("rounded-md px-2.5 py-1 text-xs font-semibold", t?.tone)}>{t?.label ?? r.type}</span></td>
                          <td className="whitespace-nowrap px-3 py-3 text-brand-dark">{monthLabel(r.period)}</td>
                          <td className="whitespace-nowrap px-3 py-3 text-xs text-brand-dark">{when(r.generated_at)}</td>
                          <td className="px-3 py-3 text-brand-dark">{r.generated_by}</td>
                          <td className="px-3 py-3"><span className={cn("rounded-md px-2.5 py-1 text-xs font-semibold", REPORT_FORMATS[r.format]?.tone)}>{REPORT_FORMATS[r.format]?.label ?? r.format}</span></td>
                          <td className="px-3 py-3">
                            <a href={`/admin/rapports/export?run=${r.id}`} download aria-label={`Télécharger ${r.name}`} title={`${nf.format(r.row_count)} ligne${r.row_count > 1 ? "s" : ""}`}
                              className="inline-flex h-9 w-10 items-center justify-center rounded-lg border border-line text-brand hover:bg-brand-soft"><Download className="h-4 w-4" aria-hidden /></a>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>

        <aside id="rapports-disponibles" className={cn(card, "scroll-mt-4")}>
          <h2 className="mb-3 flex items-center gap-2 text-base font-bold text-brand-dark"><FileText className="h-5 w-5 text-brand" aria-hidden /> Rapports disponibles</h2>
          <p className="mb-3 text-xs text-muted">Choisissez un rapport pour le configurer, le prévisualiser et le générer (PDF, Excel ou CSV).</p>
          <ul className="space-y-2">
            {REPORT_TYPE_KEYS.map((k) => {
              const Icon = TYPE_ICON[k];
              return (
                <li key={k}>
                  <Link href={`/admin/rapports/generer?type=${k}&mois=${month}`} className="flex items-center gap-3 rounded-xl border border-line px-3 py-2.5 hover:bg-brand-soft">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-soft text-brand" aria-hidden><Icon className="h-5 w-5" /></span>
                    <span className="min-w-0 flex-1"><span className="block text-sm font-bold text-brand-dark">{REPORT_TYPES[k].label}</span><span className="block truncate text-xs text-muted">{REPORT_TYPES[k].description}</span></span>
                    <ChevronRight className="h-4 w-4 shrink-0 text-brand-dark" aria-hidden />
                  </Link>
                </li>
              );
            })}
          </ul>
        </aside>
      </div>
    </div>
  );
}

export default function ReportsPage({ searchParams }: { searchParams: Promise<{ mois?: string }> }) {
  return (
    <Suspense fallback={<div className="h-96 animate-pulse rounded-2xl bg-white" aria-hidden />}>
      <Content searchParams={searchParams} />
    </Suspense>
  );
}
