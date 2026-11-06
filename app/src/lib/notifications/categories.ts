/** Catégories d'affichage des notifications (onglets de la page Notifications). */
export const CATEGORIES = {
  formations: "Formations",
  evaluations: "Évaluations",
  certificats: "Certificats",
  messages: "Messages",
} as const;
export type Category = keyof typeof CATEGORIES;

const KIND_CATEGORY: Record<string, Category> = {
  enrollment_confirmed: "formations",
  enrollment_waitlisted: "formations",
  enrollment_pending: "formations",
  enrollment_request: "formations",
  enrollment_declined: "formations",
  waitlist_promoted: "formations",
  session_changed: "formations",
  session_cancelled: "formations",
  evaluation_available: "evaluations",
  evaluation_result: "evaluations",
  certificate_issued: "certificats",
  certificate_revoked: "certificats",
  message_received: "messages",
};

export function categoryOf(kind: string): Category | null {
  return KIND_CATEGORY[kind] ?? null;
}

export function countByCategory<T extends { kind: string }>(items: T[]): Record<Category, number> {
  const counts: Record<Category, number> = { formations: 0, evaluations: 0, certificats: 0, messages: 0 };
  for (const i of items) {
    const c = categoryOf(i.kind);
    if (c) counts[c] += 1;
  }
  return counts;
}
