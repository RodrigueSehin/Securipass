import { Suspense } from "react";
import Link from "next/link";
import { ArrowRight, Building2, CheckCircle2, ChevronLeft, ChevronRight, Download, Eye, FileText, Hourglass, MoreHorizontal, Plus, Printer, Undo2, XCircle, type LucideIcon } from "lucide-react";
import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { BillingToolbar, PrintButton } from "@/components/admin/billing-toolbar";
import { StatCard } from "@/components/admin/dashboard-widgets";
import { UsersPageSize } from "@/components/admin/users-toolbar";
import { Avatar } from "@/components/ui/avatar";
import { ButtonLink } from "@/components/ui/button";
import { Alert, EmptyState } from "@/components/ui/feedback";
import { percentChange } from "@/lib/admin/dashboard";
import { BILLING_TABS, INVOICE_STATUS_UI, parseBillingFilters, REFUND_STATUS_UI, sharePct, type BillingTab } from "@/lib/admin/billing";
import { setInvoiceStatus, setRefundStatus } from "@/lib/admin/billing-actions";
import { loadBillingOptions, loadBillingStats, loadCreditNotes, loadInvoices, loadRecentRefunds, loadRefunds } from "@/lib/admin/billing-queries";
import { PAGE_SIZES, pageWindow } from "@/lib/admin/users";
import { cn, formatFcfa } from "@/lib/utils";

export const metadata = { title: "Factures et remboursements" };

const nf = new Intl.NumberFormat("fr-FR");
const RESULTS: Record<string, string> = {
  "facture-creee": "La facture a été émise.", "facture-brouillon": "La facture a été enregistrée en brouillon : émettez-la depuis le menu d’actions.", emise: "La facture a été émise.", "remboursement-cree": "Le remboursement a été enregistré (en cours).", "avoir-cree": "L’avoir a été émis.",
  payee: "La facture est marquée payée.", annulee: "La facture a été annulée.", rembourse: "Le remboursement est marqué effectué.", refuse: "Le remboursement a été refusé.",
};
const dateTime = (iso: string) => new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Africa/Abidjan" }).format(new Date(iso)).replace(",", " à");
const TAB_LABEL: Record<BillingTab, string> = { factures: "Factures", remboursements: "Remboursements", avoirs: "Avoirs" };
const TAB_ICON: Record<BillingTab, LucideIcon> = { factures: FileText, remboursements: Undo2, avoirs: FileText };

type SP = Promise<{ onglet?: string; q?: string; formation?: string; statut?: string; du?: string; au?: string; page?: string; par?: string; resultat?: string; erreur?: string }>;

function Payer({ name, avatar, company }: { name: string | null; avatar: string | null; company: boolean }) {
  return (
    <div className="flex items-center gap-2.5">
      {company ? <span className="flex h-9 w-9 items-center justify-center rounded-full bg-surface text-brand"><Building2 className="h-5 w-5" aria-hidden /></span> : <Avatar name={name ?? ""} src={avatar} size={36} />}
      <span className="font-bold text-brand-dark">{name ?? "—"}</span>
    </div>
  );
}
const Num = ({ children }: { children: string }) => <span className="rounded-md bg-brand-soft px-2.5 py-1 font-mono text-xs text-brand-dark">{children}</span>;

async function Content({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const filters = parseBillingFilters(sp);
  const size = PAGE_SIZES.includes(Number(sp.par)) ? Number(sp.par) : PAGE_SIZES[0];
  const requested = Math.max(1, Math.floor(Number(sp.page)) || 1);
  const loader = filters.tab === "factures" ? loadInvoices : filters.tab === "remboursements" ? loadRefunds : loadCreditNotes;
  const [stats, options, recent, first] = await Promise.all([loadBillingStats(), loadBillingOptions(), loadRecentRefunds(), loader(filters, size, (requested - 1) * size)]);
  if (first.failed || !stats) return <Alert>Impossible de charger les factures. Vérifiez que la migration 51 est appliquée, puis réessayez.</Alert>;

  const pages = Math.max(1, Math.ceil(first.total / size));
  const page = Math.min(requested, pages);
  const data = page === requested ? first : await loader(filters, size, (page - 1) * size);
  const from = data.total === 0 ? 0 : (page - 1) * size + 1;
  const to = Math.min(data.total, page * size);

  const href = (over: Record<string, string | number | undefined>) => {
    const u = new URLSearchParams();
    const cur: Record<string, string | number | undefined> = { onglet: filters.tab === "factures" ? undefined : filters.tab, q: filters.q, formation: filters.course, statut: filters.status, du: filters.from, au: filters.to, par: size === PAGE_SIZES[0] ? undefined : size, ...over };
    for (const [k, v] of Object.entries(cur)) if (v !== undefined && v !== "" && v !== 1) u.set(k, String(v));
    return `/admin/factures${u.size ? `?${u}` : ""}`;
  };
  const here = href({ page: page === 1 ? undefined : page });
  const exportHref = `/admin/factures/export?${new URLSearchParams(Object.entries({ onglet: filters.tab, q: filters.q, formation: filters.course, statut: filters.status, du: filters.from, au: filters.to }).filter(([, v]) => v))}`;
  const counts: Record<BillingTab, number> = { factures: stats.invoices.count, remboursements: stats.refunds.count, avoirs: stats.credit_notes };
  const th = "px-3 py-3 font-semibold";

  return (
    <div className="space-y-6">
      <AdminPageHeader crumbs={[{ label: "Factures et remboursements" }]} icon="document" title="Factures et remboursements" description="Gérez les factures, suivez les paiements et traitez les demandes de remboursement." />
      {sp.resultat && RESULTS[sp.resultat] && <Alert tone="success">{RESULTS[sp.resultat]}</Alert>}
      {sp.erreur && <Alert>{sp.erreur}</Alert>}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard icon={FileText} tone="blue" label="Factures émises" value={nf.format(stats.invoices.count)} trend={percentChange(stats.invoices.month, stats.invoices.prev)} note="" />
        <StatCard icon={CheckCircle2} tone="green" label="Factures payées" value={nf.format(stats.invoices.paid)} note={`(${sharePct(stats.invoices.paid, stats.invoices.count)})`} />
        <StatCard icon={Hourglass} tone="orange" label="Factures en attente" value={nf.format(stats.invoices.pending)} note={`(${sharePct(stats.invoices.pending, stats.invoices.count)})`} />
        <StatCard icon={Undo2} tone="red" label="Remboursements" value={nf.format(stats.refunds.count)} note={formatFcfa(stats.refunds.amount)} />
      </div>

      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_19rem]">
        <section className="rounded-2xl border border-line bg-white p-5 shadow-card">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-line">
            <nav aria-label="Rubriques" className="flex flex-wrap gap-1">
              {BILLING_TABS.map((t) => { const Icon = TAB_ICON[t]; return (
                <Link key={t} href={`/admin/factures${t === "factures" ? "" : `?onglet=${t}`}`} aria-current={filters.tab === t ? "page" : undefined}
                  className={cn("-mb-px inline-flex items-center gap-2 border-b-2 px-3 py-2.5 text-sm font-semibold", filters.tab === t ? "border-brand text-brand" : "border-transparent text-brand-dark hover:text-brand")}>
                  <Icon className="h-4 w-4" aria-hidden />{TAB_LABEL[t]} ({nf.format(counts[t])})</Link>
              ); })}
            </nav>
            <div className="flex flex-wrap gap-2 pb-2">
              <ButtonLink href="/admin/factures/nouvelle"><Plus className="h-4 w-4" aria-hidden /> Nouvelle facture</ButtonLink>
              <Link href="/admin/factures/remboursement/nouveau" className="inline-flex items-center gap-2 rounded-lg border border-brand bg-white px-4 py-2.5 text-sm font-semibold text-brand hover:bg-brand-soft"><Undo2 className="h-4 w-4" aria-hidden /> Nouveau remboursement</Link>
            </div>
          </div>
          <BillingToolbar values={filters} courses={options.courses} hidden={size !== PAGE_SIZES[0] ? { par: String(size) } : {}} />

          {data.total === 0 ? (
            <div className="mt-4"><EmptyState title="Aucun résultat"><Link href={`/admin/factures?onglet=${filters.tab}`} className="font-semibold text-brand hover:underline">Réinitialiser les filtres</Link></EmptyState></div>
          ) : (
            <div className="mt-4 overflow-x-auto rounded-xl border border-line">
              {filters.tab === "factures" && (
                <table className="w-full min-w-[56rem] text-left text-sm">
                  <thead className="bg-surface text-xs text-brand-dark"><tr>
                    <th scope="col" className={th}>N° Facture</th><th scope="col" className={th}>Apprenant / Client</th><th scope="col" className={th}>Formation / Service</th>
                    <th scope="col" className={cn(th, "text-right")}>Montant (FCFA)</th><th scope="col" className={th}>Statut</th><th scope="col" className={th}>Date d’émission</th><th scope="col" className={th}>Actions</th>
                  </tr></thead>
                  <tbody>
                    {(data.rows as import("@/lib/admin/billing").InvoiceRow[]).map((r) => {
                      const st = INVOICE_STATUS_UI[r.status];
                      return (
                        <tr key={r.id} className="border-t border-line">
                          <td className="px-3 py-3"><Num>{r.number}</Num></td>
                          <td className="px-3 py-3"><Payer name={r.payer_name} avatar={r.payer_avatar} company={r.payer_is_company} /></td>
                          <td className="max-w-56 px-3 py-3 text-brand-dark">{r.purpose}</td>
                          <td className="whitespace-nowrap px-3 py-3 text-right font-semibold text-brand-dark">{nf.format(r.amount)}</td>
                          <td className="px-3 py-3"><span className={cn("inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-semibold", st.tone)}>
                            {r.status === "paid" ? <CheckCircle2 className="h-4 w-4" aria-hidden /> : r.status === "draft" ? <FileText className="h-4 w-4" aria-hidden /> : r.status === "pending" ? <Hourglass className="h-4 w-4" aria-hidden /> : <XCircle className="h-4 w-4" aria-hidden />}{st.label}</span></td>
                          <td className="whitespace-nowrap px-3 py-3 text-xs text-brand-dark">{dateTime(r.issued_at)}</td>
                          <td className="px-3 py-3">
                            <div className="flex items-center gap-1">
                              <Link href={`/admin/factures/${r.id}`} aria-label={`Voir la facture ${r.number}`} className="rounded-lg p-2 text-brand-dark hover:bg-brand-soft"><Eye className="h-4 w-4" aria-hidden /></Link>
                              <Link href={`/admin/factures/${r.id}`} aria-label={`Télécharger ou imprimer la facture ${r.number}`} className="rounded-lg p-2 text-brand-dark hover:bg-brand-soft"><Download className="h-4 w-4" aria-hidden /></Link>
                              {r.status !== "cancelled" && (
                                <details className="relative">
                                  <summary aria-label={`Actions pour ${r.number}`} className="flex h-9 w-9 cursor-pointer list-none items-center justify-center rounded-lg text-brand-dark hover:bg-brand-soft [&::-webkit-details-marker]:hidden"><MoreHorizontal className="h-4 w-4" aria-hidden /></summary>
                                  <div className="absolute right-0 z-10 mt-1 w-56 rounded-lg border border-line bg-white py-1 text-sm shadow-card">
                                    {(r.status === "pending" || r.status === "draft") && (r.status === "draft" ? (["pending", "cancelled"] as const) : (["paid", "cancelled"] as const)).map((s) => (
                                      <form key={s} action={setInvoiceStatus}>
                                        <input type="hidden" name="invoiceId" value={r.id} /><input type="hidden" name="status" value={s} /><input type="hidden" name="back" value={here} />
                                        <button className={cn("block w-full px-3 py-2 text-left hover:bg-brand-soft", s === "cancelled" ? "text-danger" : "text-success")}>{s === "paid" ? "Marquer comme payée" : s === "pending" ? "Émettre la facture" : r.status === "draft" ? "Supprimer le brouillon" : "Annuler la facture"}</button>
                                      </form>
                                    ))}
                                    {r.status === "paid" && <Link href={`/admin/factures/remboursement/nouveau?facture=${r.id}`} className="block px-3 py-2 text-brand-dark hover:bg-brand-soft">Rembourser ou émettre un avoir</Link>}
                                  </div>
                                </details>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
              {filters.tab === "remboursements" && (
                <table className="w-full min-w-[52rem] text-left text-sm">
                  <thead className="bg-surface text-xs text-brand-dark"><tr>
                    <th scope="col" className={th}>N° Remboursement</th><th scope="col" className={th}>Apprenant / Client</th><th scope="col" className={th}>Facture</th><th scope="col" className={th}>Motif</th>
                    <th scope="col" className={cn(th, "text-right")}>Montant (FCFA)</th><th scope="col" className={th}>Statut</th><th scope="col" className={th}>Date</th><th scope="col" className={th}>Actions</th>
                  </tr></thead>
                  <tbody>
                    {(data.rows as import("@/lib/admin/billing").RefundRow[]).map((r) => {
                      const st = REFUND_STATUS_UI[r.status];
                      return (
                        <tr key={r.id} className="border-t border-line">
                          <td className="px-3 py-3"><Num>{r.number}</Num></td>
                          <td className="px-3 py-3"><Payer name={r.payer_name} avatar={r.payer_avatar} company={r.payer_is_company} /></td>
                          <td className="px-3 py-3"><Num>{r.invoice_number}</Num></td>
                          <td className="max-w-48 px-3 py-3 text-brand-dark">{r.reason}</td>
                          <td className="whitespace-nowrap px-3 py-3 text-right font-semibold text-brand-dark">{nf.format(r.amount)}</td>
                          <td className="px-3 py-3"><span className={cn("whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-semibold", st.tone)}>{st.label}</span></td>
                          <td className="whitespace-nowrap px-3 py-3 text-xs text-brand-dark">{dateTime(r.requested_at)}</td>
                          <td className="px-3 py-3">
                            {r.status === "in_progress" ? (
                              <details className="relative">
                                <summary aria-label={`Actions pour ${r.number}`} className="flex h-9 w-9 cursor-pointer list-none items-center justify-center rounded-lg text-brand-dark hover:bg-brand-soft [&::-webkit-details-marker]:hidden"><MoreHorizontal className="h-4 w-4" aria-hidden /></summary>
                                <div className="absolute right-0 z-10 mt-1 w-52 rounded-lg border border-line bg-white py-1 text-sm shadow-card">
                                  {(["refunded", "rejected"] as const).map((s) => (
                                    <form key={s} action={setRefundStatus}>
                                      <input type="hidden" name="refundId" value={r.id} /><input type="hidden" name="status" value={s} /><input type="hidden" name="back" value={here} />
                                      <button className={cn("block w-full px-3 py-2 text-left hover:bg-brand-soft", s === "refunded" ? "text-success" : "text-danger")}>{s === "refunded" ? "Marquer comme remboursé" : "Refuser"}</button>
                                    </form>
                                  ))}
                                </div>
                              </details>
                            ) : <span className="text-muted" title="Traité">—</span>}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
              {filters.tab === "avoirs" && (
                <table className="w-full min-w-[48rem] text-left text-sm">
                  <thead className="bg-surface text-xs text-brand-dark"><tr>
                    <th scope="col" className={th}>N° Avoir</th><th scope="col" className={th}>Apprenant / Client</th><th scope="col" className={th}>Facture</th><th scope="col" className={th}>Motif</th>
                    <th scope="col" className={cn(th, "text-right")}>Montant (FCFA)</th><th scope="col" className={th}>Date d’émission</th>
                  </tr></thead>
                  <tbody>
                    {(data.rows as import("@/lib/admin/billing").CreditNoteRow[]).map((r) => (
                      <tr key={r.id} className="border-t border-line">
                        <td className="px-3 py-3"><Num>{r.number}</Num></td>
                        <td className="px-3 py-3"><Payer name={r.payer_name} avatar={r.payer_avatar} company={r.payer_is_company} /></td>
                        <td className="px-3 py-3"><Num>{r.invoice_number}</Num></td>
                        <td className="max-w-56 px-3 py-3 text-brand-dark">{r.reason}</td>
                        <td className="whitespace-nowrap px-3 py-3 text-right font-semibold text-brand-dark">{nf.format(r.amount)}</td>
                        <td className="whitespace-nowrap px-3 py-3 text-xs text-brand-dark">{dateTime(r.issued_at)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}

          {data.total > 0 && (
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm text-brand-dark">
              <p>Affichage de {nf.format(from)} à {nf.format(to)} sur {nf.format(data.total)} {filters.tab === "factures" ? "facture" : filters.tab === "remboursements" ? "remboursement" : "avoir"}{data.total > 1 ? "s" : ""}</p>
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

        <aside className="space-y-6 print:hidden">
          <section className="rounded-2xl border border-line bg-white p-5 shadow-card">
            <h2 className="mb-3 text-lg font-extrabold text-brand-dark">Actions rapides</h2>
            <ul className="space-y-1 text-sm font-semibold text-brand-dark">
              <li><Link href="/admin/factures/nouvelle" className="flex items-center gap-3 rounded-lg px-2 py-2 hover:bg-brand-soft"><Plus className="h-4 w-4" aria-hidden />Nouvelle facture</Link></li>
              <li><Link href="/admin/factures/remboursement/nouveau" className="flex items-center gap-3 rounded-lg px-2 py-2 hover:bg-brand-soft"><Undo2 className="h-4 w-4" aria-hidden />Nouveau remboursement</Link></li>
              <li><PrintButton label="Imprimer un relevé" className="flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left text-sm font-semibold hover:bg-brand-soft" /></li>
              <li><a href={exportHref} className="flex items-center gap-3 rounded-lg px-2 py-2 hover:bg-brand-soft"><Download className="h-4 w-4" aria-hidden />Exporter (CSV)</a></li>
            </ul>
          </section>
          <section className="rounded-2xl border border-line bg-white p-5 shadow-card">
            <h2 className="mb-3 text-lg font-extrabold text-brand-dark">Derniers remboursements</h2>
            {recent.length === 0 ? <p className="text-sm text-muted">Aucun remboursement.</p> : (
              <ul className="space-y-4">
                {recent.map((r) => (
                  <li key={r.id} className="grid grid-cols-[2.5rem_1fr_auto] items-start gap-3">
                    <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-soft text-brand"><Undo2 className="h-5 w-5" aria-hidden /></span>
                    <div className="min-w-0"><p className="text-sm font-bold text-brand-dark">{r.number}</p><p className="truncate text-xs text-muted">{r.payer_name ?? "—"}</p></div>
                    <div className="text-right"><p className="whitespace-nowrap text-sm font-bold text-success">{formatFcfa(r.amount)}</p>
                      <p className="text-xs text-muted">{new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short", year: "numeric", timeZone: "Africa/Abidjan" }).format(new Date(r.requested_at))}</p>
                      <span className={cn("mt-1 inline-block rounded-md px-2 py-0.5 text-xs font-semibold", REFUND_STATUS_UI[r.status].tone)}>{REFUND_STATUS_UI[r.status].label}</span></div>
                  </li>
                ))}
              </ul>
            )}
            <Link href="/admin/factures?onglet=remboursements" className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-brand hover:underline">Voir tous les remboursements <ArrowRight className="h-4 w-4" aria-hidden /></Link>
          </section>
        </aside>
      </div>
      <p className="hidden text-xs text-muted print:block"><Printer className="mr-1 inline h-3 w-3" aria-hidden />Relevé imprimé depuis l’administration SECURIPASS.</p>
    </div>
  );
}

export default function BillingPage({ searchParams }: { searchParams: SP }) {
  return (
    <Suspense fallback={<div className="h-96 animate-pulse rounded-2xl bg-white" aria-hidden />}>
      <Content searchParams={searchParams} />
    </Suspense>
  );
}
