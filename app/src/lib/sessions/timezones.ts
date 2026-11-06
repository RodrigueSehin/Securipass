/** Fuseaux proposés pour une session : décalages fixes (sans heure d'été), pour une conversion exacte. */
export const TIMEZONES = [
  { id: "Africa/Abidjan", label: "(GMT+00:00) Abidjan", offset: 0 },
  { id: "Africa/Lagos", label: "(GMT+01:00) Lagos", offset: 60 },
  { id: "Africa/Johannesburg", label: "(GMT+02:00) Johannesburg", offset: 120 },
  { id: "Africa/Nairobi", label: "(GMT+03:00) Nairobi", offset: 180 },
] as const;

export const DEFAULT_TIMEZONE = "Africa/Abidjan";

export const isTimezone = (v: string | undefined): v is (typeof TIMEZONES)[number]["id"] => TIMEZONES.some((z) => z.id === v);

export const offsetMinutes = (id: string | undefined): number => TIMEZONES.find((z) => z.id === id)?.offset ?? 0;

/** Instant UTC (ISO) d'une saisie locale « AAAA-MM-JJThh:mm » dans le fuseau donné. */
export function localToUtc(value: string, timezone?: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) return null;
  const d = new Date(`${value}:00Z`);
  if (Number.isNaN(d.getTime())) return null;
  return new Date(d.getTime() - offsetMinutes(timezone) * 60_000).toISOString();
}

export const MEETING_PLATFORMS = { teams: "Microsoft Teams", zoom: "Zoom", meet: "Google Meet", other: "Autre plateforme" } as const;
export type MeetingPlatform = keyof typeof MEETING_PLATFORMS;
