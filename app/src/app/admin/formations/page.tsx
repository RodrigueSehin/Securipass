import { Suspense } from "react";
import Link from "next/link";
import Image from "next/image";
import { ArrowDown, ArrowUp, ArrowUpDown, Archive, Award, BookOpen, ChevronLeft, ChevronRight, Clock, Download, MoreHorizontal, PlayCircle, Plus, Star, Upload } from "lucide-react";
import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { CategoryBadge } from "@/components/admin/category-badge";
import { CoursesFilters } from "@/components/admin/courses-toolbar";
import { StatCard } from "@/components/admin/dashboard-widgets";
import { UsersPageSize, UsersSelectAll } from "@/components/admin/users-toolbar";
import { CourseStatusBadge } from "@/components/courses/course-status";
import { Avatar } from "@/components/ui/avatar";
import { Alert, EmptyState } from "@/components/ui/feedback";
import { percentChange } from "@/lib/admin/dashboard";
import { COURSE_PAGE_SIZES, MODE_TONE, formatHours, parseCourseFilters, publishedShare, successRate, type CourseFilters } from "@/lib/admin/courses";
import { loadCategoryOptions, loadCourseDetails, loadCourseStats, loadCourses, type CourseDetails } from "@/lib/admin/courses-queries";
import { pageWindow } from "@/lib/admin/users";
import { MODES } from "@/lib/courses/labels";
import { cn, formatFcfa } from "@/lib/utils";

export const metadata = { title: "Formations" };

const EXPORT_FORM = "courses-export";
const nf = new Intl.NumberFormat("fr-FR");
const rf = new Intl.NumberFormat("fr-FR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const date = (iso: string) => new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "short", year: "numeric", timeZone: "Africa/Abidjan" }).format(new Date(iso));

type SP = Promise<{ q?: string; statut?: string; categorie?: string; mode?: string; tri?: string; page?: string; par?: string }>;

const th = "px-3 py-3 font-semibold";

function SortHead({ label, active, dir, href }: { label: string; active: boolean; dir: "asc" | "desc"; href: string }) {
  const Icon = !active ? ArrowUpDown : dir === "asc" ? ArrowUp : ArrowDown;
  return (
    <Link href={href} className="inline-flex items-center gap-1 hover:text-brand">{label} <Icon className="h-3 w-3" aria-hidden /></Link>
  );
}

function Cover({ cover, icon, color }: { cover: string | null; icon: string; color: string }) {
  return cover
    ? <span className="relative h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-brand-soft"><Image src={cover} alt="" fill sizes="48px" className="object-cover" unoptimized /></span>
    : <CategoryBadge icon={icon} color={color} size={48} className="rounded-lg" />;
}

function Teachers({ name, avatar, others }: { name: string; avatar: string | null; others: { name: string; avatar_url: string | null }[] }) {
  const shown = others.slice(0, 2);
  const rest = others.length - shown.length;
  return (
    <div className="flex items-center">
      <Avatar name={name} src={avatar} size={32} className="ring-2 ring-white" />
      {shown.map((t, i) => <Avatar key={i} name={t.name} src={t.avatar_url} size={32} className="-ml-2 ring-2 ring-white" />)}
      {rest > 0 && <span className="ml-1 text-xs font-semibold text-muted">+{rest}</span>}
    </div>
  );
}

async function Content({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const filters: CourseFilters = parseCourseFilters(sp);
  const size = COURSE_PAGE_SIZES.includes(Number(sp.par)) ? Number(sp.par) : COURSE_PAGE_SIZES[0];
  const requested = Math.max(1, Math.floor(Number(sp.page)) || 1);
  const [stats, categories, first] = await Promise.all([loadCourseStats(), loadCategoryOptions(), loadCourses(filters, size, (requested - 1) * size)]);
  if (first.failed) return <Alert>Impossible de charger les formations. Réessayez dans quelques instants.</Alert>;

  const pages = Math.max(1, Math.ceil(first.total / size));
  const page = Math.min(requested, pages);
  const data = page === requested ? first : await loadCourses(filters, size, (page - 1) * size);
  const details: Map<string, CourseDetails> = await loadCourseDetails(data.rows.map((r) => r.id));
  const from = data.total === 0 ? 0 : (page - 1) * size + 1;
  const to = Math.min(data.total, page * size);

  const href = (over: Record<string, string | number | undefined>) => {
    const u = new URLSearchParams();
    const cur: Record<string, string | number | undefined> = {
      q: filters.q, statut: filters.status, categorie: filters.category, mode: filters.mode,
      tri: filters.sort === "recent" ? undefined : filters.sort, par: size === COURSE_PAGE_SIZES[0] ? undefined : size, ...over,
    };
    for (const [k, v] of Object.entries(cur)) if (v !== undefined && v !== "" && v !== 1) u.set(k, String(v));
    return `/admin/formations${u.size ? `?${u}` : ""}`;
  };
  const exportParams = Object.entries({ q: filters.q, statut: filters.status, categorie: filters.category, mode: filters.mode, tri: filters.sort === "recent" ? "" : filters.sort }).filter(([, v]) => v);

  const share = stats ? publishedShare(stats.published, stats.total) : null;
  const rate = stats ? successRate(stats.completed, stats.expired) : null;

  return (
    <div className="space-y-6">
      <AdminPageHeader crumbs={[{ label: "Formations" }]} icon="formation" title="Formations" description="Gérez l’ensemble des formations de la plateforme SECURIPASS."
        actions={<div className="flex flex-wrap gap-2">
          <button type="button" disabled title="Importation de formations : bientôt disponible" className="inline-flex cursor-not-allowed items-center gap-2 rounded-lg border border-brand bg-white px-5 py-2.5 text-sm font-semibold text-brand opacity-50"><Upload className="h-4 w-4" aria-hidden /> Importer</button>
          <button type="submit" form={EXPORT_FORM} title="Exporte les lignes cochées, sinon le filtre courant" className="inline-flex items-center gap-2 rounded-lg border border-brand bg-white px-5 py-2.5 text-sm font-semibold text-brand hover:bg-brand-soft"><Download className="h-4 w-4" aria-hidden /> Exporter</button>
          <button type="button" disabled title="Création depuis l’administration : bientôt disponible" className="inline-flex cursor-not-allowed items-center gap-2 rounded-lg bg-brand px-5 py-2.5 text-sm font-semibold text-white opacity-50"><Plus className="h-4 w-4" aria-hidden /> Ajouter une formation</button>
        </div>}
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <StatCard icon={BookOpen} tone="blue" label="Total formations" value={stats ? nf.format(stats.total) : "—"}
          trend={stats ? percentChange(stats.totalMonth, stats.totalPrev) : null} note={stats ? `+ ${nf.format(stats.totalMonth)} ce mois-ci` : ""} />
        <StatCard icon={PlayCircle} tone="green" label="Formations publiées" value={stats ? nf.format(stats.published) : "—"}
          trend={stats ? percentChange(stats.publishedMonth, stats.publishedPrev) : null} note={share === null ? "" : `${share} % du total`} />
        <StatCard icon={Clock} tone="orange" label="En cours" value={stats ? nf.format(stats.inProgress) : "—"}
          note={stats ? `${nf.format(stats.inProgressLearners)} apprenant${stats.inProgressLearners > 1 ? "s" : ""}` : ""} />
        <StatCard icon={Award} tone="purple" label="Terminées" value={stats ? nf.format(stats.finished) : "—"}
          note={rate === null ? "Aucune inscription close" : `Taux de réussite : ${rate} %`} />
        <StatCard icon={Archive} tone="slate" label="Brouillons" value={stats ? nf.format(stats.drafts) : "—"} note="Non publiées" />
      </div>

      <section className="rounded-2xl border border-line bg-white p-5 shadow-card">
        <CoursesFilters values={filters} categories={categories}
          hidden={{ ...(filters.sort !== "recent" ? { tri: filters.sort } : {}), ...(size !== COURSE_PAGE_SIZES[0] ? { par: String(size) } : {}) }} />
        <form id={EXPORT_FORM} action="/admin/formations/export" method="get" className="hidden">
          {exportParams.map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
        </form>

        {data.total === 0 ? (
          <div className="mt-4"><EmptyState title="Aucune formation ne correspond"><Link href="/admin/formations" className="font-semibold text-brand hover:underline">Réinitialiser les filtres</Link></EmptyState></div>
        ) : (
          <div className="mt-4 overflow-x-auto rounded-xl border border-line">
            <table className="w-full min-w-[78rem] text-left text-sm">
              <thead className="bg-surface text-xs text-brand-dark">
                <tr>
                  <th scope="col" className="w-10 px-3 py-3"><UsersSelectAll formId={EXPORT_FORM} /></th>
                  <th scope="col" className={th} aria-sort={filters.sort === "title" ? "ascending" : "none"}>
                    <SortHead label="Formation" active={filters.sort === "title"} dir="asc" href={href({ tri: filters.sort === "title" ? undefined : "title", page: 1 })} />
                  </th>
                  <th scope="col" className={th}>Catégorie</th>
                  <th scope="col" className={th}>Formateur(s)</th>
                  <th scope="col" className={th}>Mode</th>
                  <th scope="col" className={th} aria-sort={filters.sort === "duration" ? "descending" : "none"}>
                    <SortHead label="Durée" active={filters.sort === "duration"} dir="desc" href={href({ tri: filters.sort === "duration" ? undefined : "duration", page: 1 })} />
                  </th>
                  <th scope="col" className={th}>Prix</th>
                  <th scope="col" className={th}>Apprenants</th>
                  <th scope="col" className={th} aria-sort={filters.sort === "status" ? "ascending" : "none"}>
                    <SortHead label="Statut" active={filters.sort === "status"} dir="asc" href={href({ tri: filters.sort === "status" ? undefined : "status", page: 1 })} />
                  </th>
                  <th scope="col" className={th}>Note</th>
                  <th scope="col" className={th} aria-sort={filters.sort === "old" ? "ascending" : filters.sort === "recent" ? "descending" : "none"}>
                    <SortHead label="Date de création" active={filters.sort === "old" || filters.sort === "recent"} dir={filters.sort === "old" ? "asc" : "desc"}
                      href={href({ tri: filters.sort === "old" ? undefined : "old", page: 1 })} />
                  </th>
                  <th scope="col" className={th}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {data.rows.map((c) => {
                  const d = details.get(c.id);
                  const mode = MODES[c.delivery_mode] ? c.delivery_mode : "onsite";
                  const teachers = d?.coTrainers ?? [];
                  return (
                    <tr key={c.id} className="border-t border-line">
                      <td className="px-3 py-3"><input type="checkbox" name="id" value={c.id} form={EXPORT_FORM} aria-label={`Sélectionner ${c.title}`} className="h-4 w-4 rounded border-line" /></td>
                      <td className="px-3 py-3">
                        <div className="flex items-center gap-3">
                          <Cover cover={c.cover_url} icon={c.category?.icon ?? "folder"} color={c.category?.color ?? "blue"} />
                          <div className="min-w-0">
                            <Link href={`/admin/formations/${c.id}`} className="block font-bold text-brand-dark hover:text-brand hover:underline">{c.title}</Link>
                            {c.course_code && <p className="text-xs text-muted">{c.course_code}</p>}
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-3">{c.category ? <span className="rounded-md bg-surface px-2.5 py-1 text-xs font-semibold text-brand-dark">{c.category.name}</span> : <span className="text-muted">—</span>}</td>
                      <td className="px-3 py-3"><Teachers name={c.instructor?.full_name ?? "—"} avatar={c.instructor?.avatar_url ?? null} others={teachers} /></td>
                      <td className="px-3 py-3"><span className={cn("rounded-md px-2.5 py-1 text-xs font-semibold", MODE_TONE[mode])}>{MODES[mode]}</span></td>
                      <td className="whitespace-nowrap px-3 py-3 text-brand-dark">{formatHours(c.duration_minutes)}</td>
                      <td className="whitespace-nowrap px-3 py-3 font-bold text-brand-dark">{c.price_amount === 0 ? "Gratuit" : formatFcfa(c.price_amount)}</td>
                      <td className="px-3 py-3 text-brand-dark">{nf.format(d?.learners ?? 0)}</td>
                      <td className="px-3 py-3"><CourseStatusBadge status={c.status} /></td>
                      <td className="whitespace-nowrap px-3 py-3">
                        {d?.rating ? (
                          <div className="flex items-center gap-1 text-brand-dark"><Star className="h-4 w-4 fill-cta text-cta" aria-hidden /><span className="font-semibold">{rf.format(d.rating.avg)}</span><span className="text-xs text-muted">({nf.format(d.rating.count)})</span></div>
                        ) : <span className="text-muted">—</span>}
                      </td>
                      <td className="whitespace-nowrap px-3 py-3 text-xs text-brand-dark">{date(c.created_at)}</td>
                      <td className="px-3 py-3">
                        <details className="relative">
                          <summary aria-label={`Actions pour ${c.title}`} className="flex h-9 w-10 cursor-pointer list-none items-center justify-center rounded-lg border border-line text-brand-dark hover:bg-brand-soft [&::-webkit-details-marker]:hidden"><MoreHorizontal className="h-4 w-4" aria-hidden /></summary>
                          <div className="absolute right-0 z-10 mt-1 w-48 rounded-lg border border-line bg-white py-1 text-sm shadow-card">
                            <Link href={`/admin/formations/${c.id}`} className="block px-3 py-2 text-brand-dark hover:bg-brand-soft">Ouvrir la fiche</Link>
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
            <p>Affichage de {nf.format(from)} à {nf.format(to)} sur {nf.format(data.total)} formation{data.total > 1 ? "s" : ""}</p>
            <nav aria-label="Pagination" className="flex items-center gap-1">
              {page > 1 ? <Link href={href({ page: page - 1 })} aria-label="Page précédente" className="rounded-lg border border-line p-2 hover:bg-brand-soft"><ChevronLeft className="h-4 w-4" aria-hidden /></Link>
                : <span aria-hidden className="rounded-lg border border-line p-2 opacity-40"><ChevronLeft className="h-4 w-4" /></span>}
              {pageWindow(page, pages).map((n, i) => n === "…"
                ? <span key={`e${i}`} className="px-1 text-muted">…</span>
                : <Link key={n} href={href({ page: n })} aria-current={n === page ? "page" : undefined} className={cn("min-w-9 rounded-lg border px-2.5 py-2 text-center font-semibold", n === page ? "border-brand bg-brand text-white" : "border-line hover:bg-brand-soft")}>{n}</Link>)}
              {page < pages ? <Link href={href({ page: page + 1 })} aria-label="Page suivante" className="rounded-lg border border-line p-2 hover:bg-brand-soft"><ChevronRight className="h-4 w-4" aria-hidden /></Link>
                : <span aria-hidden className="rounded-lg border border-line p-2 opacity-40"><ChevronRight className="h-4 w-4" /></span>}
            </nav>
            <UsersPageSize value={size} options={COURSE_PAGE_SIZES} hrefs={Object.fromEntries(COURSE_PAGE_SIZES.map((n) => [n, href({ par: n === COURSE_PAGE_SIZES[0] ? undefined : n, page: 1 })]))} />
          </div>
        )}
      </section>
    </div>
  );
}

export default function AdminCoursesPage({ searchParams }: { searchParams: SP }) {
  return (
    <Suspense fallback={<div className="h-96 animate-pulse rounded-2xl bg-white" aria-hidden />}>
      <Content searchParams={searchParams} />
    </Suspense>
  );
}
