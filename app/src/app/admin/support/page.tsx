import { Suspense } from "react";
import Link from "next/link";
import { BookOpen, CalendarDays, Check, ChevronLeft, ChevronRight, Clock, FileText, GraduationCap, Hourglass, Headset, OctagonAlert, Plus, Settings, Timer, Zap, PieChart, ShieldCheck, ArrowUp, ArrowDown } from "lucide-react";
import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { StatCard } from "@/components/admin/dashboard-widgets";
import { CategoryDonut, CategoryTag } from "@/components/admin/support-widgets";
import { RowMenu } from "@/components/admin/row-menu";
import { SupportFilters } from "@/components/admin/support-toolbar";
import { UsersPageSize, UsersSelectAll } from "@/components/admin/users-toolbar";
import { Avatar } from "@/components/ui/avatar";
import { Alert, EmptyState } from "@/components/ui/feedback";
import { percentChange } from "@/lib/admin/dashboard";
import {
  SUPPORT_PAGE_SIZES, SUPPORT_PRIORITIES, SUPPORT_STATUS, SUPPORT_TABS, categoryShares, formatDelay, parseSupportFilters,
  type SupportPriority, type SupportRow, type SupportStatus, type SupportTab,
} from "@/lib/admin/support";
import { assignSupportTicket, setSupportPriority, setSupportStatus } from "@/lib/admin/support-actions";
import { loadSupportStats, loadSupportTickets } from "@/lib/admin/support-queries";
import { pageWindow } from "@/lib/admin/users";
import { cn } from "@/lib/utils";

export const metadata = { title: "Support" };

const nf = new Intl.NumberFormat("fr-FR");
const when = (iso: string) => {
  const d = new Date(iso);
  const day = new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "short", year: "numeric", timeZone: "Africa/Abidjan" }).format(d);
  const time = new Intl.DateTimeFormat("fr-FR", { hour: "2-digit", minute: "2-digit", timeZone: "Africa/Abidjan" }).format(d);
  return `${day}, ${time}`;
};
const RESULTS: Record<string, string> = {
  cree: "La demande a été créée.", in_progress: "Le ticket est en cours de traitement.", waiting: "Le ticket est en attente.", new: "Le ticket est de nouveau ouvert.",
  resolved: "Le ticket est résolu.", archived: "Le ticket a été archivé.", priorite: "La priorité a été modifiée.", assigne: "Le ticket vous est assigné.", desassigne: "Le ticket n’est plus assigné.",
};
const th = "px-3 py-3 font-semibold";
const card = "rounded-2xl border border-line bg-white p-5 shadow-card";

type SP = Promise<{ onglet?: string; q?: string; categorie?: string; statut?: string; priorite?: string; page?: string; par?: string; resultat?: string; erreur?: string }>;

function StatusTag({ status }: { status: SupportStatus }) {
  const s = SUPPORT_STATUS[status];
  const Icon = status === "resolved" ? Check : status === "waiting" ? Hourglass : status === "in_progress" ? Clock : status === "archived" ? FileText : Zap;
  return <span className={cn("inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold", s.tone)}><Icon className="h-3.5 w-3.5" aria-hidden />{s.label}</span>;
}

/** Actions possibles sur un ticket : assignation, statut et priorité (les autres valeurs que l'actuelle). */
function rowActions(r: SupportRow): { kind: "assign" | "status" | "priority"; value: string; label: string; tone?: string }[] {
  const out: { kind: "assign" | "status" | "priority"; value: string; label: string; tone?: string }[] = [];
  const open = r.status !== "resolved" && r.status !== "archived";
  if (open) out.push({ kind: "assign", value: "1", label: r.assigned_to ? "Me l’assigner" : "Prendre en charge" });
  if (open && r.assigned_to) out.push({ kind: "assign", value: "0", label: "Retirer l’assignation" });
  if (open && r.status !== "in_progress") out.push({ kind: "status", value: "in_progress", label: "Mettre en cours" });
  if (open && r.status !== "waiting") out.push({ kind: "status", value: "waiting", label: "Mettre en attente" });
  if (open) out.push({ kind: "status", value: "resolved", label: "Marquer comme résolu", tone: "text-success" });
  if (r.status === "resolved") out.push({ kind: "status", value: "archived", label: "Archiver" });
  if (!open) out.push({ kind: "status", value: "in_progress", label: "Rouvrir" });
  (Object.keys(SUPPORT_PRIORITIES) as SupportPriority[]).filter((p) => p !== r.priority).forEach((p) => out.push({ kind: "priority", value: p, label: `Priorité ${SUPPORT_PRIORITIES[p].label.toLowerCase()}` }));
  return out;
}

async function Content({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const filters = parseSupportFilters(sp);
  const size = SUPPORT_PAGE_SIZES.includes(Number(sp.par)) ? Number(sp.par) : SUPPORT_PAGE_SIZES[0];
  const requested = Math.max(1, Math.floor(Number(sp.page)) || 1);
  const [stats, first] = await Promise.all([loadSupportStats(), loadSupportTickets(filters, size, (requested - 1) * size)]);
  if (!stats || first.failed) return <Alert>Impossible de charger les tickets. Vérifiez que la migration 58 est appliquée, puis réessayez.</Alert>;

  const pages = Math.max(1, Math.ceil(first.total / size));
  const page = Math.min(requested, pages);
  const data = page === requested ? first : await loadSupportTickets(filters, size, (page - 1) * size);
  const from = data.total === 0 ? 0 : (page - 1) * size + 1;
  const to = Math.min(data.total, page * size);

  const href = (over: Record<string, string | number | undefined>) => {
    const u = new URLSearchParams();
    const cur: Record<string, string | number | undefined> = {
      onglet: filters.tab === "all" ? undefined : filters.tab, q: filters.q, categorie: filters.category, statut: filters.status, priorite: filters.priority,
      par: size === SUPPORT_PAGE_SIZES[0] ? undefined : size, ...over,
    };
    for (const [k, v] of Object.entries(cur)) if (v !== undefined && v !== "" && v !== 1) u.set(k, String(v));
    return `/admin/support${u.size ? `?${u}` : ""}`;
  };
  const here = href({ page: page === 1 ? undefined : page });
  const tabHref = (t: SupportTab) => (t === "all" ? "/admin/support" : `/admin/support?onglet=${t}`);

  const share = (n: number) => (stats.total > 0 ? `${(Math.round((n / stats.total) * 1000) / 10).toLocaleString("fr-FR", { minimumFractionDigits: 1 })} % du total` : "");
  const delay = percentChange(stats.avg_month ?? 0, stats.avg_prev ?? 0);
  const delayTrend = stats.avg_month !== null && stats.avg_prev !== null && delay ? { ...delay, good: !delay.up } : null;
  const slaDiff = stats.sla_month !== null && stats.sla_prev !== null ? stats.sla_month - stats.sla_prev : null;
  const closed = stats.resolved + stats.archived;
  const shares = categoryShares(stats.categories, stats.total);

  return (
    <div className="space-y-6">
      <AdminPageHeader crumbs={[{ label: "Support" }]} icon="document" title="Support" description="Gérez les demandes d’assistance, suivez leur traitement et assurez un support de qualité à vos utilisateurs."
        actions={<div className="flex flex-wrap gap-2">
          <button type="button" disabled title="Base de connaissances : bientôt disponible" className="inline-flex cursor-not-allowed items-center gap-2 rounded-lg border border-brand bg-white px-5 py-2.5 text-sm font-semibold text-brand opacity-50"><BookOpen className="h-4 w-4" aria-hidden /> Base de connaissances</button>
          <Link href="/admin/support/nouvelle" className="inline-flex items-center gap-2 rounded-lg bg-brand px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-dark"><Plus className="h-4 w-4" aria-hidden /> Nouvelle demande</Link>
        </div>}
      />
      {sp.resultat && RESULTS[sp.resultat] && <Alert tone="success">{RESULTS[sp.resultat]}</Alert>}
      {sp.erreur && <Alert>{sp.erreur}</Alert>}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <StatCard icon={GraduationCap} tone="blue" label="Demandes (tickets)" value={nf.format(stats.total)} trend={percentChange(stats.total_month, stats.total_prev)} note={`+ ${nf.format(stats.total_month)} ce mois-ci`} />
        <StatCard icon={Check} tone="green" label="Résolues" value={nf.format(stats.resolved)} note={share(stats.resolved)} />
        <StatCard icon={Hourglass} tone="orange" label="En cours" value={nf.format(stats.in_progress)} note={share(stats.in_progress)} />
        <StatCard icon={OctagonAlert} tone="red" label="En attente" value={nf.format(stats.waiting)} note={share(stats.waiting)} />
        <StatCard icon={Timer} tone="purple" label="Délai moyen de résolution" value={formatDelay(stats.avg_seconds)} trend={delayTrend} note={closed > 0 ? `Sur ${nf.format(closed)} ticket${closed > 1 ? "s" : ""} résolu${closed > 1 ? "s" : ""}` : "Aucun ticket résolu"} />
      </div>

      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <section className={card}>
          <nav aria-label="Onglets" className="flex flex-wrap gap-1 border-b border-line pb-3">
            {(Object.keys(SUPPORT_TABS) as SupportTab[]).map((t) => (
              <Link key={t} href={tabHref(t)} aria-current={t === filters.tab ? "page" : undefined}
                className={cn("rounded-lg px-4 py-2.5 text-sm font-semibold", t === filters.tab ? "bg-brand text-white" : "text-brand-dark hover:bg-brand-soft")}>
                {SUPPORT_TABS[t]} ({nf.format(stats.tabs[t])})
              </Link>
            ))}
          </nav>

          <div className="mt-4">
            <SupportFilters values={filters} reset={tabHref(filters.tab)} hidden={{ ...(filters.tab !== "all" ? { onglet: filters.tab } : {}), ...(size !== SUPPORT_PAGE_SIZES[0] ? { par: String(size) } : {}) }} />
            {data.total === 0 ? (
              <div className="mt-4"><EmptyState title="Aucun ticket ne correspond"><Link href={tabHref(filters.tab)} className="font-semibold text-brand hover:underline">Réinitialiser les filtres</Link></EmptyState></div>
            ) : (
              <div className="mt-4 overflow-x-auto rounded-xl border border-line">
                <table className="w-full min-w-[62rem] text-left text-sm">
                  <thead className="bg-surface text-xs text-brand-dark">
                    <tr>
                      <th scope="col" className="w-10 px-3 py-3"><UsersSelectAll formId="support-select" /></th>
                      {["#", "Sujet", "Demandeur", "Catégorie", "Priorité", "Statut", "Dernière mise à jour", "Actions"].map((h) => <th key={h} scope="col" className={th}>{h}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {data.rows.map((r) => {
                      const pr = SUPPORT_PRIORITIES[r.priority];
                      return (
                        <tr key={r.id} className="border-t border-line">
                          <td className="px-3 py-3"><input type="checkbox" name="id" form="support-select" aria-label={`Sélectionner ${r.reference}`} className="h-4 w-4 rounded border-line" /></td>
                          <td className="whitespace-nowrap px-3 py-3 font-bold text-brand">{r.reference}</td>
                          <td className="max-w-[16rem] px-3 py-3 font-semibold text-brand-dark"><Link href={`/admin/support/${r.id}`} className="hover:text-brand hover:underline">{r.subject}</Link>{r.assignee_name && <span className="block text-xs font-normal text-muted">Assigné à {r.assignee_name}</span>}</td>
                          <td className="px-3 py-3"><div className="flex items-center gap-2.5"><Avatar name={r.requester_name} src={r.requester_avatar} size={36} /><div className="min-w-0"><p className="font-bold text-brand-dark">{r.requester_name}</p>{r.requester_code && <p className="text-xs text-muted">{r.requester_code}</p>}</div></div></td>
                          <td className="px-3 py-3"><CategoryTag category={r.category} /></td>
                          <td className="px-3 py-3"><span className={cn("inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold", pr.tone)}><span className={cn("h-2 w-2 rounded-full", pr.dot)} aria-hidden />{pr.label}</span></td>
                          <td className="px-3 py-3"><StatusTag status={r.status} /></td>
                          <td className="whitespace-nowrap px-3 py-3 text-xs text-brand-dark"><span className="inline-flex items-center gap-2"><CalendarDays className="h-4 w-4 text-brand" aria-hidden />{when(r.updated_at)}</span></td>
                          <td className="px-3 py-3">
                            <RowMenu label={`Actions pour ${r.reference}`}>
                                <Link href={`/admin/support/${r.id}`} className="block px-3 py-2 font-semibold text-brand hover:bg-brand-soft">Ouvrir le ticket</Link>
                                {rowActions(r).map((a) => (
                                  <form key={`${a.kind}-${a.value}`} action={a.kind === "assign" ? assignSupportTicket : a.kind === "status" ? setSupportStatus : setSupportPriority}>
                                    <input type="hidden" name="ticketId" value={r.id} />
                                    <input type="hidden" name="back" value={here} />
                                    {a.kind === "assign" && <input type="hidden" name="me" value={a.value} />}
                                    {a.kind === "status" && <input type="hidden" name="status" value={a.value} />}
                                    {a.kind === "priority" && <input type="hidden" name="priority" value={a.value} />}
                                    <button className={cn("block w-full px-3 py-2 text-left hover:bg-brand-soft", a.tone ?? "text-brand-dark")}>{a.label}</button>
                                  </form>
                                ))}
                            </RowMenu>
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
                <p>Affichage de {nf.format(from)} à {nf.format(to)} sur {nf.format(data.total)} ticket{data.total > 1 ? "s" : ""}</p>
                <nav aria-label="Pagination" className="flex items-center gap-1">
                  {page > 1 ? <Link href={href({ page: page - 1 })} aria-label="Page précédente" className="rounded-lg border border-line p-2 hover:bg-brand-soft"><ChevronLeft className="h-4 w-4" aria-hidden /></Link>
                    : <span aria-hidden className="rounded-lg border border-line p-2 opacity-40"><ChevronLeft className="h-4 w-4" /></span>}
                  {pageWindow(page, pages).map((n, i) => n === "…"
                    ? <span key={`e${i}`} className="px-1 text-muted">…</span>
                    : <Link key={n} href={href({ page: n })} aria-current={n === page ? "page" : undefined} className={cn("min-w-9 rounded-lg border px-2.5 py-2 text-center font-semibold", n === page ? "border-brand bg-brand text-white" : "border-line hover:bg-brand-soft")}>{n}</Link>)}
                  {page < pages ? <Link href={href({ page: page + 1 })} aria-label="Page suivante" className="rounded-lg border border-line p-2 hover:bg-brand-soft"><ChevronRight className="h-4 w-4" aria-hidden /></Link>
                    : <span aria-hidden className="rounded-lg border border-line p-2 opacity-40"><ChevronRight className="h-4 w-4" /></span>}
                </nav>
                <UsersPageSize value={size} options={SUPPORT_PAGE_SIZES} hrefs={Object.fromEntries(SUPPORT_PAGE_SIZES.map((n) => [n, href({ par: n === SUPPORT_PAGE_SIZES[0] ? undefined : n, page: 1 })]))} />
              </div>
            )}
          </div>
        </section>

        <aside className="space-y-6">
          <section className={card}>
            <h2 className="mb-3 flex items-center gap-2 text-base font-bold text-brand-dark"><Zap className="h-5 w-5 text-brand" aria-hidden /> Actions rapides</h2>
            <ul className="space-y-2 text-sm">
              <li><Link href="/admin/support/nouvelle" className="flex items-center gap-3 rounded-xl border border-line px-3 py-2.5 font-semibold text-brand-dark hover:bg-brand-soft"><Plus className="h-4 w-4 text-brand" aria-hidden /><span className="flex-1">Nouvelle demande</span><ChevronRight className="h-4 w-4" aria-hidden /></Link></li>
              {([[BookOpen, "Base de connaissances"], [FileText, "Modèles de réponses"], [Settings, "Paramètres du support"]] as const).map(([Icon, text]) => (
                <li key={text}><span aria-disabled="true" title="Bientôt disponible" className="flex cursor-not-allowed items-center gap-3 rounded-xl border border-line px-3 py-2.5 font-semibold text-brand-dark opacity-50"><Icon className="h-4 w-4 text-brand" aria-hidden /><span className="flex-1">{text}</span><span className="text-xs font-normal">Bientôt</span></span></li>
              ))}
            </ul>
          </section>

          <section className={card}>
            <h2 className="mb-3 flex items-center gap-2 text-base font-bold text-brand-dark"><PieChart className="h-5 w-5 text-brand" aria-hidden /> Tickets par catégorie</h2>
            {shares.length === 0 ? <p className="py-6 text-center text-sm text-muted">Aucun ticket pour le moment.</p> : <CategoryDonut items={shares} total={stats.total} />}
          </section>

          <section className={card}>
            <h2 className="mb-3 flex items-center gap-2 text-base font-bold text-brand-dark"><ShieldCheck className="h-5 w-5 text-brand" aria-hidden /> Respect du délai (SLA)</h2>
            {stats.sla === null ? <p className="text-sm text-muted">Aucun ticket résolu pour le moment.</p> : (
              <>
                <div className="flex items-end justify-between gap-3">
                  <p className="text-4xl font-extrabold text-success">{stats.sla} %</p>
                  {slaDiff !== null && slaDiff !== 0 && <span className={cn("inline-flex items-center gap-1 text-sm font-bold", slaDiff > 0 ? "text-success" : "text-danger")}>{slaDiff > 0 ? <ArrowUp className="h-4 w-4" aria-hidden /> : <ArrowDown className="h-4 w-4" aria-hidden />}{slaDiff > 0 ? "+" : "−"}{Math.abs(slaDiff)} pts</span>}
                </div>
                <p className="mt-1 text-sm text-brand-dark">Tickets résolus dans le délai</p>
                <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-line" role="progressbar" aria-valuenow={stats.sla} aria-valuemin={0} aria-valuemax={100} aria-label="Respect du délai"><div className="h-full rounded-full bg-success" style={{ width: `${stats.sla}%` }} /></div>
                <p className="mt-3 flex items-start gap-2 text-xs text-muted"><Headset className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />Délai visé : 8 h (haute), 24 h (moyenne), 72 h (basse), du dépôt à la résolution.</p>
              </>
            )}
          </section>
        </aside>
      </div>
    </div>
  );
}

export default function SupportPage({ searchParams }: { searchParams: SP }) {
  return (
    <Suspense fallback={<div className="h-96 animate-pulse rounded-2xl bg-white" aria-hidden />}>
      <Content searchParams={searchParams} />
    </Suspense>
  );
}
