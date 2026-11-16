import { Suspense } from "react";
import Link from "next/link";
import { Check, ChevronLeft, ChevronRight, Clock, CalendarCheck, Coins, Hourglass, MoreHorizontal, Percent, Plus, Settings, Wallet, BarChart3 } from "lucide-react";
import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { CommissionsChart } from "@/components/admin/commissions-chart";
import { CommissionsFilters } from "@/components/admin/commissions-toolbar";
import { StatCard } from "@/components/admin/dashboard-widgets";
import { UsersPageSize, UsersSelectAll } from "@/components/admin/users-toolbar";
import { Avatar } from "@/components/ui/avatar";
import { Alert, EmptyState } from "@/components/ui/feedback";
import {
  COMMISSION_STATUS, COMMISSION_TABS, PAYOUT_METHODS, formatRate, monthLabel, parseCommissionFilters, sessionLabel, type CommissionFilters, type CommissionRow, type CommissionTab, type PayoutRow,
} from "@/lib/admin/commissions";
import { loadCommissionOptions, loadCommissionStats, loadCommissions, loadPayouts, loadRecentPayouts } from "@/lib/admin/commissions-queries";
import { payCommissions, setCommissionRate } from "@/lib/admin/commissions-actions";
import { percentChange } from "@/lib/admin/dashboard";
import { PAGE_SIZES, pageWindow } from "@/lib/admin/users";
import { cn, formatFcfa } from "@/lib/utils";

export const metadata = { title: "Commissions et versements" };

const nf = new Intl.NumberFormat("fr-FR");
const date = (iso: string) => new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "short", year: "numeric", timeZone: "Africa/Abidjan" }).format(new Date(iso));
const RESULTS: Record<string, string> = { verse: "Le versement a été enregistré.", taux: "Le taux de commission a été enregistré." };
const th = "px-3 py-3 font-semibold";
const card = "rounded-2xl border border-line bg-white p-5 shadow-card";

type SP = Promise<{ onglet?: string; q?: string; mois?: string; statut?: string; formateur?: string; page?: string; par?: string; resultat?: string; erreur?: string }>;

function Pager({ page, pages, size, from, to, total, noun, href }: {
  page: number; pages: number; size: number; from: number; to: number; total: number; noun: string;
  href: (over: Record<string, string | number | undefined>) => string;
}) {
  const edge = "rounded-lg border border-line p-2";
  return (
    <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm text-brand-dark">
      <p>Affichage de {nf.format(from)} à {nf.format(to)} sur {nf.format(total)} {noun}{total > 1 ? "s" : ""}</p>
      <nav aria-label="Pagination" className="flex items-center gap-1">
        {page > 1 ? <Link href={href({ page: page - 1 })} aria-label="Page précédente" className={cn(edge, "hover:bg-brand-soft")}><ChevronLeft className="h-4 w-4" aria-hidden /></Link>
          : <span aria-hidden className={cn(edge, "opacity-40")}><ChevronLeft className="h-4 w-4" /></span>}
        {pageWindow(page, pages).map((n, i) => n === "…"
          ? <span key={`e${i}`} className="px-1 text-muted">…</span>
          : <Link key={n} href={href({ page: n })} aria-current={n === page ? "page" : undefined} className={cn("min-w-9 rounded-lg border px-2.5 py-2 text-center font-semibold", n === page ? "border-brand bg-brand text-white" : "border-line hover:bg-brand-soft")}>{n}</Link>)}
        {page < pages ? <Link href={href({ page: page + 1 })} aria-label="Page suivante" className={cn(edge, "hover:bg-brand-soft")}><ChevronRight className="h-4 w-4" aria-hidden /></Link>
          : <span aria-hidden className={cn(edge, "opacity-40")}><ChevronRight className="h-4 w-4" /></span>}
      </nav>
      <UsersPageSize value={size} options={PAGE_SIZES} hrefs={Object.fromEntries(PAGE_SIZES.map((n) => [n, href({ par: n === PAGE_SIZES[0] ? undefined : n, page: 1 })]))} />
    </div>
  );
}

async function Content({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const filters: CommissionFilters = parseCommissionFilters(sp);
  const tab: CommissionTab = filters.tab;
  const size = PAGE_SIZES.includes(Number(sp.par)) ? Number(sp.par) : PAGE_SIZES[0];
  const requested = Math.max(1, Math.floor(Number(sp.page)) || 1);
  const [stats, options, recent] = await Promise.all([loadCommissionStats(), loadCommissionOptions(), loadRecentPayouts(3)]);
  if (!stats) return <Alert>Impossible de charger les commissions. Vérifiez que la migration 54 est appliquée, puis réessayez.</Alert>;

  const load = (offset: number) => tab === "commissions" ? loadCommissions(filters, size, offset) : tab === "versements" ? loadPayouts(size, offset) : null;
  const first = await load((requested - 1) * size);
  if (first?.failed) return <Alert>Impossible de charger la liste. Réessayez dans quelques instants.</Alert>;
  const pages = Math.max(1, Math.ceil((first?.total ?? 0) / size));
  const page = Math.min(requested, pages);
  const data = first && page !== requested ? await load((page - 1) * size) : first;
  const total = data?.total ?? 0;
  const from = total === 0 ? 0 : (page - 1) * size + 1;
  const to = Math.min(total, page * size);

  const href = (over: Record<string, string | number | undefined>) => {
    const u = new URLSearchParams();
    const cur: Record<string, string | number | undefined> = {
      onglet: tab === "commissions" ? undefined : tab, q: filters.q, mois: filters.month, statut: filters.status, formateur: filters.instructor,
      par: size === PAGE_SIZES[0] ? undefined : size, ...over,
    };
    for (const [k, v] of Object.entries(cur)) if (v !== undefined && v !== "" && v !== 1) u.set(k, String(v));
    return `/admin/commissions${u.size ? `?${u}` : ""}`;
  };
  const here = href({ page: page === 1 ? undefined : page });
  const tabHref = (t: CommissionTab) => t === "commissions" ? "/admin/commissions" : `/admin/commissions?onglet=${t}`;
  const currentMonth = new Date().toISOString().slice(0, 7);
  const rate = formatRate(stats.rate);

  const tabIcons = { commissions: Percent, versements: Wallet, parametres: Settings } as const;

  return (
    <div className="space-y-6">
      <AdminPageHeader crumbs={[{ label: "Commissions et versements" }]} icon="payment" title="Commissions et versements"
        description="Gérez le calcul des commissions, suivez les soldes et effectuez les versements aux formateurs et partenaires."
        actions={<div className="flex flex-wrap gap-2">
          <Link href={tabHref("parametres")} className="inline-flex items-center gap-2 rounded-lg border border-brand bg-white px-5 py-2.5 text-sm font-semibold text-brand hover:bg-brand-soft"><Settings className="h-4 w-4" aria-hidden /> Paramètres des commissions</Link>
          <Link href="/admin/commissions/nouveau" className="inline-flex items-center gap-2 rounded-lg bg-brand px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-dark"><Plus className="h-4 w-4" aria-hidden /> Nouveau versement</Link>
        </div>}
      />
      {sp.resultat && RESULTS[sp.resultat] && <Alert tone="success">{RESULTS[sp.resultat]}</Alert>}
      {sp.erreur && <Alert>{sp.erreur}</Alert>}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard icon={Coins} tone="blue" label="Chiffre d’affaires total" value={formatFcfa(stats.revenue)} trend={percentChange(stats.revenue_month, stats.revenue_prev)} note={`+ ${formatFcfa(stats.revenue_month)} ce mois-ci`} />
        <StatCard icon={Percent} tone="green" label={`Commissions totales (${rate})`} value={formatFcfa(stats.commission)} trend={percentChange(stats.commission_month, stats.commission_prev)} note={`+ ${formatFcfa(stats.commission_month)} ce mois-ci`} />
        <StatCard icon={Wallet} tone="orange" label="Versements effectués" value={formatFcfa(stats.paid)} trend={percentChange(stats.paid_month, stats.paid_prev)} note={`${formatFcfa(stats.paid_month)} ce mois-ci`} />
        <StatCard icon={Hourglass} tone="purple" label="Commissions en attente" value={formatFcfa(stats.pending)} note="Restent à verser" />
      </div>

      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <section className={card}>
          <nav aria-label="Sections" className="flex flex-wrap gap-1 border-b border-line pb-3">
            {(Object.keys(COMMISSION_TABS) as CommissionTab[]).map((t) => {
              const Icon = tabIcons[t];
              return (
                <Link key={t} href={tabHref(t)} aria-current={t === tab ? "page" : undefined}
                  className={cn("inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold", t === tab ? "bg-brand text-white" : "text-brand-dark hover:bg-brand-soft")}>
                  <Icon className="h-4 w-4" aria-hidden /> {COMMISSION_TABS[t]}
                </Link>
              );
            })}
          </nav>

          {tab === "commissions" && (
            <div className="mt-4">
              <CommissionsFilters values={filters} options={options} hidden={size !== PAGE_SIZES[0] ? { par: String(size) } : {}} />
              {total === 0 ? (
                <div className="mt-4"><EmptyState title="Aucune commission ne correspond"><Link href="/admin/commissions" className="font-semibold text-brand hover:underline">Réinitialiser les filtres</Link></EmptyState></div>
              ) : (
                <div className="mt-4 overflow-x-auto rounded-xl border border-line">
                  <table className="w-full min-w-[56rem] text-left text-sm">
                    <thead className="bg-surface text-xs text-brand-dark">
                      <tr>
                        <th scope="col" className="w-10 px-3 py-3"><UsersSelectAll formId="commissions-select" /></th>
                        <th scope="col" className={th}>#</th>
                        <th scope="col" className={th}>Formateur</th>
                        <th scope="col" className={th}>Formation / Session</th>
                        <th scope="col" className={th}>CA généré</th>
                        <th scope="col" className={th}>Taux</th>
                        <th scope="col" className={th}>Commission</th>
                        <th scope="col" className={th}>Statut</th>
                        <th scope="col" className={th}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(data?.rows as CommissionRow[]).map((r) => {
                        const st = COMMISSION_STATUS[r.status];
                        return (
                          <tr key={`${r.instructor_id}-${r.course_id}-${r.session_id ?? "none"}`} className="border-t border-line">
                            <td className="px-3 py-3"><input type="checkbox" name="id" form="commissions-select" aria-label={`Sélectionner ${r.course_title}`} className="h-4 w-4 rounded border-line" /></td>
                            <td className="px-3 py-3 text-brand-dark">{r.ord}</td>
                            <td className="px-3 py-3">
                              <div className="flex items-center gap-2.5"><Avatar name={r.instructor_name} src={r.instructor_avatar} size={36} /><span className="font-bold text-brand-dark">{r.instructor_name}</span></div>
                            </td>
                            <td className="px-3 py-3">
                              <Link href={`/admin/formations/${r.course_id}`} className="block font-semibold text-brand-dark hover:text-brand hover:underline">{r.course_title}</Link>
                              <p className="text-xs text-muted">{sessionLabel(r.session_start)}</p>
                            </td>
                            <td className="whitespace-nowrap px-3 py-3 text-brand-dark">{formatFcfa(r.revenue)}</td>
                            <td className="whitespace-nowrap px-3 py-3 text-brand-dark">{formatRate(r.rate)}</td>
                            <td className="whitespace-nowrap px-3 py-3 font-bold text-brand-dark">{formatFcfa(r.amount)}</td>
                            <td className="px-3 py-3">
                              <span className={cn("inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold", st.tone)}>
                                {r.status === "paid" ? <Check className="h-3.5 w-3.5" aria-hidden /> : <Clock className="h-3.5 w-3.5" aria-hidden />}{st.label}
                              </span>
                            </td>
                            <td className="px-3 py-3">
                              <details className="relative">
                                <summary aria-label={`Actions pour ${r.course_title}`} className="flex h-9 w-10 cursor-pointer list-none items-center justify-center rounded-lg border border-line text-brand-dark hover:bg-brand-soft [&::-webkit-details-marker]:hidden"><MoreHorizontal className="h-4 w-4" aria-hidden /></summary>
                                <div className="absolute right-0 z-10 mt-1 w-52 rounded-lg border border-line bg-white py-1 text-sm shadow-card">
                                  <Link href={`/admin/formations/${r.course_id}`} className="block px-3 py-2 text-brand-dark hover:bg-brand-soft">Voir la formation</Link>
                                  {r.pending_amount > 0 && (
                                    <form action={payCommissions}>
                                      <input type="hidden" name="instructorId" value={r.instructor_id} />
                                      <input type="hidden" name="courseId" value={r.course_id} />
                                      <input type="hidden" name="sessionId" value={r.session_id ?? ""} />
                                      <input type="hidden" name="back" value={here} />
                                      <button className="block w-full px-3 py-2 text-left font-semibold text-success hover:bg-brand-soft">Verser {formatFcfa(r.pending_amount)}</button>
                                    </form>
                                  )}
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
              {total > 0 && <Pager page={page} pages={pages} size={size} from={from} to={to} total={total} noun="commission" href={href} />}
            </div>
          )}

          {tab === "versements" && (
            <div className="mt-4">
              {total === 0 ? <EmptyState title="Aucun versement enregistré" /> : (
                <div className="overflow-x-auto rounded-xl border border-line">
                  <table className="w-full min-w-[40rem] text-left text-sm">
                    <thead className="bg-surface text-xs text-brand-dark">
                      <tr><th scope="col" className={th}>Référence</th><th scope="col" className={th}>Formateur</th><th scope="col" className={th}>Montant</th><th scope="col" className={th}>Mode</th><th scope="col" className={th}>Commissions</th><th scope="col" className={th}>Date</th></tr>
                    </thead>
                    <tbody>
                      {(data?.rows as PayoutRow[]).map((p) => (
                        <tr key={p.id} className="border-t border-line">
                          <td className="px-3 py-3 font-semibold text-brand-dark">{p.reference}</td>
                          <td className="px-3 py-3"><div className="flex items-center gap-2.5"><Avatar name={p.instructor_name} src={p.instructor_avatar} size={32} /><span className="font-semibold text-brand-dark">{p.instructor_name}</span></div></td>
                          <td className="whitespace-nowrap px-3 py-3 font-bold text-brand-dark">{formatFcfa(p.amount)}</td>
                          <td className="px-3 py-3 text-brand-dark">{p.method ? PAYOUT_METHODS[p.method] : "—"}</td>
                          <td className="px-3 py-3 text-brand-dark">{nf.format(p.commissions)}</td>
                          <td className="whitespace-nowrap px-3 py-3 text-xs text-brand-dark">{date(p.paid_at)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              {total > 0 && <Pager page={page} pages={pages} size={size} from={from} to={to} total={total} noun="versement" href={href} />}
            </div>
          )}

          {tab === "parametres" && (
            <form action={setCommissionRate} className="mt-5 max-w-lg space-y-4">
              <input type="hidden" name="back" value="/admin/commissions?onglet=parametres" />
              <div>
                <label htmlFor="rate" className="mb-1 block text-sm font-semibold text-brand-dark">Taux de commission de la plateforme (%)</label>
                <input id="rate" name="rate" type="number" inputMode="decimal" min={0} max={100} step="0.01" required defaultValue={stats.rate}
                  className="w-40 rounded-lg border border-line bg-white px-3 py-2.5 text-sm" />
              </div>
              <p className="text-sm text-muted">Le taux est appliqué à chaque paiement de formation confirmé, à partir de son enregistrement. Les commissions déjà calculées conservent leur taux d’origine. Le modifier est tracé dans le journal d’audit.</p>
              <button className="rounded-lg bg-brand px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-dark">Enregistrer le taux</button>
            </form>
          )}
        </section>

        <aside className="space-y-6">
          <section className={card}>
            <h2 className="mb-3 flex items-center gap-2 text-base font-bold text-brand-dark"><BarChart3 className="h-5 w-5 text-brand" aria-hidden /> Évolution des commissions</h2>
            <p className="mb-2 flex items-center gap-2 text-xs text-brand-dark"><span className="h-2.5 w-2.5 rounded-sm bg-brand" aria-hidden /> Commissions (FCFA)</p>
            <CommissionsChart months={stats.months} />
          </section>

          <section className={card}>
            <h2 className="mb-3 flex items-center gap-2 text-base font-bold text-brand-dark"><CalendarCheck className="h-5 w-5 text-brand" aria-hidden /> Synthèse ({monthLabel(currentMonth, "long")})</h2>
            <dl className="space-y-2.5 text-sm">
              <div className="flex justify-between gap-3"><dt className="text-brand-dark">Chiffre d’affaires</dt><dd className="font-bold text-brand-dark">{formatFcfa(stats.revenue_month)}</dd></div>
              <div className="flex justify-between gap-3"><dt className="text-brand-dark">Commissions ({rate})</dt><dd className="font-bold text-brand-dark">{formatFcfa(stats.commission_month)}</dd></div>
              <div className="flex justify-between gap-3"><dt className="text-brand-dark">Versements effectués</dt><dd className="font-bold text-brand-dark">{formatFcfa(stats.paid_month)}</dd></div>
              <div className="flex justify-between gap-3 rounded-lg bg-cta/15 px-3 py-2"><dt className="font-bold text-brand-dark">Solde à verser</dt><dd className="font-extrabold text-cta-dark">{formatFcfa(stats.pending)}</dd></div>
            </dl>
          </section>

          <section className={card}>
            <h2 className="mb-3 flex items-center gap-2 text-base font-bold text-brand-dark"><Wallet className="h-5 w-5 text-brand" aria-hidden /> Derniers versements</h2>
            {recent.length === 0 ? <p className="text-sm text-muted">Aucun versement pour le moment.</p> : (
              <ul className="space-y-3">
                {recent.map((p) => (
                  <li key={p.id} className="flex items-center gap-3">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-success text-white" aria-hidden><Check className="h-4 w-4" /></span>
                    <div className="min-w-0 flex-1"><p className="truncate text-sm font-bold text-brand-dark">{p.instructor_name}</p><p className="text-xs text-muted">Versement – {date(p.paid_at)}</p></div>
                    <span className="whitespace-nowrap text-sm font-bold text-success">{formatFcfa(p.amount)}</span>
                  </li>
                ))}
              </ul>
            )}
            <Link href={tabHref("versements")} className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-brand hover:underline">Voir tous les versements <ChevronRight className="h-4 w-4" aria-hidden /></Link>
          </section>
        </aside>
      </div>
    </div>
  );
}

export default function CommissionsPage({ searchParams }: { searchParams: SP }) {
  return (
    <Suspense fallback={<div className="h-96 animate-pulse rounded-2xl bg-white" aria-hidden />}>
      <Content searchParams={searchParams} />
    </Suspense>
  );
}
