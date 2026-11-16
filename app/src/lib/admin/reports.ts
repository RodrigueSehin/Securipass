import { monthLabel } from "./commissions";

/** Rapports d'administration : types, en-têtes CSV, période et répartition (pur : testé unitairement). */

export const REPORT_TYPES = {
  inscriptions: { label: "Inscriptions", description: "Détail des inscriptions et des sessions", tone: "bg-brand-soft text-brand",
    headers: ["Référence", "Apprenant", "E-mail", "Formation", "Session", "Statut", "Date d’inscription"] },
  formations: { label: "Formations", description: "Performances des formations", tone: "bg-[#ccfbf1] text-[#0f766e]",
    headers: ["Code", "Formation", "Catégorie", "Statut", "Inscriptions", "Terminées", "Note moyenne", "Prix (FCFA)"] },
  sessions: { label: "Sessions", description: "Statut et taux de remplissage", tone: "bg-cta/15 text-[#a16207]",
    headers: ["Session", "Formation", "Formateur", "Début", "Fin", "Places", "Inscrits", "Remplissage (%)", "Statut"] },
  apprenants: { label: "Apprenants", description: "Activité et progression des apprenants", tone: "bg-success/15 text-success",
    headers: ["Matricule", "Apprenant", "E-mail", "Inscriptions du mois", "Formations terminées", "Certificats valides"] },
  evaluations: { label: "Évaluations", description: "Résultats et taux de réussite", tone: "bg-[#ede9fe] text-[#6d28d9]",
    headers: ["Évaluation", "Formation", "Statut", "Résultats", "Réussites", "Taux de réussite (%)"] },
  certifications: { label: "Certifications", description: "Certificats délivrés par formation", tone: "bg-[#fef3c7] text-[#92400e]",
    headers: ["Numéro", "Apprenant", "Formation", "Délivré le", "Valide jusqu’au", "Statut"] },
  financier: { label: "Financier", description: "Paiements, commissions et versements", tone: "bg-success/15 text-success",
    headers: ["Référence", "Payeur", "Objet", "Montant (FCFA)", "Mode", "Statut", "Date"] },
  presences: { label: "Présences", description: "Taux de présence par session", tone: "bg-brand-soft text-brand",
    headers: ["Session", "Formation", "Date", "Inscrits", "Présents", "Absents", "Taux de présence (%)"] },
  activite: { label: "Activité de la plateforme", description: "Journal et actions des utilisateurs", tone: "bg-surface text-brand-dark",
    headers: ["Date", "Auteur", "Action", "Objet", "Identifiant"] },
} as const;
export type ReportType = keyof typeof REPORT_TYPES;
export const REPORT_TYPE_KEYS = Object.keys(REPORT_TYPES) as ReportType[];

export const isReportType = (v: string | null | undefined): v is ReportType => !!v && Object.hasOwn(REPORT_TYPES, v);

const MONTH = /^\d{4}-(0[1-9]|1[0-2])$/;

/** Mois demandé (AAAA-MM) ; le mois en cours si la valeur est absente ou invalide, ou si elle est dans le futur. */
export function parseMonth(v: string | null | undefined, now: Date = new Date()): string {
  const current = now.toISOString().slice(0, 7);
  return v && MONTH.test(v) && v <= current ? v : current;
}

/** Les 12 derniers mois, du plus récent au plus ancien. */
export function lastMonths(now: Date = new Date(), count = 12): string[] {
  const out: string[] = [];
  for (let i = 0; i < count; i++) out.push(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1)).toISOString().slice(0, 7));
  return out;
}

export const reportName = (type: ReportType, month: string) => `Rapport ${type === "activite" ? "d’activité" : `des ${REPORT_TYPES[type].label.toLowerCase()}`} – ${monthLabel(month)}`;
export const reportFile = (type: ReportType, month: string, ext = "csv") => `rapport-${type}-${month}.${ext}`;

export type ReportsOverview = {
  month: string;
  enrollments: { value: number; prev: number };
  active_learners: { value: number; prev: number };
  sessions: { value: number; prev: number };
  certifications: { value: number; prev: number };
  commissions: { value: number; prev: number; rate: number };
  revenue: number;
  evaluations: { results: number; passed: number };
  completion_rate: number | null;
  evaluation_success_rate: number | null;
  attendance_rate: number | null;
  months: { month: string; count: number }[];
  courses: { id: string; title: string; count: number }[];
  by_course: CourseBreakdown[];
};
export type CourseBreakdown = { id: string; title: string; count: number; sessions: number; completion: number | null; success: number | null };
export type ReportFormat = "pdf" | "xlsx" | "csv";
export type RecentReport = { id: string; type: ReportType; period: string; name: string; format: ReportFormat; row_count: number; generated_at: string; generated_by: string };

export const DONUT_COLORS = ["#2563eb", "#10a875", "#f59e0b", "#7c3aed", "#5fa8f5"] as const;

/** Part de chaque formation dans les inscriptions du mois : les quatre premières, puis « Autres formations ». */
export function courseShares(courses: { title: string; count: number }[], total: number): { label: string; count: number; percent: number }[] {
  if (total <= 0) return [];
  const top = courses.slice(0, 4);
  const others = Math.max(0, total - top.reduce((n, c) => n + c.count, 0));
  const items = [...top.map((c) => ({ label: c.title, count: c.count })), ...(others > 0 ? [{ label: "Autres formations", count: others }] : [])];
  return items.map((i) => ({ ...i, percent: Math.round((i.count / total) * 100) }));
}

/** Synthèse du mois en CSV (indicateur ; valeur), pour le bouton « Exporter ». */
export function overviewRows(o: ReportsOverview): [string, string | number][] {
  const pct = (v: number | null) => (v === null ? "—" : `${v} %`);
  return [
    ["Période", monthLabel(o.month, "long")],
    ["Inscriptions", o.enrollments.value], ["Apprenants actifs", o.active_learners.value], ["Sessions", o.sessions.value], ["Certifications délivrées", o.certifications.value],
    [`Commissions (${o.commissions.rate} %) en FCFA`, o.commissions.value], ["Chiffre d’affaires (FCFA)", o.revenue],
    ["Taux de complétion des formations", pct(o.completion_rate)], ["Taux de réussite aux évaluations", pct(o.evaluation_success_rate)], ["Taux de présence moyen", pct(o.attendance_rate)],
    ...o.courses.map((c, i): [string, number] => [`Top ${i + 1} : ${c.title} (inscriptions)`, c.count]),
  ];
}
