import type { Level, Mode, CourseStatus } from "./labels";

/** Règles de la liste « Mes formations » du formateur (pures : sans accès base, testées unitairement). */

export type CourseListRow = {
  id: string;
  title: string;
  slug: string;
  status: CourseStatus;
  cover: string | null;
  category: string | null;
  level: Level;
  mode: Mode;
  durationMinutes: number;
  priceAmount: number;
  createdAt: string;
  updatedAt: string;
  learners: number;
  /** Progression moyenne des apprenants actifs (0 à 100). */
  percent: number;
  modules: number;
  /** Leçons publiées. */
  lessons: number;
  /** Évaluations publiées. */
  quizzes: number;
  /** Taux de réussite des tentatives envoyées, null sans tentative. */
  success: number | null;
};

export const COURSE_TABS = [
  { key: "all", label: "Toutes" },
  { key: "published", label: "Publiées" },
  { key: "draft", label: "Brouillons" },
  { key: "in_review", label: "En révision" },
  { key: "archived", label: "Archivées" },
] as const;
export type CourseTab = (typeof COURSE_TABS)[number]["key"];

export const isCourseTab = (value: string | undefined): value is CourseTab =>
  COURSE_TABS.some((t) => t.key === value);

/** Filtre par onglet de statut, puis par titre (insensible à la casse et aux accents). */
export function filterCourseRows(rows: CourseListRow[], tab: CourseTab, query: string): CourseListRow[] {
  const q = normalize(query);
  return rows.filter((r) => (tab === "all" || r.status === tab) && (!q || normalize(r.title).includes(q)));
}

/** Compteurs des onglets, calculés sur la liste complète (indépendants de la recherche). */
export function countByTab(rows: CourseListRow[]): Record<CourseTab, number> {
  const count = (status: CourseStatus) => rows.filter((r) => r.status === status).length;
  return {
    all: rows.length,
    published: count("published"),
    draft: count("draft"),
    in_review: count("in_review"),
    archived: count("archived"),
  };
}

export const PAGE_SIZE = 10;

export function paginate<T>(items: T[], requested: number | undefined, size = PAGE_SIZE) {
  const pages = Math.max(1, Math.ceil(items.length / size));
  const page = Math.min(pages, Math.max(1, Math.floor(requested ?? 1) || 1));
  const start = (page - 1) * size;
  return {
    items: items.slice(start, start + size),
    page,
    pages,
    from: items.length === 0 ? 0 : start + 1,
    to: Math.min(items.length, start + size),
    total: items.length,
  };
}

function normalize(value: string): string {
  return value.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase().trim();
}
