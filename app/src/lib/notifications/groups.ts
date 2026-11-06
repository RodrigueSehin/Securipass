const TZ = "Africa/Abidjan";
const DAY = 86_400_000;

/** Clé calendaire (jour) dans le fuseau de la plateforme. */
const dayKey = (ms: number) => new Date(ms).toLocaleDateString("en-CA", { timeZone: TZ });

/** Regroupe par jour : « Aujourd’hui », « Hier », puis la date complète. Conserve l'ordre reçu. */
export function groupByDay<T extends { created_at: string }>(items: T[], now = Date.now()): { label: string; items: T[] }[] {
  const today = dayKey(now);
  const yesterday = dayKey(now - DAY);
  const groups = new Map<string, { label: string; items: T[] }>();
  for (const item of items) {
    const ms = new Date(item.created_at).getTime();
    const key = dayKey(ms);
    const label = key === today ? "Aujourd’hui"
      : key === yesterday ? "Hier"
      : new Date(ms).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric", timeZone: TZ });
    const group = groups.get(key) ?? { label, items: [] };
    group.items.push(item);
    groups.set(key, group);
  }
  return [...groups.values()];
}
