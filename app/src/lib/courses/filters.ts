import { LEVELS, MODES, type Level, type Mode } from "./labels";

export const SORTS = {
  populaires: "Plus populaires",
  recent: "Plus récentes",
  prix_asc: "Prix croissant",
  prix_desc: "Prix décroissant",
  duree: "Durée croissante",
  nom: "Nom (A–Z)",
} as const;
export type Sort = keyof typeof SORTS;

/** Tranches de durée en minutes (bornes incluses). */
export const DURATIONS = {
  d1: { label: "Moins de 10 heures", max: 599 },
  d2: { label: "10 à 30 heures", min: 600, max: 1800 },
  d3: { label: "30 à 60 heures", min: 1801, max: 3600 },
  d4: { label: "Plus de 60 heures", min: 3601 },
} as const satisfies Record<string, { label: string; min?: number; max?: number }>;
export type DurationKey = keyof typeof DURATIONS;

/** Paramètres d'URL bruts : une clé répétée donne un tableau. */
export type RawParams = Record<string, string | string[] | undefined>;

export type CatalogueFilters = {
  q?: string;
  categories: string[];
  levels: Level[];
  modes: Mode[];
  durations: DurationKey[];
  priceMin?: number;
  priceMax?: number;
  openOnly: boolean;
  sort: Sort;
  page: number;
};

const has = <T extends object>(obj: T, key: string | undefined): key is Extract<keyof T, string> =>
  key !== undefined && Object.prototype.hasOwnProperty.call(obj, key);

const many = (v: string | string[] | undefined): string[] => (v === undefined ? [] : Array.isArray(v) ? v : [v]);
const one = (v: string | string[] | undefined): string | undefined => (Array.isArray(v) ? v[0] : v);

function pick<T extends object>(values: string[], allowed: T): Extract<keyof T, string>[] {
  return [...new Set(values.filter((v): v is Extract<keyof T, string> => has(allowed, v)))];
}

function amount(v: string | string[] | undefined): number | undefined {
  const s = one(v)?.trim();
  if (!s || !/^\d{1,9}$/.test(s)) return undefined;
  return Number.parseInt(s, 10);
}

/** Convertit les paramètres d'URL en filtres sûrs : toute valeur inconnue ou mal formée est ignorée. */
export function parseCatalogueParams(raw: RawParams): CatalogueFilters {
  let priceMin = amount(raw.pmin);
  let priceMax = amount(raw.pmax);
  if (priceMin !== undefined && priceMax !== undefined && priceMin > priceMax) [priceMin, priceMax] = [priceMax, priceMin];
  const sortRaw = one(raw.tri);
  return {
    q: one(raw.q)?.trim().slice(0, 100) || undefined,
    categories: [...new Set(many(raw.categorie).filter((c) => /^[a-z0-9-]{1,80}$/.test(c)))],
    levels: pick(many(raw.niveau), LEVELS),
    modes: pick(many(raw.format), MODES),
    durations: pick(many(raw.duree), DURATIONS),
    priceMin,
    priceMax,
    openOnly: one(raw.dispo) === "1",
    sort: has(SORTS, sortRaw) ? sortRaw : "populaires",
    page: Math.max(1, Number.parseInt(one(raw.page) ?? "1", 10) || 1),
  };
}
