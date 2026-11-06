const TZ = "Africa/Abidjan";

export function formatDateTime(iso: string, timeZone = TZ): string {
  return new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium", timeStyle: "short", timeZone }).format(new Date(iso));
}

export function formatDate(iso: string, timeZone = TZ): string {
  return new Intl.DateTimeFormat("fr-FR", { dateStyle: "long", timeZone }).format(new Date(iso));
}

export function formatTimeRange(startIso: string, endIso: string, timeZone = TZ): string {
  const t = new Intl.DateTimeFormat("fr-FR", { timeStyle: "short", timeZone });
  return `${t.format(new Date(startIso))} – ${t.format(new Date(endIso))}`;
}

/** Valeur pour <input type="datetime-local"> à partir d'un instant ISO, dans le fuseau donné. */
export function toDatetimeLocal(iso: string, timeZone = TZ): string {
  const parts = new Intl.DateTimeFormat("sv-SE", {
    timeZone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false,
  }).format(new Date(iso));
  return parts.replace(" ", "T");
}

/** Interprète une saisie datetime-local comme heure d'Abidjan (UTC+0, sans heure d'été) et renvoie un ISO UTC. */
export function fromDatetimeLocal(value: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) return null;
  const d = new Date(`${value}:00Z`);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

/** Date courte du blog : « 12 oct. 2026 ». */
export function formatShortDate(iso: string, timeZone = TZ): string {
  return new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "short", year: "numeric", timeZone }).format(new Date(iso));
}

/** Délai relatif court pour l'activité récente : « Il y a 2 heures ». */
export function relativeTime(iso: string, now = Date.now()): string {
  const minutes = Math.floor(Math.max(0, now - Date.parse(iso)) / 60_000);
  if (minutes < 1) return "À l’instant";
  if (minutes < 60) return `Il y a ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return hours === 1 ? "Il y a 1 heure" : `Il y a ${hours} heures`;
  const days = Math.floor(hours / 24);
  return days === 1 ? "Hier" : `Il y a ${days} jours`;
}

/** Durée en minutes : « 45 min », « 1 h », « 1 h 20 min ». */
export function formatMinutes(minutes: number): string {
  const m = Math.max(0, Math.round(minutes));
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  return m % 60 === 0 ? `${h} h` : `${h} h ${m % 60} min`;
}

/** Taille de fichier : « 850 o », « 12 Ko », « 2,4 Mo ». */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 ** 2) return `${Math.round(bytes / 1024)} Ko`;
  return `${(bytes / 1024 ** 2).toFixed(1).replace(".", ",")} Mo`;
}
