import { Suspense } from "react";
import Link from "next/link";
import Image from "next/image";
import { ArrowLeft, Eye, LineChart, PieChart, Settings2, TrendingUp, Users, GraduationCap, BookOpen, Hourglass, Coins, Percent, ClipboardCheck, CalendarCheck, Wallet, type LucideIcon } from "lucide-react";
import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { CoursesDonut, EnrollmentsChart } from "@/components/admin/reports-charts";
import { ReportGeneratorForm } from "@/components/admin/report-generator-form";
import { Alert } from "@/components/ui/feedback";
import {
  breakdownTotals, hasCourseBreakdown, indicatorTiles, parseReportParams, periodLabel, type IndicatorTile, type ReportParams,
} from "@/lib/admin/report-generation";
import { REPORT_TYPES, courseShares, lastMonths, type ReportsOverview } from "@/lib/admin/reports";
import { loadGeneratorOptions, loadReportRows, loadReportsOverview } from "@/lib/admin/reports-queries";
import { cn } from "@/lib/utils";

export const metadata = { title: "Générer un rapport" };

const TILE_ICON: Record<IndicatorTile["key"], { icon: LucideIcon; tone: string }> = {
  inscriptions: { icon: Users, tone: "bg-brand text-white" }, completion: { icon: GraduationCap, tone: "bg-success text-white" },
  reussite: { icon: ClipboardCheck, tone: "bg-[#7c3aed] text-white" }, presence: { icon: CalendarCheck, tone: "bg-cta text-white" },
  ca: { icon: Wallet, tone: "bg-success text-white" }, commissions: { icon: Coins, tone: "bg-brand text-white" },
  evaluations: { icon: Percent, tone: "bg-[#7c3aed] text-white" }, certifications: { icon: Hourglass, tone: "bg-[#7c3aed] text-white" },
};
const card = "rounded-2xl border border-line bg-white p-5 shadow-card";
const pc = (v: number | null) => (v === null ? "—" : `${v} %`);
const nf = new Intl.NumberFormat("fr-FR");

function Preview({ params, o, sample }: { params: ReportParams; o: ReportsOverview; sample: (string | number)[][] }) {
  const tiles = indicatorTiles(o, params.indicators);
  const analyse = params.indicators.includes("analyse");
  const shares = courseShares(o.by_course.length ? o.by_course : o.courses, o.enrollments.value);
  const totals = breakdownTotals(o.by_course);
  const type = REPORT_TYPES[params.type];
  return (
    <div className="overflow-hidden rounded-2xl border border-line bg-white shadow-card">
      <div className="flex items-center justify-between gap-4 bg-gradient-to-r from-white to-[#dbe8ff] px-5 py-4">
        <Image src="/images/brand/logo.png" alt="SECURIPASS" width={150} height={42} className="h-10 w-auto" />
        <div className="rounded-lg bg-brand px-4 py-2 text-right text-white"><p className="text-base font-extrabold">{params.name}</p><p className="text-xs">Période : {periodLabel(params.month)}</p></div>
      </div>
      <div className="space-y-5 p-5">
        {params.description && <p className="text-sm text-muted">{params.description}</p>}

        {tiles.length > 0 && (
          <section>
            <h3 className="mb-3 flex items-center gap-2 text-sm font-extrabold text-brand-dark"><TrendingUp className="h-4 w-4 text-brand" aria-hidden /> Synthèse générale</h3>
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              {tiles.map((t) => {
                const { icon: Icon, tone } = TILE_ICON[t.key];
                return (
                  <div key={t.key} className="flex items-center gap-3 rounded-xl border border-line p-3">
                    <span className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-lg", tone)} aria-hidden><Icon className="h-5 w-5" /></span>
                    <div className="min-w-0"><p className="truncate text-lg font-extrabold leading-tight text-brand-dark">{t.value}</p><p className="truncate text-xs text-brand-dark">{t.label}</p>{t.trend && <p className="text-xs font-bold text-success">{t.trend}</p>}</div>
                  </div>
                );
              })}
            </div>
          </section>
        )}
        {tiles.length === 0 && !analyse && <Alert tone="info">Aucun indicateur sélectionné : le rapport ne contiendra que le détail des données.</Alert>}

        {analyse && (
          <div className="grid gap-4 lg:grid-cols-2">
            <section className="rounded-xl border border-line p-3">
              <h3 className="mb-2 flex items-center gap-2 text-sm font-extrabold text-brand-dark"><LineChart className="h-4 w-4 text-brand" aria-hidden /> Évolution des inscriptions</h3>
              <EnrollmentsChart months={o.months} />
            </section>
            <section className="rounded-xl border border-line p-3">
              <h3 className="mb-2 flex items-center gap-2 text-sm font-extrabold text-brand-dark"><PieChart className="h-4 w-4 text-brand" aria-hidden /> Répartition par formation</h3>
              {shares.length === 0 ? <p className="py-10 text-center text-sm text-muted">Aucune inscription sur la période.</p> : <CoursesDonut items={shares} total={o.enrollments.value} />}
            </section>
          </div>
        )}

        <section>
          {hasCourseBreakdown(params.type) ? (
            <>
              <h3 className="mb-2 text-sm font-extrabold text-brand-dark">{params.type === "formations" ? "Formations" : "Inscriptions par formation"}</h3>
              {o.by_course.length === 0 ? <p className="rounded-lg bg-surface px-4 py-6 text-center text-sm text-muted">Aucune inscription sur la période.</p> : (
                <div className="overflow-x-auto rounded-xl border border-line">
                  <table className="w-full min-w-[34rem] text-left text-xs">
                    <thead className="bg-surface text-brand-dark"><tr>{["#", "Formation", "Sessions", "Inscriptions", "Taux de complétion", "Taux de réussite"].map((h) => <th key={h} scope="col" className="px-3 py-2.5 font-bold">{h}</th>)}</tr></thead>
                    <tbody>
                      {o.by_course.map((c, i) => (
                        <tr key={c.id} className="border-t border-line text-brand-dark"><td className="px-3 py-2">{i + 1}</td><td className="px-3 py-2 font-semibold">{c.title}</td><td className="px-3 py-2">{nf.format(c.sessions)}</td><td className="px-3 py-2">{nf.format(c.count)}</td><td className="px-3 py-2">{pc(c.completion)}</td><td className="px-3 py-2">{pc(c.success)}</td></tr>
                      ))}
                      <tr className="border-t border-line bg-brand-soft font-extrabold text-brand-dark"><td className="px-3 py-2" /><td className="px-3 py-2">Total</td><td className="px-3 py-2">{nf.format(totals.sessions)}</td><td className="px-3 py-2">{nf.format(totals.count)}</td><td className="px-3 py-2">{pc(totals.completion)}</td><td className="px-3 py-2">{pc(totals.success)}</td></tr>
                    </tbody>
                  </table>
                </div>
              )}
            </>
          ) : (
            <>
              <h3 className="mb-2 text-sm font-extrabold text-brand-dark">{type.label} : aperçu des données</h3>
              {sample.length === 0 ? <p className="rounded-lg bg-surface px-4 py-6 text-center text-sm text-muted">Aucune donnée pour ces paramètres.</p> : (
                <div className="overflow-x-auto rounded-xl border border-line">
                  <table className="w-full min-w-[34rem] text-left text-xs">
                    <thead className="bg-surface text-brand-dark"><tr>{type.headers.map((h) => <th key={h} scope="col" className="px-3 py-2.5 font-bold">{h}</th>)}</tr></thead>
                    <tbody>{sample.map((r, i) => <tr key={i} className="border-t border-line text-brand-dark">{r.map((c, j) => <td key={j} className="px-3 py-2">{String(c ?? "")}</td>)}</tr>)}</tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </section>
      </div>
    </div>
  );
}

async function Content({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const usp = new URLSearchParams();
  for (const [k, v] of Object.entries(sp)) for (const x of Array.isArray(v) ? v : v === undefined ? [] : [v]) usp.append(k, x);
  const params = parseReportParams(usp);

  const [options, overview, rows] = await Promise.all([
    loadGeneratorOptions(), loadReportsOverview(params.month, params.filters),
    hasCourseBreakdown(params.type) ? Promise.resolve([]) : loadReportRows(params.type, params.month, params.filters),
  ]);
  if (!overview) return <Alert>Impossible de charger l’aperçu. Vérifiez que la migration 57 est appliquée, puis réessayez.</Alert>;

  return (
    <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,26rem)_minmax(0,1fr)]">
      <section className={card}>
        <h2 className="mb-4 flex items-center gap-2 border-b border-line pb-3 text-lg font-extrabold text-brand-dark"><Settings2 className="h-5 w-5 text-brand" aria-hidden /> Paramètres du rapport</h2>
        <ReportGeneratorForm key={usp.toString()} params={params} months={lastMonths()} options={options} />
      </section>
      <section className={card}>
        <h2 className="mb-4 flex items-center gap-2 border-b border-line pb-3 text-lg font-extrabold text-brand-dark"><Eye className="h-5 w-5 text-brand" aria-hidden /> Aperçu du rapport</h2>
        <Preview params={params} o={overview} sample={(rows ?? []).slice(0, 8)} />
        <p className="mt-3 flex items-center gap-2 text-xs text-muted"><BookOpen className="h-4 w-4" aria-hidden />L’aperçu reprend les indicateurs et le détail du fichier. Le fichier contient toutes les lignes (le PDF, les 300 premières).</p>
      </section>
    </div>
  );
}

export default function GenerateReportPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  return (
    <div className="space-y-5">
      <AdminPageHeader crumbs={[{ label: "Rapports", href: "/admin/rapports" }, { label: "Générer un rapport" }]} icon="document" title="Générer un rapport"
        description="Configurez les paramètres, prévisualisez le rapport et générez-le au format de votre choix."
        actions={<Link href="/admin/rapports" className="inline-flex items-center gap-2 rounded-lg border border-brand bg-white px-5 py-2.5 text-sm font-semibold text-brand hover:bg-brand-soft"><ArrowLeft className="h-4 w-4" aria-hidden /> Retour à la liste des rapports</Link>} />
      <Suspense fallback={<div className="h-96 animate-pulse rounded-2xl bg-white" aria-hidden />}>
        <Content searchParams={searchParams} />
      </Suspense>
    </div>
  );
}
