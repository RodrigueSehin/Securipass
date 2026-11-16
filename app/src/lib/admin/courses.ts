import { COURSE_STATUS, MODES, type CourseStatus, type Mode } from "@/lib/courses/labels";

/** Catalogue des formations côté administration : filtres, tri, durée et export (pur : testé unitairement). */

export const COURSE_SORTS = {
  recent: "Date de création (récentes)",
  old: "Date de création (anciennes)",
  title: "Nom (A → Z)",
  duration: "Durée (la plus longue)",
  status: "Statut",
} as const;
export type CourseSort = keyof typeof COURSE_SORTS;

export const COURSE_PAGE_SIZES = [10, 20, 50, 100];

export type CourseFilters = { q: string; status: CourseStatus | ""; category: string; mode: Mode | ""; sort: CourseSort };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Valeurs de filtre acceptées (paramètres d'URL) : tout le reste est ignoré. */
export function parseCourseFilters(sp: { q?: string; statut?: string; categorie?: string; mode?: string; tri?: string }): CourseFilters {
  return {
    q: sp.q?.trim().slice(0, 100) ?? "",
    status: sp.statut && sp.statut in COURSE_STATUS ? (sp.statut as CourseStatus) : "",
    category: sp.categorie && UUID.test(sp.categorie) ? sp.categorie : "",
    mode: sp.mode && sp.mode in MODES ? (sp.mode as Mode) : "",
    sort: sp.tri && sp.tri in COURSE_SORTS ? (sp.tri as CourseSort) : "recent",
  };
}

/** Retire les caractères qui ont un sens dans les filtres PostgREST (`or`) ou dans LIKE. */
export function sanitizeSearch(q: string): string {
  return q.replace(/[,()%_*"\\]/g, " ").replace(/\s+/g, " ").trim();
}

/** Ordre SQL de chaque tri, avec un critère stable pour la pagination. */
export function courseOrder(sort: CourseSort): { column: string; ascending: boolean }[] {
  switch (sort) {
    case "old": return [{ column: "created_at", ascending: true }, { column: "id", ascending: true }];
    case "title": return [{ column: "title", ascending: true }, { column: "id", ascending: true }];
    case "duration": return [{ column: "duration_minutes", ascending: false }, { column: "id", ascending: true }];
    case "status": return [{ column: "status", ascending: true }, { column: "id", ascending: true }];
    default: return [{ column: "created_at", ascending: false }, { column: "id", ascending: true }];
  }
}

/** Durée affichée en heures : « 40h », « 8h30 », « 45 min ». */
export function formatHours(minutes: number): string {
  if (minutes <= 0) return "—";
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `${h}h` : `${h}h${String(m).padStart(2, "0")}`;
}

/** Taux de réussite : apprenants terminés parmi ceux dont l'inscription est close (terminée ou expirée). */
export function successRate(completed: number, expired: number): number | null {
  const closed = completed + expired;
  return closed > 0 ? Math.round((completed / closed) * 100) : null;
}

/** Pourcentage de formations publiées sur l'ensemble du catalogue. */
export function publishedShare(published: number, total: number): number | null {
  return total > 0 ? Math.round((published / total) * 100) : null;
}

export const MODE_TONE: Record<Mode, string> = {
  onsite: "bg-brand-soft text-brand",
  online: "bg-success/15 text-success",
  hybrid: "bg-[#ede9fe] text-[#6d28d9]",
};

/** Lignes du fichier CSV, dans l'ordre des colonnes affichées. */
export type CourseExportRow = {
  id: string; course_code: string | null; title: string; category: string | null; instructor: string | null; delivery_mode: Mode;
  duration_minutes: number; price_amount: number; status: CourseStatus; created_at: string;
};
export const COURSE_EXPORT_HEADERS = ["Code", "Formation", "Catégorie", "Formateur principal", "Mode", "Durée", "Prix (FCFA)", "Statut", "Date de création"];
export function courseExportCells(c: CourseExportRow, date: (iso: string) => string): (string | number)[] {
  return [
    c.course_code ?? "", c.title, c.category ?? "", c.instructor ?? "", MODES[c.delivery_mode] ?? c.delivery_mode,
    formatHours(c.duration_minutes), c.price_amount, COURSE_STATUS[c.status]?.label ?? c.status, date(c.created_at),
  ];
}
