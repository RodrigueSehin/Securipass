import { Suspense } from "react";
import Link from "next/link";
import { BookOpen, ChevronLeft, ChevronRight, CircleHelp, Copy, FileSearch, FileText, Pencil, Play, Search, Trash, Wrench } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { Alert, EmptyState, PageHeader, StatusBadge } from "@/components/ui/feedback";
import { ContentTypeBadge, ContentTypeChip } from "@/components/courses/content-type";
import { KpiTile } from "@/components/instructor/dashboard-panels";
import { ContentSummary } from "@/components/instructor/content-summary";
import { duplicateContent, deleteContent } from "@/lib/courses/actions";
import { loadContentLibrary } from "@/lib/courses/content-queries";
import { CONTENT_SORTS, countByType, filterContents, moduleLabel, relatedContents, type ContentFilters, type LibraryContent } from "@/lib/courses/content-library";
import { CONTENT_TYPES, type ContentType } from "@/lib/courses/labels";
import { paginate } from "@/lib/courses/course-list";
import { formatShortDate } from "@/lib/format";
import { cn, formatDuration } from "@/lib/utils";

export const metadata = { title: "Contenus pédagogiques" };

const PAGE_SIZE = 8;
const TYPES = Object.keys(CONTENT_TYPES) as ContentType[];

type SP = Promise<ContentFilters & { page?: string; sel?: string; resultat?: string }>;

/** Adresse de la bibliothèque avec les filtres courants ; les paramètres vides sont omis. */
function libHref(p: ContentFilters & { page?: number; sel?: string }) {
  const u = new URLSearchParams();
  const entries: [string, string | undefined][] = [
    ["q", p.q], ["type", p.type], ["course", p.course], ["module", p.module], ["sort", p.sort],
    ["page", p.page && p.page > 1 ? String(p.page) : undefined], ["sel", p.sel],
  ];
  for (const [k, v] of entries) if (v) u.set(k, v);
  const s = u.toString();
  return `/formateur/contenus${s ? `?${s}` : ""}`;
}

async function Library({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const lib = await loadContentLibrary();
  if (lib.failed) return <Alert>Impossible de charger vos contenus.</Alert>;

  const filters: ContentFilters = {
    q: sp.q?.trim().slice(0, 100) ?? "",
    type: sp.type,
    course: lib.courses.some((c) => c.id === sp.course) ? sp.course : undefined,
    module: lib.modules.some((m) => m.id === sp.module) ? sp.module : undefined,
    sort: sp.sort === "titre" ? "titre" : "date",
  };
  const counts = countByType(lib.rows);
  const filtered = filterContents(lib.rows, filters);
  const pg = paginate(filtered, Number(sp.page), PAGE_SIZE);
  const selected = filtered.find((r) => r.id === sp.sel) ?? pg.items[0] ?? null;
  const pageHref = (page: number) => libHref({ ...filters, page, sel: selected?.id });
  const selHref = (id: string) => libHref({ ...filters, page: pg.page, sel: id });

  return (
    <>
      {sp.resultat === "publie" && <div className="mb-4"><Alert tone="success">Le contenu a été publié.</Alert></div>}
      {sp.resultat === "erreur" && <div className="mb-4"><Alert>L’opération a échoué. Réessayez.</Alert></div>}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
        <KpiTile icon={BookOpen} value={lib.rows.length} label="Contenus" tone="bg-brand" />
        <KpiTile icon={Play} value={counts.video} label="Vidéos" tone="bg-[#7c3aed]" />
        <KpiTile icon={FileText} value={counts.pdf + counts.document} label="Documents" tone="bg-danger" />
        <KpiTile icon={CircleHelp} value={counts.quiz} label="Quiz" tone="bg-cta" />
        <KpiTile icon={FileSearch} value={counts.case_study} label="Études de cas" tone="bg-success" />
        <KpiTile icon={Wrench} value={counts.practice} label="Activités pratiques" tone="bg-warning" />
      </div>

      {lib.rows.length === 0 ? (
        <div className="mt-6">
          <EmptyState title="Aucun contenu pour le moment">
            <p className="mt-1">Ajoutez votre premier contenu pédagogique : document, vidéo, quiz, étude de cas ou activité pratique.</p>
            <div className="mt-3"><ButtonLink href="/formateur/contenus/nouveau" variant="cta">Ajouter un contenu</ButtonLink></div>
          </EmptyState>
        </div>
      ) : (
        <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
          <section className="min-w-0 overflow-hidden rounded-2xl border border-line bg-white">
            <form role="search" className="grid gap-2 border-b border-line p-4 sm:grid-cols-2 xl:grid-cols-[minmax(0,1.4fr)_repeat(4,minmax(0,1fr))_auto]">
              <div className="relative sm:col-span-2 xl:col-span-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden />
                <input name="q" type="search" defaultValue={filters.q} placeholder="Rechercher un contenu…" aria-label="Rechercher un contenu"
                  className="w-full rounded-lg border border-line bg-white py-2 pl-9 pr-3 text-sm" />
              </div>
              <select name="type" defaultValue={filters.type ?? ""} aria-label="Type" className="rounded-lg border border-line bg-white px-3 py-2 text-sm">
                <option value="">Tous les types</option>
                {TYPES.map((t) => <option key={t} value={t}>{CONTENT_TYPES[t]}</option>)}
              </select>
              <select name="course" defaultValue={filters.course ?? ""} aria-label="Formation" className="rounded-lg border border-line bg-white px-3 py-2 text-sm">
                <option value="">Toutes les formations</option>
                {lib.courses.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
              </select>
              <select name="module" defaultValue={filters.module ?? ""} aria-label="Module" className="rounded-lg border border-line bg-white px-3 py-2 text-sm">
                <option value="">Tous les modules</option>
                {lib.courses.map((c) => (
                  <optgroup key={c.id} label={c.title}>
                    {lib.modules.filter((m) => m.courseId === c.id).sort((a, b) => a.position - b.position).map((m) => (
                      <option key={m.id} value={m.id}>Module {m.position} · {m.title}</option>
                    ))}
                  </optgroup>
                ))}
              </select>
              <select name="sort" defaultValue={filters.sort} aria-label="Trier par" className="rounded-lg border border-line bg-white px-3 py-2 text-sm">
                {CONTENT_SORTS.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
              </select>
              <button className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-dark">Filtrer</button>
            </form>

            {filtered.length === 0 ? (
              <div className="p-4">
                <EmptyState title="Aucun contenu ne correspond">
                  <Link href="/formateur/contenus" className="font-semibold text-brand hover:underline">Réinitialiser les filtres</Link>
                </EmptyState>
              </div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[60rem] text-left text-sm">
                    <thead className="bg-surface text-xs text-muted">
                      <tr>
                        <th scope="col" className="px-4 py-3 font-semibold">Titre du contenu</th>
                        <th scope="col" className="px-4 py-3 font-semibold">Type</th>
                        <th scope="col" className="px-4 py-3 font-semibold">Formation</th>
                        <th scope="col" className="px-4 py-3 font-semibold">Module</th>
                        <th scope="col" className="px-4 py-3 font-semibold">Durée</th>
                        <th scope="col" className="px-4 py-3 font-semibold">Statut</th>
                        <th scope="col" className="px-4 py-3 font-semibold">Date de création</th>
                        <th scope="col" className="px-4 py-3"><span className="sr-only">Actions</span></th>
                      </tr>
                    </thead>
                    <tbody>
                      {pg.items.map((r) => (
                        <ContentRow key={r.id} content={r} selected={r.id === selected?.id} href={selHref(r.id)} />
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line px-4 py-3 text-sm text-muted">
                  <p>Affichage de {pg.from} à {pg.to} sur {pg.total} contenu{pg.total > 1 ? "s" : ""}</p>
                  {pg.pages > 1 && (
                    <nav aria-label="Pagination" className="flex items-center gap-1">
                      {pg.page > 1 ? (
                        <Link href={pageHref(pg.page - 1)} aria-label="Page précédente" className="rounded-lg p-2 hover:bg-brand-soft"><ChevronLeft className="h-4 w-4" aria-hidden /></Link>
                      ) : (
                        <span aria-hidden className="p-2 opacity-40"><ChevronLeft className="h-4 w-4" /></span>
                      )}
                      {Array.from({ length: pg.pages }, (_, i) => i + 1).map((n) => (
                        <Link key={n} href={pageHref(n)} aria-current={n === pg.page ? "page" : undefined}
                          className={cn("min-w-8 rounded-lg px-2.5 py-1.5 text-center font-semibold",
                            n === pg.page ? "bg-brand text-white" : "hover:bg-brand-soft hover:text-brand-dark")}>
                          {n}
                        </Link>
                      ))}
                      {pg.page < pg.pages ? (
                        <Link href={pageHref(pg.page + 1)} aria-label="Page suivante" className="rounded-lg p-2 hover:bg-brand-soft"><ChevronRight className="h-4 w-4" aria-hidden /></Link>
                      ) : (
                        <span aria-hidden className="p-2 opacity-40"><ChevronRight className="h-4 w-4" /></span>
                      )}
                    </nav>
                  )}
                </div>
              </>
            )}
          </section>

          {selected && (
            <ContentSummary
              content={selected}
              related={relatedContents(lib.rows, selected)}
              relatedHref={(id) => libHref({ ...filters, sel: id })}
            />
          )}
        </div>
      )}
    </>
  );
}

function ContentRow({ content: r, selected, href }: { content: LibraryContent; selected: boolean; href: string }) {
  return (
    <tr className={cn("border-t border-line", selected && "bg-brand-soft/50")}>
      <td className="px-4 py-3">
        <div className="flex items-center gap-3">
          <ContentTypeChip type={r.type} />
          <div className="min-w-0">
            <Link href={href} className="font-semibold text-brand-dark hover:text-brand hover:underline">{r.title}</Link>
            {r.description && <p className="max-w-xs truncate text-xs text-muted">{r.description}</p>}
          </div>
        </div>
      </td>
      <td className="px-4 py-3"><ContentTypeBadge type={r.type} /></td>
      <td className="px-4 py-3 text-brand-dark">{r.courseTitle}</td>
      <td className="px-4 py-3 text-muted">{moduleLabel(r)}</td>
      <td className="px-4 py-3 text-muted">{r.durationMinutes > 0 ? formatDuration(r.durationMinutes) : "—"}</td>
      <td className="px-4 py-3">
        <StatusBadge tone={r.status === "published" ? "success" : "warning"}>{r.status === "published" ? "Publié" : "Brouillon"}</StatusBadge>
      </td>
      <td className="px-4 py-3 text-muted">{formatShortDate(r.createdAt)}</td>
      <td className="px-4 py-3">
        <div className="flex items-center justify-end gap-2">
          <Link href={`/formateur/contenus/nouveau/${r.id}?etape=1`} aria-label={`Modifier ${r.title}`} className="rounded-lg border border-brand p-2 text-brand hover:bg-brand-soft">
            <Pencil className="h-4 w-4" aria-hidden />
          </Link>
          <form action={duplicateContent}>
            <input type="hidden" name="contentId" value={r.id} />
            <input type="hidden" name="courseId" value={r.courseId} />
            <button aria-label={`Dupliquer ${r.title}`} title="Dupliquer (copie en brouillon)" className="rounded-lg border border-line p-2 text-muted hover:border-brand hover:text-brand">
              <Copy className="h-4 w-4" aria-hidden />
            </button>
          </form>
          <details className="relative">
            <summary aria-label={`Supprimer ${r.title}`} title="Supprimer" className="flex cursor-pointer list-none rounded-lg border border-danger/40 p-2 text-danger hover:bg-danger/5">
              <Trash className="h-4 w-4" aria-hidden />
            </summary>
            <form action={deleteContent} className="absolute right-0 z-10 mt-1 w-56 rounded-xl border border-line bg-white p-3 shadow-card">
              <p className="text-sm text-brand-dark">Supprimer définitivement « {r.title} » ?</p>
              <input type="hidden" name="contentId" value={r.id} />
              <input type="hidden" name="courseId" value={r.courseId} />
              <button className="mt-3 w-full rounded-lg bg-danger px-3 py-1.5 text-sm font-semibold text-white hover:bg-danger/90">Confirmer la suppression</button>
            </form>
          </details>
        </div>
      </td>
    </tr>
  );
}

function ListSkeleton() {
  return <div className="space-y-4" aria-hidden><div className="h-28 animate-pulse rounded-2xl bg-white" /><div className="h-96 animate-pulse rounded-2xl bg-white" /></div>;
}

export default function ContentsPage({ searchParams }: { searchParams: SP }) {
  return (
    <>
      <PageHeader
        title="Contenus pédagogiques"
        description="Gérez l’ensemble de vos contenus : supports, vidéos, documents, activités pratiques."
        actions={<ButtonLink href="/formateur/contenus/nouveau" variant="cta">Ajouter un contenu</ButtonLink>}
      />
      <Suspense fallback={<ListSkeleton />}>
        <Library searchParams={searchParams} />
      </Suspense>
    </>
  );
}
