import Link from "next/link";
import { ChevronLeft, ChevronRight, RefreshCw, Search } from "lucide-react";
import { AutoSubmitForm } from "@/components/catalogue/auto-submit-form";
import { CatalogueCard } from "@/components/catalogue/catalogue-card";
import { CategoryTabs } from "@/components/catalogue/category-tabs";
import { CustomOfferBanner } from "@/components/catalogue/custom-offer-banner";
import { FilterPanel } from "@/components/catalogue/filter-panel";
import { PriceRange } from "@/components/catalogue/price-range";
import { DemoNotice } from "@/components/ui/demo-notice";
import { Alert, EmptyState } from "@/components/ui/feedback";
import { categoryUi } from "@/content/categories";
import { applyFilters, facetCounts, pageWindow, paginate, sortCourses, type CatalogueCourse } from "@/lib/courses/catalogue";
import { DURATIONS, SORTS, parseCatalogueParams, type DurationKey, type RawParams } from "@/lib/courses/filters";
import { LEVELS, MODES, type Level, type Mode } from "@/lib/courses/labels";
import { getCategories, getOpenCourseIds, getPublishedCourses } from "@/lib/courses/queries";
import { getCoursePopularity } from "@/lib/courses/popularity";
import { cn } from "@/lib/utils";

const PAGE_SIZE = 8;

/** Reconstruit une URL du catalogue à partir des paramètres courants (valeurs multiples conservées). */
function buildHref(basePath: string, raw: RawParams, overrides: Record<string, string | string[] | undefined>): string {
  const p = new URLSearchParams();
  const merged: RawParams = { ...raw, ...overrides };
  for (const [k, v] of Object.entries(merged)) {
    for (const item of Array.isArray(v) ? v : v === undefined ? [] : [v]) if (item) p.append(k, item);
  }
  const s = p.toString();
  return s ? `${basePath}?${s}` : basePath;
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <fieldset>
      <legend className="mb-2.5 text-sm font-bold text-brand-dark">{title}</legend>
      <div className="space-y-2">{children}</div>
    </fieldset>
  );
}

function Check({ name, value, label, count, checked }: { name: string; value: string; label: string; count: number; checked: boolean }) {
  return (
    <label className={cn("flex cursor-pointer items-center gap-2.5 text-sm", count === 0 && !checked ? "text-muted/60" : "text-brand-dark")}>
      <input type="checkbox" name={name} value={value} defaultChecked={checked} className="h-4 w-4 rounded border-line accent-[var(--color-brand)]" />
      <span className="flex-1">{label}</span>
      <span className="text-xs text-muted">({count})</span>
    </label>
  );
}

type Props = {
  searchParams: Promise<RawParams>;
  /** Chemin du catalogue (public « /formations » ou espace apprenant « /app/catalogue »). */
  basePath: string;
  /** Formations déjà suivies par l'apprenant connecté : leur carte renvoie vers l'espace apprenant. */
  enrolledIds?: ReadonlySet<string>;
  /** Colonne latérale facultative (espace apprenant). */
  aside?: React.ReactNode;
};

/** Liste du catalogue : recherche, onglets, filtres, tri, cartes et pagination. Partagée par le public et l'espace apprenant. */
export async function CatalogueListing({ searchParams, basePath, enrolledIds, aside }: Props) {
  const raw = await searchParams;
  const f = parseCatalogueParams(raw);

  const [{ courses: all, failed }, categories, openIds, popularity] = await Promise.all([
    getPublishedCourses(),
    getCategories(),
    f.openOnly ? getOpenCourseIds() : Promise.resolve(new Set<string>()),
    f.sort === "populaires" ? getCoursePopularity() : Promise.resolve({} as Record<string, number>),
  ]);

  const list = all as unknown as (typeof all[number] & CatalogueCourse)[];
  const counts = facetCounts(list, f, f.openOnly ? openIds : undefined);
  const filtered = applyFilters(list, f, { openIds });
  const sorted = sortCourses(filtered, f.sort, new Map(Object.entries(popularity))) as typeof list;
  const pg = paginate(sorted, f.page, PAGE_SIZE);

  const maxPrice = all.reduce((m, c) => Math.max(m, c.price_amount), 0);
  const priceBound = maxPrice === 0 ? 0 : Math.max(50000, Math.ceil(maxPrice / 10000) * 10000);
  const activeCount = f.categories.length + f.modes.length + f.levels.length + f.durations.length
    + (f.priceMin !== undefined || f.priceMax !== undefined ? 1 : 0) + (f.openOnly ? 1 : 0);
  const hasFilters = activeCount > 0 || Boolean(f.q);
  const toTabs = (slug: string | null) => buildHref(basePath, raw, { categorie: slug ?? undefined, page: undefined });
  const pageHref = (n: number) => buildHref(basePath, raw, { page: n === 1 ? undefined : String(n) });
  const tabCategories = categories.map((c) => ({ slug: c.slug, name: c.name }));

  return (
    <AutoSubmitForm action={basePath} key={JSON.stringify(raw)}>
      <div className="mx-auto max-w-7xl px-4 py-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <CategoryTabs categories={tabCategories} selected={f.categories} hrefFor={toTabs} />
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-brand" aria-hidden />
              <input name="q" type="search" defaultValue={f.q} placeholder="Rechercher une formation…" aria-label="Rechercher une formation"
                className="w-64 rounded-xl border border-line bg-white py-2.5 pl-9 pr-3 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20" />
            </div>
            <label className="flex items-center gap-2 text-sm text-brand-dark">
              Trier par
              <select name="tri" defaultValue={f.sort} className="rounded-xl border border-line bg-white px-3 py-2.5 text-sm font-medium">
                {Object.entries(SORTS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </label>
          </div>
        </div>

        <div className={cn("mt-6 grid gap-6 lg:grid-cols-[16rem_1fr]", aside && "2xl:grid-cols-[16rem_1fr_17rem]")}>
          <FilterPanel activeCount={activeCount}>
            <Group title="Catégorie">
              {categories.map((c) => (
                <Check key={c.slug} name="categorie" value={c.slug} label={categoryUi(c.slug, c.name).label} count={counts.categories[c.slug] ?? 0} checked={f.categories.includes(c.slug)} />
              ))}
            </Group>
            <Group title="Type de formation">
              {(Object.keys(MODES) as Mode[]).map((m) => <Check key={m} name="format" value={m} label={MODES[m]} count={counts.modes[m] ?? 0} checked={f.modes.includes(m)} />)}
            </Group>
            <Group title="Niveau">
              {(Object.keys(LEVELS) as Level[]).map((l) => <Check key={l} name="niveau" value={l} label={LEVELS[l]} count={counts.levels[l] ?? 0} checked={f.levels.includes(l)} />)}
            </Group>
            <Group title="Durée">
              {(Object.keys(DURATIONS) as DurationKey[]).map((d) => <Check key={d} name="duree" value={d} label={DURATIONS[d].label} count={counts.durations[d] ?? 0} checked={f.durations.includes(d)} />)}
            </Group>
            {priceBound > 0 && (
              <Group title="Prix (FCFA)">
                <PriceRange bound={priceBound} initialMin={f.priceMin} initialMax={f.priceMax} />
              </Group>
            )}
            <Group title="Disponibilité">
              <label className="flex cursor-pointer items-center gap-2.5 text-sm text-brand-dark">
                <input type="checkbox" name="dispo" value="1" defaultChecked={f.openOnly} className="h-4 w-4 rounded border-line accent-[var(--color-brand)]" />
                Sessions avec places disponibles
              </label>
            </Group>
            <div className="flex flex-col gap-2">
              <button className="rounded-lg bg-brand px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-dark lg:hidden">Appliquer les filtres</button>
              <Link href={basePath} className="flex items-center justify-center gap-2 rounded-lg bg-brand-dark px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand">
                <RefreshCw className="h-4 w-4" aria-hidden />Réinitialiser les filtres
              </Link>
            </div>
          </FilterPanel>

          <div aria-live="polite">
            {failed ? (
              <Alert>Le catalogue est momentanément indisponible. Réessayez dans quelques instants.</Alert>
            ) : pg.total === 0 ? (
              <EmptyState title="Aucune formation trouvée">
                {hasFilters ? "Modifiez votre recherche ou réinitialisez les filtres." : "Les premières formations seront publiées prochainement."}
              </EmptyState>
            ) : (
              <>
                {pg.items.some((c) => c.is_demo) && <div className="mb-4"><DemoNotice /></div>}
                <p className="mb-4 font-bold text-brand-dark">
                  {pg.total} formation{pg.total > 1 ? "s" : ""} {hasFilters ? (pg.total > 1 ? "trouvées" : "trouvée") : (pg.total > 1 ? "disponibles" : "disponible")}
                </p>
                <ul className={cn("grid gap-5 sm:grid-cols-2", aside ? "xl:grid-cols-3" : "xl:grid-cols-4")}>
                  {pg.items.map((c, i) => (
                    <CatalogueCard
                      key={c.id}
                      course={c}
                      priority={i === 0}
                      enrolled={enrolledIds?.has(c.id)}
                      href={enrolledIds ? undefined : `${basePath}/${c.slug}`}
                    />
                  ))}
                </ul>
                {pg.pages > 1 && (
                  <nav aria-label="Pagination" className="mt-8 flex flex-wrap items-center justify-center gap-2 text-sm">
                    {pg.page > 1
                      ? <Link href={pageHref(pg.page - 1)} className="flex items-center gap-1 rounded-lg border border-line bg-white px-3 py-2 font-medium text-brand-dark hover:bg-brand-soft"><ChevronLeft className="h-4 w-4" aria-hidden />Précédent</Link>
                      : <span className="flex items-center gap-1 rounded-lg border border-line px-3 py-2 text-muted/60"><ChevronLeft className="h-4 w-4" aria-hidden />Précédent</span>}
                    {pageWindow(pg.page, pg.pages).map((n, i) => n === "…"
                      ? <span key={`e${i}`} className="px-1 text-muted">…</span>
                      : <Link key={n} href={pageHref(n)} aria-current={n === pg.page ? "page" : undefined}
                          className={cn("flex h-9 w-9 items-center justify-center rounded-lg border font-semibold", n === pg.page ? "border-brand bg-brand text-white" : "border-line bg-white text-brand-dark hover:bg-brand-soft")}>{n}</Link>)}
                    {pg.page < pg.pages
                      ? <Link href={pageHref(pg.page + 1)} className="flex items-center gap-1 rounded-lg border border-line bg-white px-3 py-2 font-medium text-brand-dark hover:bg-brand-soft">Suivant<ChevronRight className="h-4 w-4" aria-hidden /></Link>
                      : <span className="flex items-center gap-1 rounded-lg border border-line px-3 py-2 text-muted/60">Suivant<ChevronRight className="h-4 w-4" aria-hidden /></span>}
                  </nav>
                )}
              </>
            )}
            <CustomOfferBanner />
          </div>

          {aside && <div className="lg:col-span-2 2xl:col-span-1">{aside}</div>}
        </div>
      </div>
    </AutoSubmitForm>
  );
}
