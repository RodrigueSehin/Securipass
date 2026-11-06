/** Logique pure du tableau de bord « Mes sessions » : statut affiché, filtres, indicateurs, calendrier. */

export type DisplayStatus = "draft" | "planned" | "in_progress" | "completed" | "cancelled";

export const DISPLAY_STATUS: Record<DisplayStatus, { label: string; tone: "neutral" | "info" | "success" | "warning" | "danger"; color: string }> = {
  draft: { label: "Brouillon", tone: "neutral", color: "#94a3b8" },
  planned: { label: "Planifiée", tone: "info", color: "#0639d9" },
  in_progress: { label: "En cours", tone: "success", color: "#16a34a" },
  completed: { label: "Terminée", tone: "warning", color: "#f59e0b" },
  cancelled: { label: "Annulée", tone: "danger", color: "#ef4444" },
};

export type SessionLike = { status: "draft" | "scheduled" | "cancelled" | "completed"; start_at: string; end_at: string };

/** Statut affiché : « en cours » et « terminée » se déduisent des dates d'une session planifiée. */
export function displayStatus(s: SessionLike, now = Date.now()): DisplayStatus {
  if (s.status === "draft") return "draft";
  if (s.status === "cancelled") return "cancelled";
  if (s.status === "completed" || Date.parse(s.end_at) <= now) return "completed";
  if (Date.parse(s.start_at) <= now) return "in_progress";
  return "planned";
}

export type SessionFilters = { q?: string; course?: string; status?: string; date?: string };

export const DATE_FILTERS = [
  ["avenir", "À venir"], ["passees", "Passées"], ["mois", "Ce mois-ci"],
] as const;

const fold = (v: string) => v.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase().trim();

type Filterable = SessionLike & { title: string; reference: string; course_id: string; course?: { title: string } | null };

export function filterSessions<T extends Filterable>(rows: T[], f: SessionFilters, now = Date.now()): T[] {
  const q = fold(f.q ?? "");
  const month = new Date(now).toISOString().slice(0, 7);
  return rows.filter((s) => {
    if (f.course && s.course_id !== f.course) return false;
    if (f.status && displayStatus(s, now) !== f.status) return false;
    if (f.date === "avenir" && Date.parse(s.end_at) <= now) return false;
    if (f.date === "passees" && Date.parse(s.end_at) > now) return false;
    if (f.date === "mois" && s.start_at.slice(0, 7) !== month) return false;
    if (q && !fold(`${s.title} ${s.reference} ${s.course?.title ?? ""}`).includes(q)) return false;
    return true;
  });
}

export type Kpi = { key: "planned" | "in_progress" | "completed" | "cancelled"; value: number; trend: { text: string; up: boolean } | null };

const monthOf = (iso: string) => iso.slice(0, 7);
const shiftMonth = (ym: string, delta: number) => {
  const [y, m] = ym.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1 + delta, 1)).toISOString().slice(0, 7);
};

/** Totaux par statut, avec l'évolution du mois courant par rapport au mois précédent (pourcentage ou écart). */
export function computeKpis(rows: (SessionLike & { start_at: string })[], now = Date.now()): Kpi[] {
  const cur = new Date(now).toISOString().slice(0, 7);
  const prev = shiftMonth(cur, -1);
  const keys = ["planned", "in_progress", "completed", "cancelled"] as const;
  return keys.map((key) => {
    const mine = rows.filter((r) => displayStatus(r, now) === key);
    const a = mine.filter((r) => monthOf(r.start_at) === cur).length;
    const b = mine.filter((r) => monthOf(r.start_at) === prev).length;
    let trend: Kpi["trend"] = null;
    if (a !== b) {
      const usePercent = (key === "planned" || key === "completed") && b > 0;
      const text = usePercent ? `${a > b ? "+" : "−"}${Math.round((Math.abs(a - b) / b) * 100)}%` : `${a > b ? "+" : "−"}${Math.abs(a - b)}`;
      trend = { text, up: a > b };
    }
    return { key, value: mine.length, trend };
  });
}

/** Répartition par statut (les brouillons n'apparaissent que s'il y en a). */
export function distribution(rows: SessionLike[], now = Date.now()) {
  const order: DisplayStatus[] = ["in_progress", "planned", "completed", "cancelled", "draft"];
  const total = rows.length;
  return order
    .map((key) => ({ key, count: rows.filter((r) => displayStatus(r, now) === key).length }))
    .filter((d) => d.key !== "draft" || d.count > 0)
    .map((d) => ({ ...d, percent: total === 0 ? 0 : Math.round((d.count / total) * 100) }));
}

export type CalendarDay = { date: string; day: number; inMonth: boolean; today: boolean; statuses: DisplayStatus[] };

/** Grille du mois (lundi en premier), 5 ou 6 semaines. Les dates sont celles d'Abidjan (UTC+0). */
export function monthGrid(ym: string, rows: SessionLike[], now = Date.now()): CalendarDay[] {
  const [y, m] = ym.split("-").map(Number);
  const first = new Date(Date.UTC(y, m - 1, 1));
  const offset = (first.getUTCDay() + 6) % 7;
  const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const weeks = Math.ceil((offset + daysInMonth) / 7);
  const today = new Date(now).toISOString().slice(0, 10);
  const byDay = new Map<string, DisplayStatus[]>();
  for (const r of rows) {
    const d = r.start_at.slice(0, 10);
    byDay.set(d, [...(byDay.get(d) ?? []), displayStatus(r, now)]);
  }
  return Array.from({ length: weeks * 7 }, (_, i) => {
    const d = new Date(Date.UTC(y, m - 1, 1 - offset + i));
    const date = d.toISOString().slice(0, 10);
    return { date, day: d.getUTCDate(), inMonth: d.getUTCMonth() === m - 1, today: date === today, statuses: byDay.get(date) ?? [] };
  });
}

export const isMonth = (v?: string): v is string => !!v && /^\d{4}-(0[1-9]|1[0-2])$/.test(v);
export { shiftMonth };

export const MONTH_LABEL = (ym: string) => {
  const [y, m] = ym.split("-").map(Number);
  const s = new Intl.DateTimeFormat("fr-FR", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(Date.UTC(y, m - 1, 1)));
  return s.charAt(0).toUpperCase() + s.slice(1);
};

/** Ligne CSV (séparateur « ; », guillemets doublés) ; les cellules débutant par = + - @ sont neutralisées. */
export function csvLine(cells: (string | number)[]): string {
  return cells.map((c) => {
    let s = String(c);
    if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
    return `"${s.replace(/"/g, '""')}"`;
  }).join(";");
}
