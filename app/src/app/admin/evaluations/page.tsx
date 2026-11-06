import { Suspense } from "react";
import Link from "next/link";
import { ArrowDown, ArrowUp, CheckCircle2, ChevronLeft, ChevronRight, ClipboardCheck, ClipboardList, Clock, Download, MoreHorizontal, ShieldCheck, Trophy, Users, XCircle, CalendarDays, Plus, type LucideIcon } from "lucide-react";
import { StatCard } from "@/components/admin/dashboard-widgets";
import { EvaluationsFilters } from "@/components/admin/evaluations-toolbar";
import { UsersPageSize, UsersSelectAll } from "@/components/admin/users-toolbar";
import { ButtonLink } from "@/components/ui/button";
import { Alert, EmptyState } from "@/components/ui/feedback";
import { percentChange } from "@/lib/admin/dashboard";
import { EVALUATION_KINDS, EVALUATION_STATUS_UI, evaluationDate, formatPercent, parseEvaluationFilters } from "@/lib/admin/evaluations";
import { setEvaluationStatus } from "@/lib/admin/evaluations-actions";
import { loadEvaluationOptions, loadEvaluations, loadEvaluationStats } from "@/lib/admin/evaluations-queries";
import { PAGE_SIZES, pageWindow } from "@/lib/admin/users";
import { formatDate, formatTimeRange } from "@/lib/format";
import { cn } from "@/lib/utils";
import { AdminPageHeader } from "@/components/admin/admin-page-header";

export const metadata = { title: "Évaluations" };

const EXPORT_FORM = "evaluations-export";
const nf = new Intl.NumberFormat("fr-FR");
const RESULTS: Record<string, string> = { creee: "L’évaluation a été créée et publiée.", "brouillon-cree": "L’évaluation a été enregistrée en brouillon. Publiez-la depuis le menu d’actions.", questions: "La question a été enregistrée. Publiez l’évaluation depuis le menu d’actions quand elle est complète.", publiee: "L’évaluation a été publiée.", brouillon: "L’évaluation est repassée en brouillon.", archivee: "L’évaluation a été archivée." };
const KIND_ICON: Record<string, [LucideIcon, string]> = {
  quiz: [ClipboardList, "bg-brand-soft text-brand"], assignment: [ClipboardCheck, "bg-[#ede9fe] text-[#6d28d9]"],
  case_study: [ShieldCheck, "bg-[#ede9fe] text-[#6d28d9]"], practical: [Clock, "bg-warning/15 text-warning"],
};

type SP = Promise<{ q?: string; formation?: string; session?: string; statut?: string; du?: string; au?: string; tri?: string; page?: string; par?: string; resultat?: string; erreur?: string }>;

async function Content({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const filters = parseEvaluationFilters(sp);
  const size = PAGE_SIZES.includes(Number(sp.par)) ? Number(sp.par) : PAGE_SIZES[0];
  const requested = Math.max(1, Math.floor(Number(sp.page)) || 1);
  const [stats, options, first] = await Promise.all([loadEvaluationStats(), loadEvaluationOptions(), loadEvaluations(filters, size, (requested - 1) * size)]);
  if (first.failed) return <Alert>Impossible de charger les évaluations. Vérifiez que la migration 42 est appliquée, puis réessayez.</Alert>;

  const pages = Math.max(1, Math.ceil(first.total / size));
  const page = Math.min(requested, pages);
  const data = page === requested ? first : await loadEvaluations(filters, size, (page - 1) * size);
  const from = data.total === 0 ? 0 : (page - 1) * size + 1;
  const to = Math.min(data.total, page * size);

  const href = (over: Record<string, string | number | undefined>) => {
    const u = new URLSearchParams();
    const cur: Record<string, string | number | undefined> = {
      q: filters.q, formation: filters.course, session: filters.session, statut: filters.status, du: filters.from, au: filters.to,
      tri: filters.asc ? "asc" : undefined, par: size === PAGE_SIZES[0] ? undefined : size, ...over,
    };
    for (const [k, v] of Object.entries(cur)) if (v !== undefined && v !== "" && v !== 1) u.set(k, String(v));
    return `/admin/evaluations${u.size ? `?${u}` : ""}`;
  };
  const here = href({ page: page === 1 ? undefined : page });
  const exportParams = Object.entries({ q: filters.q, formation: filters.course, session: filters.session, statut: filters.status, du: filters.from, au: filters.to, tri: filters.asc ? "asc" : "" }).filter(([, v]) => v);

  const trend = (b?: { month?: number; prev?: number }) => (b ? percentChange(b.month ?? 0, b.prev ?? 0) : null);
  const fail = stats?.failed;
  const tabs: [string, string, number | undefined][] = [
    ["", "Toutes", stats?.total.count], ["planned", "Planifiées", stats?.planned.count], ["in_progress", "En cours", stats?.in_progress.count], ["completed", "Terminées", stats?.completed.count],
  ];
  const th = "px-3 py-3 font-semibold";

  return (
    <div className="space-y-6">
      <AdminPageHeader crumbs={[{ label: "Évaluations" }]} icon="evaluation" title="Gestion des évaluations" description="Suivez et analysez les évaluations des apprenants."
        actions={<>
          <div className="flex flex-wrap gap-2"><button type="submit" form={EXPORT_FORM} title="Exporte les lignes cochées, sinon le filtre courant" className="inline-flex items-center gap-2 rounded-lg border border-brand bg-white px-5 py-2.5 text-sm font-semibold text-brand hover:bg-brand-soft"><Download className="h-4 w-4" aria-hidden /> Exporter</button><ButtonLink href="/admin/evaluations/nouvelle"><Plus className="h-4 w-4" aria-hidden /> Nouvelle évaluation</ButtonLink></div>
        </>}
      />
      {sp.resultat && RESULTS[sp.resultat] && <Alert tone="success">{RESULTS[sp.resultat]}</Alert>}
      {sp.erreur && <Alert>{sp.erreur}</Alert>}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <StatCard icon={ClipboardCheck} tone="blue" label="Évaluations totales" value={stats ? nf.format(stats.total.count) : "—"} trend={trend(stats?.total)} note={stats ? `+ ${nf.format(stats.total.month ?? 0)} ce mois-ci` : ""} />
        <StatCard icon={Clock} tone="orange" label="En cours" value={stats ? nf.format(stats.in_progress.count) : "—"} note={stats ? `${nf.format(stats.planned.count)} planifiée${stats.planned.count > 1 ? "s" : ""}` : ""} />
        <StatCard icon={CheckCircle2} tone="green" label="Terminées" value={stats ? nf.format(stats.completed.count) : "—"} trend={trend(stats?.completed)} note="" />
        <StatCard icon={XCircle} tone="slate" label="Échouées" value={fail ? nf.format(fail.count) : "—"} note={fail ? `${formatPercent(fail.count, fail.results)} des résultats` : ""} />
        <StatCard icon={Trophy} tone="orange" label="Taux de réussite" value={stats ? formatPercent(stats.success.passed, stats.success.results).replace(" %", "%") : "—"} note={stats ? `${nf.format(stats.success.results)} résultat${stats.success.results > 1 ? "s" : ""}` : ""} />
      </div>

      <section className="rounded-2xl border border-line bg-white p-5 shadow-card">
        <nav aria-label="Statut des évaluations" className="mb-4 flex flex-wrap gap-1 border-b border-line">
          {tabs.map(([key, label, count]) => (
            <Link key={key || "all"} href={href({ statut: key || undefined, page: 1 })} aria-current={filters.status === key ? "page" : undefined}
              className={cn("-mb-px border-b-2 px-4 py-2.5 text-sm font-semibold", filters.status === key ? "border-brand text-brand" : "border-transparent text-brand-dark hover:text-brand")}>
              {label}{count !== undefined && ` (${nf.format(count)})`}
            </Link>
          ))}
        </nav>
        <EvaluationsFilters values={filters} options={options} hidden={{ ...(filters.asc ? { tri: "asc" } : {}), ...(size !== PAGE_SIZES[0] ? { par: String(size) } : {}) }} />
        <form id={EXPORT_FORM} action="/admin/evaluations/export" method="get" className="hidden">
          {exportParams.map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
        </form>

        {data.total === 0 ? (
          <div className="mt-4"><EmptyState title="Aucune évaluation ne correspond"><Link href="/admin/evaluations" className="font-semibold text-brand hover:underline">Réinitialiser les filtres</Link></EmptyState></div>
        ) : (
          <div className="mt-4 overflow-x-auto rounded-xl border border-line">
            <table className="w-full min-w-[64rem] text-left text-sm">
              <thead className="bg-surface text-xs text-brand-dark">
                <tr>
                  <th scope="col" className="w-10 px-3 py-3"><UsersSelectAll formId={EXPORT_FORM} /></th>
                  <th scope="col" className={th}>Titre de l’évaluation</th>
                  <th scope="col" className={th}>Formation</th>
                  <th scope="col" className={th}>Session</th>
                  <th scope="col" className={th}>Type</th>
                  <th scope="col" className={th} aria-sort={filters.asc ? "ascending" : "descending"}>
                    <Link href={href({ tri: filters.asc ? undefined : "asc", page: 1 })} className="inline-flex items-center gap-1 hover:text-brand">Date {filters.asc ? <ArrowUp className="h-3 w-3" aria-hidden /> : <ArrowDown className="h-3 w-3" aria-hidden />}</Link>
                  </th>
                  <th scope="col" className={th}>Participants</th>
                  <th scope="col" className={th}>Résultats</th>
                  <th scope="col" className={th}>Statut</th>
                  <th scope="col" className={th}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {data.rows.map((e) => {
                  const st = EVALUATION_STATUS_UI[e.display_status] ?? EVALUATION_STATUS_UI.draft;
                  const kind = EVALUATION_KINDS[e.kind] ?? EVALUATION_KINDS.quiz;
                  const [Icon, iconTone] = KIND_ICON[e.kind] ?? KIND_ICON.quiz;
                  const date = evaluationDate(e);
                  return (
                    <tr key={e.id} className="border-t border-line">
                      <td className="px-3 py-3"><input type="checkbox" name="id" value={e.id} form={EXPORT_FORM} aria-label={`Sélectionner ${e.title}`} className="h-4 w-4 rounded border-line" /></td>
                      <td className="px-3 py-3">
                        <div className="flex items-center gap-3">
                          <span className={cn("flex h-11 w-11 shrink-0 items-center justify-center rounded-xl", iconTone)}><Icon className="h-5 w-5" aria-hidden /></span>
                          <div className="min-w-0"><p className="font-bold text-brand-dark">{e.title}</p>
                            <p className="text-xs text-muted">{kind.label}{e.kind === "quiz" && ` · ${e.questions} question${e.questions > 1 ? "s" : ""}`}</p></div>
                        </div>
                      </td>
                      <td className="max-w-44 px-3 py-3 text-brand-dark">{e.course_title}</td>
                      <td className="px-3 py-3">
                        {e.session_title ? <span className="inline-flex items-center gap-1.5 rounded-lg bg-brand-soft px-2.5 py-1 text-xs font-semibold text-brand-dark"><CalendarDays className="h-3.5 w-3.5 text-brand" aria-hidden />{e.session_title}</span> : <span className="text-xs text-muted">Toute la formation</span>}
                      </td>
                      <td className="px-3 py-3"><span className={cn("rounded-md px-3 py-1 text-xs font-semibold", kind.tone)}>{kind.label}</span></td>
                      <td className="whitespace-nowrap px-3 py-3 text-brand-dark">
                        {date ? <>{formatDate(date, e.timezone)}{e.available_at && e.due_at && <span className="block text-xs text-muted">{formatTimeRange(e.available_at, e.due_at, e.timezone)}</span>}</> : <span className="text-muted">—</span>}
                      </td>
                      <td className="px-3 py-3"><span className="inline-flex items-center gap-1.5 text-brand-dark"><Users className="h-4 w-4 text-muted" aria-hidden />{nf.format(e.participants)}</span></td>
                      <td className="whitespace-nowrap px-3 py-3 font-semibold">
                        {e.results > 0 ? <span className={e.passed / e.results >= 0.5 ? "text-success" : "text-danger"}>{e.passed} ({formatPercent(e.passed, e.results).replace(" %", "%")})</span> : <span className="text-muted">—</span>}
                      </td>
                      <td className="px-3 py-3"><span className={cn("whitespace-nowrap rounded-md px-3 py-1 text-xs font-semibold", st.tone)}>{st.label}</span></td>
                      <td className="px-3 py-3">
                        <details className="relative">
                          <summary aria-label={`Actions pour ${e.title}`} className="flex h-9 w-9 cursor-pointer list-none items-center justify-center rounded-lg text-brand-dark hover:bg-brand-soft [&::-webkit-details-marker]:hidden"><MoreHorizontal className="h-4 w-4" aria-hidden /></summary>
                          <div className="absolute right-0 z-10 mt-1 w-56 rounded-lg border border-line bg-white py-1 text-sm shadow-card">
                            <Link href={`/admin/formations/${e.course_id}`} className="block px-3 py-2 text-brand-dark hover:bg-brand-soft">Voir la formation</Link>
                            {([
                              e.raw_status === "draft" ? ["published", "Publier l’évaluation", "text-success"] : null,
                              e.raw_status === "published" ? ["draft", "Repasser en brouillon", "text-brand-dark"] : null,
                              e.raw_status === "archived" ? ["published", "Rétablir l’évaluation", "text-success"] : ["archived", "Archiver l’évaluation", "text-danger"],
                            ] as const).map((a) => a && (
                              <form key={a[0] + a[1]} action={setEvaluationStatus}>
                                <input type="hidden" name="evaluationId" value={e.id} /><input type="hidden" name="status" value={a[0]} /><input type="hidden" name="back" value={here} />
                                <button className={cn("block w-full px-3 py-2 text-left hover:bg-brand-soft", a[2])}>{a[1]}</button>
                              </form>
                            ))}
                          </div>
                        </details>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {data.total > 0 && (
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm text-brand-dark">
            <p>Affichage de {nf.format(from)} à {nf.format(to)} sur {nf.format(data.total)} évaluation{data.total > 1 ? "s" : ""}</p>
            <nav aria-label="Pagination" className="flex items-center gap-1">
              {page > 1 ? <Link href={href({ page: page - 1 })} aria-label="Page précédente" className="rounded-lg border border-line p-2 hover:bg-brand-soft"><ChevronLeft className="h-4 w-4" aria-hidden /></Link>
                : <span aria-hidden className="rounded-lg border border-line p-2 opacity-40"><ChevronLeft className="h-4 w-4" /></span>}
              {pageWindow(page, pages).map((n, i) => n === "…"
                ? <span key={`e${i}`} className="px-1 text-muted">…</span>
                : <Link key={n} href={href({ page: n })} aria-current={n === page ? "page" : undefined} className={cn("min-w-9 rounded-lg border px-2.5 py-2 text-center font-semibold", n === page ? "border-brand bg-brand text-white" : "border-line hover:bg-brand-soft")}>{n}</Link>)}
              {page < pages ? <Link href={href({ page: page + 1 })} aria-label="Page suivante" className="rounded-lg border border-line p-2 hover:bg-brand-soft"><ChevronRight className="h-4 w-4" aria-hidden /></Link>
                : <span aria-hidden className="rounded-lg border border-line p-2 opacity-40"><ChevronRight className="h-4 w-4" /></span>}
            </nav>
            <UsersPageSize value={size} options={PAGE_SIZES} hrefs={Object.fromEntries(PAGE_SIZES.map((n) => [n, href({ par: n === PAGE_SIZES[0] ? undefined : n, page: 1 })]))} />
          </div>
        )}
      </section>
    </div>
  );
}

export default function EvaluationsPage({ searchParams }: { searchParams: SP }) {
  return (
    <Suspense fallback={<div className="h-96 animate-pulse rounded-2xl bg-white" aria-hidden />}>
      <Content searchParams={searchParams} />
    </Suspense>
  );
}
