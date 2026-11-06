/** Calculs purs du tableau de bord d'administration (testés unitairement). */

export type Trend = { text: string; up: boolean };

/** Évolution en pourcentage entre deux mois ; null sans base de comparaison ou sans variation. */
export function percentChange(current: number, previous: number): Trend | null {
  if (previous <= 0 || current === previous) return null;
  const p = Math.round((Math.abs(current - previous) / previous) * 100);
  return { text: `${current > previous ? "+" : "−"}${p}%`, up: current > previous };
}

const MONTHS = ["Jan", "Fév", "Mar", "Avr", "Mai", "Juin", "Juil", "Août", "Sep", "Oct", "Nov", "Déc"];

/** Étiquettes des 12 derniers mois, le mois courant en dernier (heure d'Abidjan = UTC). */
export function monthLabels(now: number, count = 12): string[] {
  const d = new Date(now);
  return Array.from({ length: count }, (_, i) => MONTHS[(((d.getUTCMonth() - (count - 1 - i)) % 12) + 12) % 12]);
}

/** Tracé SVG d'une courbe : points `x,y` dans une boîte `w` × `h` avec une marge verticale. */
export function sparkPoints(values: number[], w: number, h: number, pad = 3): [number, number][] {
  if (values.length === 0) return [];
  const max = Math.max(...values);
  const min = Math.min(...values);
  const span = max - min || 1;
  return values.map((v, i) => [
    values.length === 1 ? w / 2 : (i / (values.length - 1)) * w,
    max === min ? h / 2 : pad + (1 - (v - min) / span) * (h - 2 * pad),
  ]);
}

export const linePath = (pts: [number, number][]) => pts.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");

/** Pas « rond » (1, 2, 5 × 10ⁿ) pour une échelle d'environ 4 graduations. */
export function niceScale(max: number): { step: number; top: number } {
  const raw = Math.max(4, max) / 4;
  const pow = 10 ** Math.floor(Math.log10(raw));
  const n = raw / pow;
  const step = (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * pow;
  return { step, top: Math.max(step, Math.ceil(max / step) * step) };
}

export type RoleKey = "learner" | "instructor" | "company" | "admin" | "other";
export const ROLE_META: Record<RoleKey, { label: string; color: string }> = {
  learner: { label: "Apprenants", color: "#2563eb" },
  instructor: { label: "Formateurs", color: "#10a875" },
  company: { label: "Entreprises", color: "#f59e0b" },
  admin: { label: "Administrateurs", color: "#8b5cf6" },
  other: { label: "Autres", color: "#9ca3af" },
};

export function roleShares(roles: Partial<Record<RoleKey, number>>) {
  const total = (Object.keys(ROLE_META) as RoleKey[]).reduce((n, k) => n + (roles[k] ?? 0), 0);
  return (Object.keys(ROLE_META) as RoleKey[]).map((key) => ({
    key, count: roles[key] ?? 0, percent: total === 0 ? 0 : Math.round(((roles[key] ?? 0) / total) * 100),
  }));
}

export type ActivityKind = "Inscription" | "Formation" | "Certification" | "Utilisateur";
export type Activity = { id: string; name: string; role: string; avatar: string | null; kind: ActivityKind; detail: string; at: string };

/** Fusionne les événements récents de toutes provenances, du plus récent au plus ancien. */
export function mergeActivity(lists: Activity[][], limit = 5): Activity[] {
  return lists.flat().sort((a, b) => b.at.localeCompare(a.at)).slice(0, limit);
}

export type Alert = { key: string; tone: "warning" | "info" | "danger" | "success" | "brand"; title: string; text: string; at: string | null };

const plural = (n: number, one: string, many: string) => `${n} ${n > 1 ? many : one}`;

/** Points d'attention affichés à droite ; seuls ceux qui concernent au moins un élément sont retournés. */
export function buildAlerts(d: {
  inReview: number; inReviewAt: string | null; pendingPayment: number; pendingPaymentAt: string | null; supportNew: number; supportNewAt: string | null;
  expiring: number; expiringAt: string | null; newUsers: number; newUsersAt: string | null;
}): Alert[] {
  const out: Alert[] = [];
  if (d.inReview > 0) out.push({ key: "review", tone: "warning", title: "Formation en attente de validation", text: `${plural(d.inReview, "nouvelle formation soumise", "nouvelles formations soumises")} par un formateur.`, at: d.inReviewAt });
  if (d.pendingPayment > 0) out.push({ key: "payment", tone: "info", title: "Paiement en attente", text: `${plural(d.pendingPayment, "inscription", "inscriptions")} en attente de paiement.`, at: d.pendingPaymentAt });
  if (d.supportNew > 0) out.push({ key: "support", tone: "danger", title: "Demande de support", text: `${plural(d.supportNew, "nouvelle demande", "nouvelles demandes")} en attente de traitement.`, at: d.supportNewAt });
  if (d.expiring > 0) out.push({ key: "certs", tone: "success", title: "Certificats à renouveler", text: `${plural(d.expiring, "certificat expire", "certificats expirent")} dans les 30 prochains jours.`, at: d.expiringAt });
  if (d.newUsers > 0) out.push({ key: "users", tone: "brand", title: "Nouvel utilisateur", text: `${plural(d.newUsers, "nouveau compte créé", "nouveaux comptes créés")} cette semaine.`, at: d.newUsersAt });
  return out;
}
