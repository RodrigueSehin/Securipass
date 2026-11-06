import { DURATIONS, type CatalogueFilters, type DurationKey, type Sort } from "./filters";
import type { Level, Mode } from "./labels";

/** Champs nécessaires au filtrage, au tri et aux compteurs (fonctions pures, sans accès base). */
export type CatalogueCourse = {
  id: string;
  title: string;
  description: string | null;
  category: { name: string; slug: string } | null;
  delivery_mode: Mode;
  level: Level;
  duration_minutes: number;
  price_amount: number;
  published_at: string | null;
  /** Mise en avant demandée par le formateur : en tête du tri par pertinence. */
  featured?: boolean;
};

export type Facet = "category" | "mode" | "level" | "duration";

const fold = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

export function durationKey(minutes: number): DurationKey {
  const hit = (Object.keys(DURATIONS) as DurationKey[]).find((k) => {
    const d: { min?: number; max?: number } = DURATIONS[k];
    return (d.min === undefined || minutes >= d.min) && (d.max === undefined || minutes <= d.max);
  });
  return hit ?? "d4";
}

/** `skip` ignore une facette : sert aux compteurs (le compteur d'une option ne dépend pas de sa propre facette). */
export function applyFilters(
  courses: CatalogueCourse[],
  f: CatalogueFilters,
  opts: { openIds?: Set<string>; skip?: Facet } = {},
): CatalogueCourse[] {
  const term = f.q ? fold(f.q) : null;
  return courses.filter((c) => {
    if (term && !fold(`${c.title} ${c.description ?? ""}`).includes(term)) return false;
    if (opts.skip !== "category" && f.categories.length && !(c.category && f.categories.includes(c.category.slug))) return false;
    if (opts.skip !== "mode" && f.modes.length && !f.modes.includes(c.delivery_mode)) return false;
    if (opts.skip !== "level" && f.levels.length && !f.levels.includes(c.level)) return false;
    if (opts.skip !== "duration" && f.durations.length && !f.durations.includes(durationKey(c.duration_minutes))) return false;
    if (f.priceMin !== undefined && c.price_amount < f.priceMin) return false;
    if (f.priceMax !== undefined && c.price_amount > f.priceMax) return false;
    if (f.openOnly && !opts.openIds?.has(c.id)) return false;
    return true;
  });
}

export type FacetCounts = {
  categories: Record<string, number>;
  modes: Partial<Record<Mode, number>>;
  levels: Partial<Record<Level, number>>;
  durations: Partial<Record<DurationKey, number>>;
};

export function facetCounts(courses: CatalogueCourse[], f: CatalogueFilters, openIds?: Set<string>): FacetCounts {
  const out: FacetCounts = { categories: {}, modes: {}, levels: {}, durations: {} };
  for (const c of applyFilters(courses, f, { openIds, skip: "category" })) {
    if (c.category) out.categories[c.category.slug] = (out.categories[c.category.slug] ?? 0) + 1;
  }
  for (const c of applyFilters(courses, f, { openIds, skip: "mode" })) out.modes[c.delivery_mode] = (out.modes[c.delivery_mode] ?? 0) + 1;
  for (const c of applyFilters(courses, f, { openIds, skip: "level" })) out.levels[c.level] = (out.levels[c.level] ?? 0) + 1;
  for (const c of applyFilters(courses, f, { openIds, skip: "duration" })) {
    const k = durationKey(c.duration_minutes);
    out.durations[k] = (out.durations[k] ?? 0) + 1;
  }
  return out;
}

export function sortCourses(courses: CatalogueCourse[], sort: Sort, popularity: Map<string, number>): CatalogueCourse[] {
  const byRecent = (a: CatalogueCourse, b: CatalogueCourse) => (b.published_at ?? "").localeCompare(a.published_at ?? "");
  const byTitle = (a: CatalogueCourse, b: CatalogueCourse) => a.title.localeCompare(b.title, "fr");
  const list = [...courses];
  switch (sort) {
    case "prix_asc": return list.sort((a, b) => a.price_amount - b.price_amount || byTitle(a, b));
    case "prix_desc": return list.sort((a, b) => b.price_amount - a.price_amount || byTitle(a, b));
    case "duree": return list.sort((a, b) => a.duration_minutes - b.duration_minutes || byTitle(a, b));
    case "nom": return list.sort(byTitle);
    case "recent": return list.sort((a, b) => byRecent(a, b) || byTitle(a, b));
    default: return list.sort((a, b) => Number(b.featured ?? false) - Number(a.featured ?? false) || (popularity.get(b.id) ?? 0) - (popularity.get(a.id) ?? 0) || byRecent(a, b) || byTitle(a, b));
  }
}

export function paginate<T>(items: T[], page: number, size: number): { items: T[]; total: number; pages: number; page: number } {
  const pages = Math.max(1, Math.ceil(items.length / size));
  const current = Math.min(Math.max(1, page), pages);
  return { items: items.slice((current - 1) * size, current * size), total: items.length, pages, page: current };
}

/** Pages à afficher : 1 … (courante ± 1) … dernière, comme sur la maquette (1 2 3 4 … 7). */
export function pageWindow(current: number, pages: number): (number | "…")[] {
  if (pages <= 7) return Array.from({ length: pages }, (_, i) => i + 1);
  const set = new Set<number>([1, 2, pages, pages - 1, current - 1, current, current + 1]);
  if (current <= 3) [1, 2, 3, 4].forEach((n) => set.add(n));
  const nums = [...set].filter((n) => n >= 1 && n <= pages).sort((a, b) => a - b);
  const out: (number | "…")[] = [];
  nums.forEach((n, i) => {
    if (i > 0 && n - nums[i - 1] > 1) out.push("…");
    out.push(n);
  });
  return out;
}
