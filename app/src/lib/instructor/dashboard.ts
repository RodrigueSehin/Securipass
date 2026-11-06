/** Calculs du tableau de bord formateur (purs : sans accès base, testés unitairement). */

export type EnrollmentRow = { id: string; course_id: string; learner_id: string; status: string; enrolled_at: string };

export type Buckets = { formation: number; attente: number; certifies: number; difficulte: number };

/**
 * Répartition des apprenants (une inscription = un apprenant par formation).
 * « Certifié » : certificat valide. « En difficulté » : évaluation échouée sans tentative restante.
 */
export function bucketEnrollments(
  enrollments: EnrollmentRow[],
  certifiedIds: ReadonlySet<string>,
  difficultIds: ReadonlySet<string>,
): Buckets {
  const b: Buckets = { formation: 0, attente: 0, certifies: 0, difficulte: 0 };
  for (const e of enrollments) {
    if (e.status === "waitlisted" || e.status === "pending_payment" || e.status === "pending_approval") b.attente += 1;
    else if (!["confirmed", "completed", "suspended"].includes(e.status)) continue;
    else if (certifiedIds.has(e.id)) b.certifies += 1;
    else if (difficultIds.has(e.id)) b.difficulte += 1;
    else b.formation += 1;
  }
  return b;
}

/** Taux de complétion : inscriptions terminées parmi celles qui ne sont ni annulées ni expirées. */
export function completionRate(enrollments: EnrollmentRow[]): number | null {
  const relevant = enrollments.filter((e) => !["cancelled", "expired"].includes(e.status));
  if (relevant.length === 0) return null;
  return Math.round((relevant.filter((e) => e.status === "completed").length / relevant.length) * 100);
}

/** Taux de réussite : tentatives réussies parmi les tentatives envoyées. */
export function successRate(attempts: { submitted_at: string | null; passed: boolean | null }[]): number | null {
  const sent = attempts.filter((a) => a.submitted_at !== null);
  if (sent.length === 0) return null;
  return Math.round((sent.filter((a) => a.passed === true).length / sent.length) * 100);
}

/** Progression moyenne d'une formation : leçons terminées / (leçons × apprenants actifs). */
export function coursePercent(contentCount: number, learnerCount: number, completionCount: number): number {
  const expected = contentCount * learnerCount;
  if (expected === 0) return 0;
  return Math.min(100, Math.round((completionCount / expected) * 100));
}

/** Nombre d'événements par mois, sur les `months` derniers mois (mois courant inclus). */
export function monthlyCounts(dates: string[], months: number, now = Date.now(), tz = "Africa/Abidjan") {
  const base = new Date(now);
  const slots: { key: string; label: string; count: number }[] = [];
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth() - i, 1));
    const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
    slots.push({ key, label: d.toLocaleDateString("fr-FR", { month: "short", year: "numeric", timeZone: tz }), count: 0 });
  }
  const index = new Map(slots.map((s, i) => [s.key, i]));
  for (const iso of dates) {
    const d = new Date(iso);
    const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
    const i = index.get(key);
    if (i !== undefined) slots[i].count += 1;
  }
  return slots.map(({ label, count }) => ({ label, count }));
}

export { relativeTime } from "@/lib/format";
