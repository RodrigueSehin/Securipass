import { Suspense } from "react";
import Image from "next/image";
import Link from "next/link";
import { Archive, BarChart3, BookOpen, Check, ChevronLeft, ChevronRight, Copy, EllipsisVertical, FileText, Pencil, Search, Users } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { Alert, EmptyState, PageHeader, StatusBadge } from "@/components/ui/feedback";
import { KpiTile } from "@/components/instructor/dashboard-panels";
import { CourseSummary } from "@/components/instructor/course-summary";
import { archiveCourse, duplicateCourse } from "@/lib/courses/actions";
import { loadOwnCourseList } from "@/lib/courses/instructor-queries";
import { COURSE_TABS, countByTab, filterCourseRows, isCourseTab, paginate, type CourseListRow, type CourseTab } from "@/lib/courses/course-list";
import { COURSE_STATUS, LEVELS, MODES, type CourseStatus } from "@/lib/courses/labels";
import { formatShortDate } from "@/lib/format";
import { cn } from "@/lib/utils";

export const metadata = { title: "Mes formations" };

type SP = Promise<{ q?: string; statut?: string; page?: string; sel?: string; resultat?: string }>;

/** Adresse de la liste avec les filtres courants ; les paramètres vides sont omis. */
function listHref({ q, statut, page, sel }: { q?: string; statut?: CourseTab; page?: number; sel?: string }) {
  const p = new URLSearchParams();
  if (q) p.set("q", q);
  if (statut && statut !== "all") p.set("statut", statut);
  if (page && page > 1) p.set("page", String(page));
  if (sel) p.set("sel", sel);
  const s = p.toString();
  return `/formateur/formations${s ? `?${s}` : ""}`;
}

async function CourseList({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const { rows, totalLearners, failed } = await loadOwnCourseList();
  if (failed) return <Alert>Impossible de charger vos formations.</Alert>;

  const tab: CourseTab = isCourseTab(sp.statut) ? sp.statut : "all";
  const q = sp.q?.trim().slice(0, 100) ?? "";
  const counts = countByTab(rows);
  const filtered = filterCourseRows(rows, tab, q);
  const pg = paginate(filtered, Number(sp.page));
  const selected = filtered.find((r) => r.id === sp.sel) ?? pg.items[0] ?? null;
  const filtering = Boolean(q) || tab !== "all";

  return (
    <>
      {sp.resultat === "archivee" && <div className="mb-4"><Alert tone="success">Formation archivée.</Alert></div>}
      {sp.resultat === "erreur" && <div className="mb-4"><Alert>L’opération a échoué. Réessayez.</Alert></div>}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <KpiTile icon={BookOpen} value={counts.all} label="Formations" tone="bg-brand" />
        <KpiTile icon={Check} value={counts.published} label="Publiées" tone="bg-success" />
        <KpiTile icon={FileText} value={counts.draft} label="Brouillons" tone="bg-cta" />
        <KpiTile icon={Archive} value={counts.archived} label="Archivées" tone="bg-[#7c3aed]" />
        <KpiTile icon={Users} value={totalLearners} label="Apprenants" tone="bg-brand-dark" />
      </div>

      {rows.length === 0 ? (
        <div className="mt-6">
          <EmptyState title="Vous n’avez pas encore de formation">
            <div className="mt-3"><ButtonLink href="/formateur/formations/nouveau" variant="cta">Créer ma première formation</ButtonLink></div>
          </EmptyState>
        </div>
      ) : (
        <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
          <section className="min-w-0 overflow-hidden rounded-2xl border border-line bg-white">
            <nav aria-label="Filtrer par statut" className="flex gap-1 overflow-x-auto border-b border-line px-4">
              {COURSE_TABS.map((t) => (
                <Link key={t.key} href={listHref({ q, statut: t.key })} aria-current={t.key === tab ? "page" : undefined}
                  className={cn("-mb-px whitespace-nowrap border-b-2 px-3 py-3 text-sm font-semibold",
                    t.key === tab ? "border-brand text-brand" : "border-transparent text-muted hover:text-brand-dark")}>
                  {t.label} <span className="font-normal">({counts[t.key]})</span>
                </Link>
              ))}
            </nav>

            <form role="search" className="flex flex-wrap gap-2 p-4">
              {tab !== "all" && <input type="hidden" name="statut" value={tab} />}
              <div className="relative min-w-0 flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden />
                <input name="q" type="search" defaultValue={q} placeholder="Rechercher une formation…" aria-label="Rechercher une formation"
                  className="w-full rounded-lg border border-line bg-white py-2 pl-9 pr-3 text-sm" />
              </div>
              <button className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-dark">Rechercher</button>
            </form>

            {filtered.length === 0 ? (
              <div className="p-4">
                <EmptyState title="Aucune formation ne correspond">
                  {filtering && <Link href="/formateur/formations" className="font-semibold text-brand hover:underline">Réinitialiser les filtres</Link>}
                </EmptyState>
              </div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[56rem] text-left text-sm">
                    <thead className="bg-surface text-xs text-muted">
                      <tr>
                        <th scope="col" className="px-4 py-3 font-semibold">Formation</th>
                        <th scope="col" className="px-4 py-3 font-semibold">Catégorie</th>
                        <th scope="col" className="px-4 py-3 font-semibold">Apprenants</th>
                        <th scope="col" className="px-4 py-3 font-semibold">Progression moyenne</th>
                        <th scope="col" className="px-4 py-3 font-semibold">Statut</th>
                        <th scope="col" className="px-4 py-3 font-semibold">Date de création</th>
                        <th scope="col" className="px-4 py-3"><span className="sr-only">Actions</span></th>
                      </tr>
                    </thead>
                    <tbody>
                      {pg.items.map((r) => (
                        <CourseRow key={r.id} course={r} selected={r.id === selected?.id}
                          href={listHref({ q, statut: tab, page: pg.page, sel: r.id })} />
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line px-4 py-3 text-sm text-muted">
                  <p>Affichage de {pg.from} à {pg.to} sur {pg.total} formation{pg.total > 1 ? "s" : ""}</p>
                  {pg.pages > 1 && (
                    <nav aria-label="Pagination" className="flex items-center gap-1">
                      {pg.page > 1 ? (
                        <Link href={listHref({ q, statut: tab, page: pg.page - 1, sel: selected?.id })} aria-label="Page précédente" className="rounded-lg p-2 hover:bg-brand-soft"><ChevronLeft className="h-4 w-4" aria-hidden /></Link>
                      ) : (
                        <span aria-hidden className="p-2 opacity-40"><ChevronLeft className="h-4 w-4" /></span>
                      )}
                      {Array.from({ length: pg.pages }, (_, i) => i + 1).map((n) => (
                        <Link key={n} href={listHref({ q, statut: tab, page: n, sel: selected?.id })} aria-current={n === pg.page ? "page" : undefined}
                          className={cn("min-w-8 rounded-lg px-2.5 py-1.5 text-center font-semibold",
                            n === pg.page ? "bg-brand text-white" : "hover:bg-brand-soft hover:text-brand-dark")}>
                          {n}
                        </Link>
                      ))}
                      {pg.page < pg.pages ? (
                        <Link href={listHref({ q, statut: tab, page: pg.page + 1, sel: selected?.id })} aria-label="Page suivante" className="rounded-lg p-2 hover:bg-brand-soft"><ChevronRight className="h-4 w-4" aria-hidden /></Link>
                      ) : (
                        <span aria-hidden className="p-2 opacity-40"><ChevronRight className="h-4 w-4" /></span>
                      )}
                    </nav>
                  )}
                </div>
              </>
            )}
          </section>

          {selected && <CourseSummary course={selected} />}
        </div>
      )}
    </>
  );
}

function CourseRow({ course: r, selected, href }: { course: CourseListRow; selected: boolean; href: string }) {
  const status = COURSE_STATUS[r.status as CourseStatus];
  return (
    <tr className={cn("border-t border-line", selected && "bg-brand-soft/50")}>
      <td className="px-4 py-3">
        <div className="flex items-center gap-3">
          <span className="relative h-10 w-14 shrink-0 overflow-hidden rounded-lg bg-[linear-gradient(135deg,#092a66,#0639d9)]">
            {r.cover ? (
              <Image src={r.cover} alt="" fill sizes="56px" className="object-cover" unoptimized={r.cover.startsWith("http")} />
            ) : (
              <BookOpen className="absolute inset-0 m-auto h-5 w-5 text-white/80" aria-hidden />
            )}
          </span>
          <div className="min-w-0">
            <Link href={href} className="font-semibold text-brand-dark hover:text-brand hover:underline">{r.title}</Link>
            <p className="text-xs text-muted">{LEVELS[r.level]} · {MODES[r.mode]}</p>
          </div>
        </div>
      </td>
      <td className="px-4 py-3">
        {r.category ? <span className="rounded-md bg-brand-soft px-2 py-1 text-xs font-semibold text-brand">{r.category}</span> : <span className="text-muted">—</span>}
      </td>
      <td className="px-4 py-3 text-brand-dark">{r.learners}</td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="h-1.5 w-20 overflow-hidden rounded-full bg-surface" aria-hidden>
            <span className="block h-full rounded-full bg-brand" style={{ width: `${r.percent}%` }} />
          </span>
          <span className="text-xs font-semibold text-brand-dark">{r.percent} %</span>
        </div>
      </td>
      <td className="px-4 py-3"><StatusBadge tone={status.tone}>{status.label}</StatusBadge></td>
      <td className="px-4 py-3 text-muted">{formatShortDate(r.createdAt)}</td>
      <td className="px-4 py-3">
        <div className="flex items-center justify-end gap-2">
          <Link href={`/formateur/formations/${r.id}`} aria-label={`Modifier ${r.title}`} className="rounded-lg border border-brand p-2 text-brand hover:bg-brand-soft">
            <Pencil className="h-4 w-4" aria-hidden />
          </Link>
          <span title="Statistiques détaillées : bientôt disponibles" className="cursor-not-allowed rounded-lg border border-line p-2 text-muted opacity-50">
            <BarChart3 className="h-4 w-4" aria-hidden />
            <span className="sr-only">Statistiques, bientôt disponibles</span>
          </span>
          <details className="relative">
            <summary aria-label={`Autres actions pour ${r.title}`} className="flex cursor-pointer list-none rounded-lg p-2 text-muted hover:bg-surface">
              <EllipsisVertical className="h-4 w-4" aria-hidden />
            </summary>
            <div className="absolute right-0 z-10 mt-1 w-44 rounded-xl border border-line bg-white py-1 shadow-card">
              <form action={duplicateCourse}>
                <input type="hidden" name="courseId" value={r.id} />
                <button className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-brand-dark hover:bg-surface">
                  <Copy className="h-4 w-4" aria-hidden /> Dupliquer
                </button>
              </form>
              {r.status !== "archived" && (
                <form action={archiveCourse}>
                  <input type="hidden" name="courseId" value={r.id} />
                  <button className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-danger hover:bg-surface">
                    <Archive className="h-4 w-4" aria-hidden /> Archiver
                  </button>
                </form>
              )}
            </div>
          </details>
        </div>
      </td>
    </tr>
  );
}

function ListSkeleton() {
  return <div className="space-y-4" aria-hidden><div className="h-28 animate-pulse rounded-2xl bg-white" /><div className="h-96 animate-pulse rounded-2xl bg-white" /></div>;
}

export default function MyCoursesPage({ searchParams }: { searchParams: SP }) {
  return (
    <>
      <PageHeader
        title="Mes formations"
        description="Gérez, suivez et améliorez vos formations."
        actions={<ButtonLink href="/formateur/formations/nouveau" variant="cta">Créer une formation</ButtonLink>}
      />
      <Suspense fallback={<ListSkeleton />}>
        <CourseList searchParams={searchParams} />
      </Suspense>
    </>
  );
}
