import { Suspense } from "react";
import Link from "next/link";
import { ArrowDown, ArrowUp, ChevronLeft, ChevronRight, Download, MoreHorizontal, Plus, ShieldCheck, Users, Briefcase, Building2, GraduationCap } from "lucide-react";
import { StatCard } from "@/components/admin/dashboard-widgets";
import { UsersFilters, UsersPageSize, UsersSelectAll } from "@/components/admin/users-toolbar";
import { Avatar } from "@/components/ui/avatar";
import { ButtonLink } from "@/components/ui/button";
import { Alert, EmptyState } from "@/components/ui/feedback";
import { percentChange } from "@/lib/admin/dashboard";
import { loadUsers, loadUserStats } from "@/lib/admin/users-queries";
import { updateUserStatus } from "@/lib/admin/users-actions";
import { PAGE_SIZES, pageWindow, parseUserFilters, ROLE_LABEL, ROLE_TONE, USER_STATUS } from "@/lib/admin/users";
import { cn } from "@/lib/utils";
import { AdminPageHeader } from "@/components/admin/admin-page-header";

export const metadata = { title: "Utilisateurs" };

const EXPORT_FORM = "users-export";
const nf = new Intl.NumberFormat("fr-FR");
const TZ = "Africa/Abidjan";
const date = (iso: string) => new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long", year: "numeric", timeZone: TZ }).format(new Date(iso));
const time = (iso: string) => new Intl.DateTimeFormat("fr-FR", { hour: "2-digit", minute: "2-digit", timeZone: TZ }).format(new Date(iso));

type SP = Promise<{ q?: string; role?: string; statut?: string; periode?: string; tri?: string; page?: string; par?: string; resultat?: string; erreur?: string }>;

const RESULTS: Record<string, string> = { suspendu: "Le compte a été suspendu.", reactive: "Le compte a été réactivé.", cree: "Le compte a été créé." };

async function Content({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const filters = parseUserFilters(sp);
  const size = PAGE_SIZES.includes(Number(sp.par)) ? Number(sp.par) : PAGE_SIZES[0];
  const requested = Math.max(1, Math.floor(Number(sp.page)) || 1);
  const [stats, first] = await Promise.all([loadUserStats(), loadUsers(filters, size, (requested - 1) * size)]);
  if (first.failed) return <Alert>Impossible de charger les utilisateurs. Vérifiez que la migration 28 est appliquée, puis réessayez.</Alert>;

  const pages = Math.max(1, Math.ceil(first.total / size));
  const page = Math.min(requested, pages);
  // Page demandée au-delà de la dernière : on relit la dernière page
  const data = page === requested ? first : await loadUsers(filters, size, (page - 1) * size);
  const from = data.total === 0 ? 0 : (page - 1) * size + 1;
  const to = Math.min(data.total, page * size);

  const href = (over: Record<string, string | number | undefined>) => {
    const u = new URLSearchParams();
    const cur: Record<string, string | number | undefined> = {
      q: filters.q, role: filters.role, statut: filters.status, periode: filters.period, tri: filters.asc ? "asc" : undefined,
      par: size === PAGE_SIZES[0] ? undefined : size, ...over,
    };
    for (const [k, v] of Object.entries(cur)) if (v !== undefined && v !== "" && v !== 1) u.set(k, String(v));
    return `/admin/utilisateurs${u.size ? `?${u}` : ""}`;
  };
  const here = href({ page: page === 1 ? undefined : page });
  const exportParams = Object.entries({ q: filters.q, role: filters.role, statut: filters.status, periode: filters.period, tri: filters.asc ? "asc" : "" }).filter(([, v]) => v);

  const card = (key: "total" | "learner" | "instructor" | "company" | "admin") => {
    const s = stats?.[key];
    return s ? { value: nf.format(s.count), trend: percentChange(s.month, s.prev), note: s.month === 0 ? "Aucune variation" : `+ ${nf.format(s.month)} ce mois-ci` } : { value: "—", trend: null, note: "" };
  };
  const th = "px-3 py-3 font-semibold";

  return (
    <div className="space-y-6">
      <AdminPageHeader crumbs={[{ label: "Utilisateurs" }]} icon="users" title="Utilisateurs" description="Gérez les utilisateurs de la plateforme SECURIPASS. Créez, modifiez et attribuez des rôles."
        actions={<>
          <ButtonLink href="/admin/utilisateurs/nouveau"><Plus className="h-4 w-4" aria-hidden /> Ajouter un utilisateur</ButtonLink>
        </>}
      />
      {sp.resultat && RESULTS[sp.resultat] && <Alert tone="success">{RESULTS[sp.resultat]}</Alert>}
      {sp.erreur && <Alert>{sp.erreur}</Alert>}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <StatCard icon={Users} tone="blue" label="Total utilisateurs" {...card("total")} />
        <StatCard icon={GraduationCap} tone="green" label="Apprenants" {...card("learner")} />
        <StatCard icon={Briefcase} tone="orange" label="Formateurs" {...card("instructor")} />
        <StatCard icon={Building2} tone="purple" label="Entreprises" {...card("company")} />
        <StatCard icon={ShieldCheck} tone="slate" label="Administrateurs" {...card("admin")} />
      </div>

      <section className="rounded-2xl border border-line bg-white p-5 shadow-card">
        <UsersFilters values={filters} hidden={{ ...(filters.asc ? { tri: "asc" } : {}), ...(size !== PAGE_SIZES[0] ? { par: String(size) } : {}) }} />
        <form id={EXPORT_FORM} action="/admin/utilisateurs/export" method="get" className="hidden">
          {exportParams.map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
        </form>

        {data.total === 0 ? (
          <div className="mt-4"><EmptyState title="Aucun utilisateur ne correspond"><Link href="/admin/utilisateurs" className="font-semibold text-brand hover:underline">Réinitialiser les filtres</Link></EmptyState></div>
        ) : (
          <div className="mt-4 overflow-x-auto rounded-xl border border-line">
            <table className="w-full min-w-[60rem] text-left text-sm">
              <thead className="bg-surface text-xs text-brand-dark">
                <tr>
                  <th scope="col" className="w-10 px-3 py-3"><UsersSelectAll formId={EXPORT_FORM} /></th>
                  <th scope="col" className={th}>Utilisateur</th>
                  <th scope="col" className={th}>Rôles</th>
                  <th scope="col" className={th}>Organisation</th>
                  <th scope="col" className={th} aria-sort={filters.asc ? "ascending" : "descending"}>
                    <Link href={href({ tri: filters.asc ? undefined : "asc", page: 1 })} className="inline-flex items-center gap-1 hover:text-brand">
                      Date d’inscription {filters.asc ? <ArrowUp className="h-3 w-3" aria-hidden /> : <ArrowDown className="h-3 w-3" aria-hidden />}
                    </Link>
                  </th>
                  <th scope="col" className={th}>Dernière connexion</th>
                  <th scope="col" className={th}>Statut</th>
                  <th scope="col" className={th}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {data.rows.map((u) => {
                  const st = USER_STATUS[u.status] ?? USER_STATUS.active;
                  return (
                    <tr key={u.id} className="border-t border-line">
                      <td className="px-3 py-3"><input type="checkbox" name="id" value={u.id} form={EXPORT_FORM} aria-label={`Sélectionner ${u.full_name || u.email}`} className="h-4 w-4 rounded border-line" /></td>
                      <td className="px-3 py-3">
                        <div className="flex items-center gap-3">
                          <Avatar name={u.full_name || u.email} src={u.avatar_url} size={44} />
                          <div className="min-w-0">
                            <Link href={`/admin/utilisateurs/${u.id}`} className="font-bold text-brand-dark hover:text-brand hover:underline">{u.full_name || "Sans nom"}</Link>
                            <p className="truncate text-xs text-muted">{u.email}</p>
                            {u.phone && <p className="text-xs text-muted">{u.phone}</p>}
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-3"><div className="flex flex-wrap gap-1.5">{u.roles.map((r) => <span key={r} className={cn("rounded-md px-2.5 py-1 text-xs font-semibold", ROLE_TONE[r] ?? "bg-surface text-brand-dark")}>{ROLE_LABEL[r] ?? r}</span>)}</div></td>
                      <td className="px-3 py-3 text-brand-dark">{u.organization ?? <span className="text-muted">—</span>}</td>
                      <td className="whitespace-nowrap px-3 py-3 text-xs text-brand-dark">{date(u.created_at)}<span className="block text-muted">{time(u.created_at)}</span></td>
                      <td className="whitespace-nowrap px-3 py-3 text-xs text-brand-dark">{u.last_sign_in_at ? <>{date(u.last_sign_in_at)}<span className="block text-muted">{time(u.last_sign_in_at)}</span></> : <span className="text-muted">Jamais</span>}</td>
                      <td className="px-3 py-3"><span className={cn("rounded-md px-3 py-1 text-xs font-semibold", st.tone)}>{st.label}</span></td>
                      <td className="px-3 py-3">
                        <details className="relative">
                          <summary aria-label={`Actions pour ${u.full_name || u.email}`} className="flex h-9 w-10 cursor-pointer list-none items-center justify-center rounded-lg border border-line text-brand-dark hover:bg-brand-soft [&::-webkit-details-marker]:hidden"><MoreHorizontal className="h-4 w-4" aria-hidden /></summary>
                          <div className="absolute right-0 z-10 mt-1 w-52 rounded-lg border border-line bg-white py-1 text-sm shadow-card">
                            <Link href={`/admin/utilisateurs/${u.id}`} className="block px-3 py-2 text-brand-dark hover:bg-brand-soft">Voir et modifier les rôles</Link>
                            {u.status !== "deletion_requested" && (
                              <form action={updateUserStatus}>
                                <input type="hidden" name="userId" value={u.id} />
                                <input type="hidden" name="status" value={u.status === "suspended" ? "active" : "suspended"} />
                                <input type="hidden" name="back" value={here} />
                                <button className={cn("block w-full px-3 py-2 text-left hover:bg-brand-soft", u.status === "suspended" ? "text-success" : "text-danger")}>{u.status === "suspended" ? "Réactiver le compte" : "Suspendre le compte"}</button>
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
            <p className="flex items-center gap-3">
              Affichage de {nf.format(from)} à {nf.format(to)} sur {nf.format(data.total)} utilisateur{data.total > 1 ? "s" : ""}
              <button type="submit" form={EXPORT_FORM} className="inline-flex items-center gap-1.5 rounded-lg border border-line px-2.5 py-1 text-xs font-semibold text-brand hover:bg-brand-soft" title="Exporte les lignes cochées, sinon le filtre courant"><Download className="h-3.5 w-3.5" aria-hidden /> Exporter (CSV)</button>
            </p>
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

export default function UsersPage({ searchParams }: { searchParams: SP }) {
  return (
    <Suspense fallback={<div className="h-96 animate-pulse rounded-2xl bg-white" aria-hidden />}>
      <Content searchParams={searchParams} />
    </Suspense>
  );
}
