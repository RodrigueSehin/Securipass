import { Suspense } from "react";
import Link from "next/link";
import { Banknote, Building2, CheckCircle2, ChevronLeft, ChevronRight, Clock, CreditCard, Download, FileText, Landmark, MoreHorizontal, Plus, Smartphone, Wallet, XCircle, type LucideIcon } from "lucide-react";
import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { StatCard } from "@/components/admin/dashboard-widgets";
import { KindDonut, PaymentsChart } from "@/components/admin/payments-charts";
import { PaymentsToolbar } from "@/components/admin/payments-toolbar";
import { UsersPageSize } from "@/components/admin/users-toolbar";
import { Avatar } from "@/components/ui/avatar";
import { ButtonLink } from "@/components/ui/button";
import { Alert, EmptyState } from "@/components/ui/feedback";
import { percentChange } from "@/lib/admin/dashboard";
import { formatShare, PAYMENT_METHODS, PAYMENT_STATUS_UI, PAYMENT_TABS, PAYMENT_TAB_LABEL, parsePaymentFilters, type PaymentMethod } from "@/lib/admin/payments";
import { setPaymentStatus } from "@/lib/admin/payments-actions";
import { loadPaymentOptions, loadPayments, loadPaymentStats } from "@/lib/admin/payments-queries";
import { PAGE_SIZES, pageWindow } from "@/lib/admin/users";
import { cn, formatFcfa } from "@/lib/utils";

export const metadata = { title: "Paiements" };

const nf = new Intl.NumberFormat("fr-FR");
const RESULTS: Record<string, string> = { cree: "Le paiement a été enregistré.", confirme: "Le paiement a été confirmé.", echoue: "Le paiement a été déclaré échoué.", annule: "Le paiement a été annulé." };
const METHOD_ICON: Record<PaymentMethod, LucideIcon> = { mobile_money: Smartphone, card: CreditCard, bank_transfer: Landmark, cash: Banknote, cheque: FileText };
const dateTime = (iso: string) => new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Africa/Abidjan" }).format(new Date(iso)).replace(",", " à");
const monthLabel = (ym: string) => { const s = new Intl.DateTimeFormat("fr-FR", { month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(`${ym}-01T00:00:00Z`)); return s.charAt(0).toUpperCase() + s.slice(1); };

type SP = Promise<{ q?: string; formation?: string; statut?: string; du?: string; au?: string; page?: string; par?: string; resultat?: string; erreur?: string }>;

async function Content({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const filters = parsePaymentFilters(sp);
  const size = PAGE_SIZES.includes(Number(sp.par)) ? Number(sp.par) : PAGE_SIZES[0];
  const requested = Math.max(1, Math.floor(Number(sp.page)) || 1);
  const [stats, options, first] = await Promise.all([loadPaymentStats(), loadPaymentOptions(), loadPayments(filters, size, (requested - 1) * size)]);
  if (first.failed) return <Alert>Impossible de charger les paiements. Vérifiez que la migration 49 est appliquée, puis réessayez.</Alert>;

  const pages = Math.max(1, Math.ceil(first.total / size));
  const page = Math.min(requested, pages);
  const data = page === requested ? first : await loadPayments(filters, size, (page - 1) * size);
  const from = data.total === 0 ? 0 : (page - 1) * size + 1;
  const to = Math.min(data.total, page * size);

  const href = (over: Record<string, string | number | undefined>) => {
    const u = new URLSearchParams();
    const cur: Record<string, string | number | undefined> = { q: filters.q, formation: filters.course, statut: filters.status, du: filters.from, au: filters.to, par: size === PAGE_SIZES[0] ? undefined : size, ...over };
    for (const [k, v] of Object.entries(cur)) if (v !== undefined && v !== "" && v !== 1) u.set(k, String(v));
    return `/admin/paiements${u.size ? `?${u}` : ""}`;
  };
  const here = href({ page: page === 1 ? undefined : page });
  const exportParams = Object.entries({ q: filters.q, formation: filters.course, statut: filters.status, du: filters.from, au: filters.to }).filter(([, v]) => v);
  const tabs: [string, string, number | undefined][] = [["", "Toutes les transactions", stats?.counts.all], ...PAYMENT_TABS.map((k): [string, string, number | undefined] => [k, PAYMENT_TAB_LABEL[k], stats?.counts[k]])];
  const th = "px-3 py-3 font-semibold";

  return (
    <div className="space-y-6">
      <AdminPageHeader crumbs={[{ label: "Paiements" }]} icon="payment" title="Paiements" description="Suivez, validez et gérez tous les paiements des formations, certifications et services." />
      {sp.resultat && RESULTS[sp.resultat] && <Alert tone="success">{RESULTS[sp.resultat]}</Alert>}
      {sp.erreur && <Alert>{sp.erreur}</Alert>}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard icon={Wallet} tone="blue" label="Montant total" value={stats ? formatFcfa(stats.total) : "—"} trend={stats ? percentChange(stats.total_month, stats.total_prev) : null} note="" />
        <StatCard icon={CheckCircle2} tone="green" label="Paiements confirmés" value={stats ? formatFcfa(stats.confirmed) : "—"} note={stats ? `(${formatShare(stats.confirmed, stats.total)})` : ""} />
        <StatCard icon={Clock} tone="orange" label="En attente" value={stats ? formatFcfa(stats.pending) : "—"} note={stats ? `(${formatShare(stats.pending, stats.total)})` : ""} />
        <StatCard icon={XCircle} tone="red" label="Échoués / Annulés" value={stats ? formatFcfa(stats.failed) : "—"} note={stats ? `(${formatShare(stats.failed, stats.total)})` : ""} />
      </div>

      {stats && (
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
          <section className="rounded-2xl border border-line bg-white p-5 shadow-card">
            <h2 className="mb-3 text-lg font-extrabold text-brand-dark">Évolution des paiements <span className="text-sm font-normal text-muted">(6 derniers mois, confirmés)</span></h2>
            <PaymentsChart months={stats.months.map((m) => ({ label: monthLabel(m.month), amount: m.amount }))} />
          </section>
          <section className="rounded-2xl border border-line bg-white p-5 shadow-card">
            <h2 className="mb-3 text-lg font-extrabold text-brand-dark">Paiements par type <span className="text-sm font-normal text-muted">(confirmés)</span></h2>
            <KindDonut byKind={stats.by_kind} />
          </section>
        </div>
      )}

      <section className="rounded-2xl border border-line bg-white p-5 shadow-card">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-line">
          <nav aria-label="Statut des paiements" className="flex flex-wrap gap-1">
            {tabs.map(([key, label, count]) => (
              <Link key={key || "all"} href={href({ statut: key || undefined, page: 1 })} aria-current={filters.status === key ? "page" : undefined}
                className={cn("-mb-px border-b-2 px-3 py-2.5 text-sm font-semibold", filters.status === key ? "border-brand text-brand" : "border-transparent text-brand-dark hover:text-brand")}>
                {label}{count !== undefined && ` (${nf.format(count)})`}
              </Link>
            ))}
          </nav>
          <div className="flex flex-wrap gap-2 pb-2">
            <ButtonLink href="/admin/paiements/nouveau"><Plus className="h-4 w-4" aria-hidden /> Nouveau paiement</ButtonLink>
            <a href={`/admin/paiements/export${exportParams.length ? `?${new URLSearchParams(exportParams)}` : ""}`} className="inline-flex items-center gap-2 rounded-lg border border-line bg-white px-5 py-2.5 text-sm font-semibold text-brand-dark hover:bg-brand-soft"><Download className="h-4 w-4" aria-hidden /> Exporter</a>
          </div>
        </div>
        <PaymentsToolbar values={filters} options={options} hidden={{ ...(size !== PAGE_SIZES[0] ? { par: String(size) } : {}) }} />

        {data.total === 0 ? (
          <div className="mt-4"><EmptyState title="Aucun paiement ne correspond"><Link href="/admin/paiements" className="font-semibold text-brand hover:underline">Réinitialiser les filtres</Link></EmptyState></div>
        ) : (
          <div className="mt-4 overflow-x-auto rounded-xl border border-line">
            <table className="w-full min-w-[60rem] text-left text-sm">
              <thead className="bg-surface text-xs text-brand-dark"><tr>
                <th scope="col" className={th}>#</th><th scope="col" className={th}>Référence</th><th scope="col" className={th}>Apprenant / Entreprise</th><th scope="col" className={th}>Formation / Service</th>
                <th scope="col" className={cn(th, "text-right")}>Montant</th><th scope="col" className={th}>Mode de paiement</th><th scope="col" className={th}>Date de paiement</th><th scope="col" className={th}>Statut</th><th scope="col" className={th}>Actions</th>
              </tr></thead>
              <tbody>
                {data.rows.map((p, i) => {
                  const st = PAYMENT_STATUS_UI[p.status];
                  const MIcon = METHOD_ICON[p.method];
                  return (
                    <tr key={p.id} className="border-t border-line">
                      <td className="px-3 py-3 text-muted">{(page - 1) * size + i + 1}</td>
                      <td className="px-3 py-3"><span className="rounded-md bg-brand-soft px-2.5 py-1 font-mono text-xs text-brand-dark">{p.reference}</span></td>
                      <td className="px-3 py-3"><div className="flex items-center gap-2.5">
                        {p.payer_is_company ? <span className="flex h-9 w-9 items-center justify-center rounded-full bg-surface text-brand"><Building2 className="h-5 w-5" aria-hidden /></span> : <Avatar name={p.payer_name ?? ""} src={p.payer_avatar} size={36} />}
                        <span className="font-bold text-brand-dark">{p.payer_name ?? "—"}</span></div></td>
                      <td className="max-w-56 px-3 py-3 text-brand-dark">{p.purpose}</td>
                      <td className="whitespace-nowrap px-3 py-3 text-right font-semibold text-brand-dark">{formatFcfa(p.amount)}</td>
                      <td className="whitespace-nowrap px-3 py-3 text-brand-dark"><span className="inline-flex items-center gap-2"><MIcon className="h-4 w-4 text-brand" aria-hidden />{PAYMENT_METHODS[p.method]}</span></td>
                      <td className="whitespace-nowrap px-3 py-3 text-xs text-brand-dark">{dateTime(p.paid_at)}</td>
                      <td className="px-3 py-3"><span className={cn("inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-semibold", st.tone)}>
                        {p.status === "confirmed" ? <CheckCircle2 className="h-4 w-4" aria-hidden /> : p.status === "pending" ? <Clock className="h-4 w-4" aria-hidden /> : <XCircle className="h-4 w-4" aria-hidden />}{st.label}</span></td>
                      <td className="px-3 py-3">
                        {p.status === "pending" ? (
                          <details className="relative">
                            <summary aria-label={`Actions pour ${p.reference}`} className="flex h-9 w-9 cursor-pointer list-none items-center justify-center rounded-lg text-brand-dark hover:bg-brand-soft [&::-webkit-details-marker]:hidden"><MoreHorizontal className="h-4 w-4" aria-hidden /></summary>
                            <div className="absolute right-0 z-10 mt-1 w-52 rounded-lg border border-line bg-white py-1 text-sm shadow-card">
                              {([["confirmed", "Confirmer le paiement", "text-success"], ["failed", "Déclarer échoué", "text-danger"], ["cancelled", "Annuler le paiement", "text-brand-dark"]] as const).map(([s, l, tone]) => (
                                <form key={s} action={setPaymentStatus}>
                                  <input type="hidden" name="paymentId" value={p.id} /><input type="hidden" name="status" value={s} /><input type="hidden" name="back" value={here} />
                                  <button className={cn("block w-full px-3 py-2 text-left hover:bg-brand-soft", tone)}>{l}</button>
                                </form>
                              ))}
                            </div>
                          </details>
                        ) : <span className="text-muted" title="Statut définitif">—</span>}
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
            <p>Affichage de {nf.format(from)} à {nf.format(to)} sur {nf.format(data.total)} paiement{data.total > 1 ? "s" : ""}</p>
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

export default function PaymentsPage({ searchParams }: { searchParams: SP }) {
  return (
    <Suspense fallback={<div className="h-96 animate-pulse rounded-2xl bg-white" aria-hidden />}>
      <Content searchParams={searchParams} />
    </Suspense>
  );
}
