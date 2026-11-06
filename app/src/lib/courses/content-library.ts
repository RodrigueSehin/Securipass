import type { ContentType } from "./labels";

/** Règles de la bibliothèque « Contenus pédagogiques » du formateur (pures : sans accès base, testées unitairement). */

export type LibraryContent = {
  id: string;
  title: string;
  type: ContentType;
  description: string | null;
  durationMinutes: number;
  status: "draft" | "published";
  createdAt: string;
  updatedAt: string;
  position: number;
  moduleId: string;
  moduleTitle: string;
  modulePosition: number;
  courseId: string;
  courseTitle: string;
  /** Apprenants ayant terminé ce contenu. */
  completions: number;
};

export type ContentFilters = {
  q?: string;
  type?: string;
  course?: string;
  module?: string;
  sort?: string;
};

export const CONTENT_SORTS = [
  { key: "date", label: "Date de création" },
  { key: "titre", label: "Titre (A à Z)" },
] as const;

const isType = (value: string | undefined): value is ContentType =>
  ["document", "video", "quiz", "case_study", "practice", "pdf", "presentation", "link", "text"].includes(value ?? "");

/** Filtre par type, formation, module et texte du titre, puis trie (plus récent d'abord par défaut). */
export function filterContents(rows: LibraryContent[], f: ContentFilters): LibraryContent[] {
  const q = normalize(f.q ?? "");
  const type = isType(f.type) ? f.type : undefined;
  const filtered = rows.filter((r) =>
    (!type || r.type === type)
    && (!f.course || r.courseId === f.course)
    && (!f.module || r.moduleId === f.module)
    && (!q || normalize(r.title).includes(q)));
  if (f.sort === "titre") return filtered.sort((a, b) => a.title.localeCompare(b.title, "fr"));
  return filtered.sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
}

/** Compteurs par type, sur la bibliothèque complète. */
export function countByType(rows: LibraryContent[]): Record<ContentType, number> {
  const counts: Record<ContentType, number> = { document: 0, video: 0, quiz: 0, case_study: 0, practice: 0, pdf: 0, presentation: 0, link: 0, text: 0 };
  for (const r of rows) counts[r.type] += 1;
  return counts;
}

/** Autres contenus du même module, pour la colonne « Contenus liés ». */
export function relatedContents(rows: LibraryContent[], current: LibraryContent, limit = 3): LibraryContent[] {
  return rows
    .filter((r) => r.moduleId === current.moduleId && r.id !== current.id)
    .sort((a, b) => a.position - b.position)
    .slice(0, limit);
}

/** Libellé court du module : « Module 2 · Cadre légal ». */
export const moduleLabel = (c: Pick<LibraryContent, "modulePosition" | "moduleTitle">) => `Module ${c.modulePosition} · ${c.moduleTitle}`;

function normalize(value: string): string {
  return value.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase().trim();
}
