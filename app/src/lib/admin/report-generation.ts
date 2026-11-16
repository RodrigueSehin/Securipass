import { ENROLLMENT_STATUS } from "@/lib/courses/labels";
import { percentChange } from "./dashboard";
import { REPORT_TYPES, isReportType, parseMonth, reportName, type CourseBreakdown, type ReportFormat, type ReportType, type ReportsOverview } from "./reports";

/** Génération paramétrée d'un rapport : paramètres, indicateurs et totaux (pur : testé unitairement). */

export const REPORT_FORMATS = {
  pdf: { label: "PDF", ext: "pdf", mime: "application/pdf", tone: "bg-danger/10 text-danger" },
  xlsx: { label: "Excel", ext: "xlsx", mime: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", tone: "bg-success/15 text-success" },
  csv: { label: "CSV", ext: "csv", mime: "text/csv; charset=utf-8", tone: "bg-surface text-brand-dark" },
} as const satisfies Record<ReportFormat, { label: string; ext: string; mime: string; tone: string }>;
export const REPORT_FORMAT_KEYS = Object.keys(REPORT_FORMATS) as ReportFormat[];

export const INDICATORS = {
  inscriptions: "Nombre d’inscriptions", completion: "Taux de complétion", reussite: "Taux de réussite", presence: "Taux de présence",
  ca: "Chiffre d’affaires", commissions: "Commissions", evaluations: "Évaluations (résultats)", certifications: "Certifications", analyse: "Analyse et graphiques",
} as const;
export type IndicatorKey = keyof typeof INDICATORS;
export const INDICATOR_KEYS = Object.keys(INDICATORS) as IndicatorKey[];
export const DEFAULT_INDICATORS: IndicatorKey[] = ["inscriptions", "completion", "reussite", "presence"];

export type ReportFilters = { course: string; session: string; instructor: string; status: string };
export type ReportParams = {
  type: ReportType; month: string; filters: ReportFilters; indicators: IndicatorKey[]; format: ReportFormat; name: string; description: string;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const NAME_MAX = 200;
export const DESCRIPTION_MAX = 250;

export const isIndicator = (v: string): v is IndicatorKey => Object.hasOwn(INDICATORS, v);
export const isFormat = (v: string | null | undefined): v is ReportFormat => !!v && Object.hasOwn(REPORT_FORMATS, v);
const isStatus = (v: string | null | undefined): v is string => !!v && Object.hasOwn(ENROLLMENT_STATUS, v);

/**
 * Paramètres lus dans une adresse (formulaire du générateur, téléchargement, aperçu). Tout ce qui est inconnu est ignoré.
 * Sans champ `f` (formulaire jamais envoyé), les indicateurs par défaut s'appliquent ; avec `f`, seuls les indicateurs cochés comptent.
 */
export function parseReportParams(p: URLSearchParams, now: Date = new Date()): ReportParams {
  const typeRaw = p.get("type");
  const type: ReportType = isReportType(typeRaw) ? typeRaw : "inscriptions";
  const month = parseMonth(p.get("mois"), now);
  const uuid = (k: string) => { const v = p.get(k) ?? ""; return UUID.test(v) ? v : ""; };
  const picked = p.getAll("ind").filter(isIndicator);
  const indicators = p.has("f") ? INDICATOR_KEYS.filter((k) => picked.includes(k)) : DEFAULT_INDICATORS;
  const formatRaw = p.get("format");
  const name = (p.get("nom") ?? "").trim().slice(0, NAME_MAX);
  const statusRaw = p.get("statut");
  return {
    type, month,
    filters: { course: uuid("formation"), session: uuid("session"), instructor: uuid("formateur"), status: isStatus(statusRaw) ? statusRaw : "" },
    indicators, format: isFormat(formatRaw) ? formatRaw : "pdf",
    name: name.length >= 3 ? name : reportName(type, month),
    description: (p.get("description") ?? "").trim().slice(0, DESCRIPTION_MAX),
  };
}

/** Paramètres enregistrés avec un rapport généré (colonne `params`), relus pour le régénérer à l'identique. */
export function storedParams(params: ReportParams): { filters: ReportFilters; indicators: IndicatorKey[] } {
  return { filters: params.filters, indicators: params.indicators };
}
export function paramsFromRun(run: { type: string; period: string; name: string; format: string; description: string | null; params: unknown }): ReportParams | null {
  if (!isReportType(run.type) || !isFormat(run.format)) return null;
  const raw = (run.params ?? {}) as { filters?: Partial<ReportFilters>; indicators?: unknown };
  const f = raw.filters ?? {};
  const id = (v: unknown) => (typeof v === "string" && UUID.test(v) ? v : "");
  const indicators = Array.isArray(raw.indicators) ? raw.indicators.filter((v): v is IndicatorKey => typeof v === "string" && isIndicator(v)) : DEFAULT_INDICATORS;
  return {
    type: run.type, month: parseMonth(run.period), format: run.format, name: run.name, description: run.description ?? "", indicators,
    filters: { course: id(f.course), session: id(f.session), instructor: id(f.instructor), status: isStatus(f.status) ? f.status : "" },
  };
}

const dayFmt = (d: Date) => new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" }).format(d);
/** « 01 oct. 2026 – 31 oct. 2026 » pour un mois AAAA-MM. */
export function periodLabel(month: string): string {
  const [y, m] = month.split("-").map(Number);
  if (!y || !m) return month;
  return `${dayFmt(new Date(Date.UTC(y, m - 1, 1)))} – ${dayFmt(new Date(Date.UTC(y, m, 0)))}`;
}

export type IndicatorTile = { key: Exclude<IndicatorKey, "analyse">; label: string; value: string; trend: string | null };
const nfRaw = new Intl.NumberFormat("fr-FR");
/** Séparateur de milliers : une espace ordinaire (l'espace insécable fine de fr-FR s'affiche mal dans les fichiers). */
const nf = { format: (n: number) => nfRaw.format(n).replace(/[  ]/g, " ") };
const fcfa = (n: number) => `${nf.format(n)} FCFA`;
const pct = (v: number | null) => (v === null ? "—" : `${v} %`);
const trendOf = (b: { value: number; prev: number }) => { const t = percentChange(b.value, b.prev); return t ? `${t.up ? "↑" : "↓"} ${t.text.slice(1)}` : null; };

/** Indicateurs cochés avec leur valeur du mois et, quand il y en a une, leur évolution (le graphique « analyse » n'est pas un indicateur). */
export function indicatorTiles(o: ReportsOverview, keys: IndicatorKey[]): IndicatorTile[] {
  const make: Record<IndicatorTile["key"], () => { value: string; trend: string | null }> = {
    inscriptions: () => ({ value: nf.format(o.enrollments.value), trend: trendOf(o.enrollments) }),
    completion: () => ({ value: pct(o.completion_rate), trend: null }),
    reussite: () => ({ value: pct(o.evaluation_success_rate), trend: null }),
    presence: () => ({ value: pct(o.attendance_rate), trend: null }),
    ca: () => ({ value: fcfa(o.revenue), trend: null }),
    commissions: () => ({ value: fcfa(o.commissions.value), trend: trendOf(o.commissions) }),
    evaluations: () => ({ value: `${nf.format(o.evaluations.passed)} / ${nf.format(o.evaluations.results)}`, trend: null }),
    certifications: () => ({ value: nf.format(o.certifications.value), trend: trendOf(o.certifications) }),
  };
  return keys.filter((k): k is IndicatorTile["key"] => k !== "analyse").map((k) => ({ key: k, label: INDICATORS[k], ...make[k]() }));
}

/** Total de la table « par formation » : inscriptions et sessions additionnées ; taux moyens pondérés par les inscriptions. */
export function breakdownTotals(rows: CourseBreakdown[]): { sessions: number; count: number; completion: number | null; success: number | null } {
  const weighted = (pick: (r: CourseBreakdown) => number | null) => {
    const w = rows.filter((r) => pick(r) !== null && r.count > 0);
    const base = w.reduce((n, r) => n + r.count, 0);
    return base === 0 ? null : Math.round(w.reduce((n, r) => n + (pick(r) as number) * r.count, 0) / base);
  };
  return { sessions: rows.reduce((n, r) => n + r.sessions, 0), count: rows.reduce((n, r) => n + r.count, 0), completion: weighted((r) => r.completion), success: weighted((r) => r.success) };
}

/** Nom de fichier : sans accents ni caractères spéciaux. */
export function fileSlug(name: string, fallback = "rapport"): string {
  const s = name.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80);
  return s || fallback;
}

/** Tout ce qu'il faut pour écrire un rapport dans un fichier. */
export type ReportDocument = { params: ReportParams; overview: ReportsOverview; table: ReportTable; generatedAt: Date; generatedBy: string };

/** Les rapports « par formation » ajoutent le détail des inscriptions, sessions et taux de chaque formation. */
export const hasCourseBreakdown = (type: ReportType) => type === "inscriptions" || type === "formations";

/** Table de détail : en-têtes du type de rapport et lignes. */
export type ReportTable = { headers: string[]; rows: (string | number)[][] };
export const tableOf = (type: ReportType, rows: (string | number)[][]): ReportTable => ({ headers: [...REPORT_TYPES[type].headers], rows });
