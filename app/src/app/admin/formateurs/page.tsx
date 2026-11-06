import { Suspense } from "react";
import Link from "next/link";
import { ArrowDown, ArrowUp, ArrowUpDown, BookOpen, CheckCircle2, ChevronLeft, ChevronRight, Download, Hourglass, MoreHorizontal, Plus, Star, Users } from "lucide-react";
import { StatCard } from "@/components/admin/dashboard-widgets";
import { TrainersFilters } from "@/components/admin/trainers-toolbar";
import { UsersPageSize, UsersSelectAll } from "@/components/admin/users-toolbar";
import { Avatar } from "@/components/ui/avatar";
import { ButtonLink } from "@/components/ui/button";
import { Alert, EmptyState } from "@/components/ui/feedback";
import { percentChange } from "@/lib/admin/dashboard";
import { CONTRACTS, parseTrainerFilters, TRAINER_STATUS } from "@/lib/admin/trainers";
import { loadSpecialtyOptions, loadTrainers, loadTrainerStats } from "@/lib/admin/trainers-queries";
import { setTrainerContract } from "@/lib/admin/trainers-actions";
import { updateUserStatus } from "@/lib/admin/users-actions";
import { PAGE_SIZES, pageWindow } from "@/lib/admin/users";
import { cn } from "@/lib/utils";
import { AdminPageHeader } from "@/components/admin/admin-page-header";

export const metadata = { title: "Formateurs" };

const EXPORT_FORM = "trainers-export";
const nf = new Intl.NumberFormat("fr-FR");
const rf = new Intl.NumberFormat("fr-FR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const date = (iso: string) => new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "short", year: "numeric", timeZone: "Africa/Abidjan" }).format(new Date(iso));
const TONES = ["bg-brand-soft text-brand", "bg-success/15 text-success", "bg-cta/15 text-cta-dark", "bg-[#ede9fe] text-[#6d28d9]", "bg-danger/10 text-danger", "bg-[#ccfbf1] text-[#0f766e]"];

type SP = Promise<{ q?: string; specialite?: string; statut?: string; contrat?: string; tri?: string; page?: string; par?: string; resultat?: string; erreur?: string }>;

async function Content({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const filters = parseTrainerFilters(sp);
  const size = PAGE_SIZES.includes(Number(sp.par)) ? Number(sp.par) : PAGE_SIZES[0];
  const requested = Math.max(1, Math.floor(Number(sp.page)) || 1);
  const [stats, specialties, first] = await Promise.all([loadTrainerStats(), loadSpecialtyOptions(), loadTrainers(filters, size, (requested - 1) * size)]);
  if (first.failed) return <Alert>Impossible de charger les formateurs. Vérifiez que la migration 30 est appliquée, puis réessayez.</Alert>;

  const pages = Math.max(1, Math.ceil(first.total / size));
  const page = Math.min(requested, pages);
  const data = page === requested ? first : await loadTrainers(filters, size, (page - 1) * size);
  const from = data.total === 0 ? 0 : (page - 1) * size + 1;
  const to = Math.min(data.total, page * size);

  const href = (over: Record<string, string | number | undefined>) => {
    const u = new URLSearchParams();
    const cur: Record<string, string | number | undefined> = {
      q: filters.q, specialite: filters.category, statut: filters.status, contrat: filters.contract,
      tri: filters.sort === "recent" ? undefined : filters.sort, par: size === PAGE_SIZES[0] ? undefined : size, ...over,
    };
    for (const [k, v] of Object.entries(cur)) if (v !== undefined && v !== "" && v !== 1) u.set(k, String(v));
    return `/admin/formateurs${u.size ? `?${u}` : ""}`;
  };
  const here = href({ page: page === 1 ? undefined : page });
  const exportParams = Object.entries({ q: filters.q, specialite: filters.category, statut: filters.status, contrat: filters.contract, tri: filters.sort === "recent" ? "" : filters.sort }).filter(([, v]) => v);
  const ratingSort = filters.sort === "rating_desc" ? "rating_asc" : "rating_desc";

  const block = (b?: { count: number; month: number; prev: number }) =>
    b ? { value: nf.format(b.count), trend: percentChange(b.month, b.prev), note: b.month === 0 ? "Aucune variation" : `+ ${nf.format(b.month)} ce mois-ci` } : { value: "—", trend: null, note: "" };
  const th = "px-3 py-3 font-semibold";

  return (
    <div className="space-y-6">
      <AdminPageHeader crumbs={[{ label: "Formateurs" }]} icon="users" title="Formateurs" description="Gérez les formateurs de la plateforme SECURIPASS."
        actions={<>
          <div className="flex flex-wrap gap-2">
          <button type="submit" form={EXPORT_FORM} title="Exporte les lignes cochées, sinon le filtre courant" className="inline-flex items-center gap-2 rounded-lg border border-brand bg-white px-5 py-2.5 text-sm font-semibold text-brand hover:bg-brand-soft"><Download className="h-4 w-4" aria-hidden /> Exporter</button>
          <ButtonLink href="/admin/formateurs/nouveau"><Plus className="h-4 w-4" aria-hidden /> Ajouter un formateur</ButtonLink>
          </div>
        </>}
      />
      {sp.resultat === "contrat" && <Alert tone="success">Le type de contrat a été mis à jour.</Alert>}
      {sp.resultat === "suspendu" && <Alert tone="success">Le compte a été suspendu.</Alert>}
      {sp.resultat === "reactive" && <Alert tone="success">Le compte a été réactivé.</Alert>}
      {sp.erreur && <Alert>{sp.erreur}</Alert>}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <StatCard icon={Users} tone="blue" label="Total formateurs" {...block(stats?.total)} />
        <StatCard icon={CheckCircle2} tone="green" label="Formateurs actifs" {...block(stats?.active)} />
        <StatCard icon={Hourglass} tone="orange" label="Formateurs en mission" value={stats ? nf.format(stats.on_mission) : "—"} note="Session en cours" />
        <StatCard icon={BookOpen} tone="purple" label="Spécialités couvertes" value={stats ? nf.format(stats.specialties) : "—"} note="Domaines de formation" />
        <StatCard icon={Star} tone="slate" label="Note moyenne" value={stats?.rating_avg != null ? `${rf.format(stats.rating_avg)} / 5` : "—"} note={stats && stats.rating_count > 0 ? `Basée sur ${nf.format(stats.rating_count)} avis` : "Aucun avis"} />
      </div>

      <section className="rounded-2xl border border-line bg-white p-5 shadow-card">
        <TrainersFilters values={filters} specialties={specialties} hidden={{ ...(filters.sort !== "recent" ? { tri: filters.sort } : {}), ...(size !== PAGE_SIZES[0] ? { par: String(size) } : {}) }} />
        <form id={EXPORT_FORM} action="/admin/formateurs/export" method="get" className="hidden">
          {exportParams.map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
        </form>

        {data.total === 0 ? (
          <div className="mt-4"><EmptyState title="Aucun formateur ne correspond"><Link href="/admin/formateurs" className="font-semibold text-brand hover:underline">Réinitialiser les filtres</Link></EmptyState></div>
        ) : (
          <div className="mt-4 overflow-x-auto rounded-xl border border-line">
            <table className="w-full min-w-[64rem] text-left text-sm">
              <thead className="bg-surface text-xs text-brand-dark">
                <tr>
                  <th scope="col" className="w-10 px-3 py-3"><UsersSelectAll formId={EXPORT_FORM} /></th>
                  <th scope="col" className={th}>Formateur</th>
                  <th scope="col" className={th}>Spécialités</th>
                  <th scope="col" className={th}>Formations</th>
                  <th scope="col" className={th}>Apprenants</th>
                  <th scope="col" className={th} aria-sort={filters.sort === "rating_desc" ? "descending" : filters.sort === "rating_asc" ? "ascending" : "none"}>
                    <Link href={href({ tri: ratingSort, page: 1 })} className="inline-flex items-center gap-1 hover:text-brand">
                      Note {filters.sort === "rating_desc" ? <ArrowDown className="h-3 w-3" aria-hidden /> : filters.sort === "rating_asc" ? <ArrowUp className="h-3 w-3" aria-hidden /> : <ArrowUpDown className="h-3 w-3" aria-hidden />}
                    </Link>
                  </th>
                  <th scope="col" className={th}>Statut</th>
                  <th scope="col" className={th}>Type de contrat</th>
                  <th scope="col" className={th} aria-sort={filters.sort === "old" ? "ascending" : filters.sort === "recent" ? "descending" : "none"}>
                    <Link href={href({ tri: filters.sort === "recent" ? "old" : undefined, page: 1 })} className="inline-flex items-center gap-1 hover:text-brand">
                      Date d’ajout {filters.sort === "old" ? <ArrowUp className="h-3 w-3" aria-hidden /> : filters.sort === "recent" ? <ArrowDown className="h-3 w-3" aria-hidden /> : <ArrowUpDown className="h-3 w-3" aria-hidden />}
                    </Link>
                  </th>
                  <th scope="col" className={th}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {data.rows.map((t) => {
                  const st = TRAINER_STATUS[t.status] ?? TRAINER_STATUS.active;
                  const ct = CONTRACTS[t.contract_type] ?? CONTRACTS.external;
                  const name = t.full_name || t.email;
                  return (
                    <tr key={t.id} className="border-t border-line">
                      <td className="px-3 py-3"><input type="checkbox" name="id" value={t.id} form={EXPORT_FORM} aria-label={`Sélectionner ${name}`} className="h-4 w-4 rounded border-line" /></td>
                      <td className="px-3 py-3">
                        <div className="flex items-center gap-3">
                          <Avatar name={name} src={t.avatar_url} size={44} />
                          <div className="min-w-0">
                            <Link href={`/admin/utilisateurs/${t.id}`} className="font-bold text-brand-dark hover:text-brand hover:underline">{t.full_name || "Sans nom"}</Link>
                            <p className="truncate text-xs text-muted">{t.email}</p>
                            {t.phone && <p className="text-xs text-muted">{t.phone}</p>}
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-3">
                        {t.specialties.length === 0 ? <span className="text-muted">—</span> : (
                          <div className="flex max-w-60 flex-wrap gap-1.5">{t.specialties.map((s, i) => <span key={s} className={cn("rounded-md px-2.5 py-1 text-xs font-semibold", TONES[i % TONES.length])}>{s}</span>)}</div>
                        )}
                      </td>
                      <td className="px-3 py-3 text-brand-dark">{nf.format(t.courses)}</td>
                      <td className="px-3 py-3 text-brand-dark">{nf.format(t.learners)}</td>
                      <td className="whitespace-nowrap px-3 py-3 text-brand-dark">
                        {t.rating == null ? <span className="text-muted">—</span> : (
                          <><span className="inline-flex items-center gap-1 font-semibold"><Star className="h-3.5 w-3.5 fill-warning text-warning" aria-hidden />{rf.format(t.rating)}</span><span className="block text-xs text-muted">({nf.format(t.reviews)} avis)</span></>
                        )}
                      </td>
                      <td className="px-3 py-3"><span className={cn("rounded-md px-3 py-1 text-xs font-semibold", st.tone)}>{st.label}</span></td>
                      <td className="px-3 py-3"><span className={cn("rounded-md px-3 py-1 text-xs font-semibold", ct.tone)}>{ct.label}</span></td>
                      <td className="whitespace-nowrap px-3 py-3 text-xs text-brand-dark">{date(t.added_at)}</td>
                      <td className="px-3 py-3">
                        <details className="relative">
                          <summary aria-label={`Actions pour ${name}`} className="flex h-9 w-10 cursor-pointer list-none items-center justify-center rounded-lg border border-line text-brand-dark hover:bg-brand-soft [&::-webkit-details-marker]:hidden"><MoreHorizontal className="h-4 w-4" aria-hidden /></summary>
                          <div className="absolute right-0 z-10 mt-1 w-56 rounded-lg border border-line bg-white py-1 text-sm shadow-card">
                            <Link href={`/admin/utilisateurs/${t.id}`} className="block px-3 py-2 text-brand-dark hover:bg-brand-soft">Voir le compte</Link>
                            <form action={setTrainerContract}>
                              <input type="hidden" name="userId" value={t.id} />
                              <input type="hidden" name="contract" value={t.contract_type === "internal" ? "external" : "internal"} />
                              <input type="hidden" name="back" value={here} />
                              <button className="block w-full px-3 py-2 text-left text-brand-dark hover:bg-brand-soft">Passer en contrat {t.contract_type === "internal" ? "externe" : "interne"}</button>
                            </form>
                            {t.status !== "deletion_requested" && (
                              <form action={updateUserStatus}>
                                <input type="hidden" name="userId" value={t.id} />
                                <input type="hidden" name="status" value={t.status === "suspended" ? "active" : "suspended"} />
                                <input type="hidden" name="back" value={here} />
                                <button className={cn("block w-full px-3 py-2 text-left hover:bg-brand-soft", t.status === "suspended" ? "text-success" : "text-danger")}>{t.status === "suspended" ? "Réactiver le compte" : "Suspendre le compte"}</button>
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

        {data.total > 0 && (
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm text-brand-dark">
            <p>Affichage de {nf.format(from)} à {nf.format(to)} sur {nf.format(data.total)} formateur{data.total > 1 ? "s" : ""}</p>
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

export default function TrainersPage({ searchParams }: { searchParams: SP }) {
  return (
    <Suspense fallback={<div className="h-96 animate-pulse rounded-2xl bg-white" aria-hidden />}>
      <Content searchParams={searchParams} />
    </Suspense>
  );
}
