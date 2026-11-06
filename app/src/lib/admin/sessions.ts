import { z } from "zod";
import { MODES } from "@/lib/courses/labels";
import { localToUtc, TIMEZONES } from "@/lib/sessions/timezones";

/** Gestion des sessions par l'administration : filtres et types (pur : testé unitairement). */

export const SESSION_STATUSES = ["planned", "in_progress", "completed", "cancelled"] as const;
export type SessionStatus = (typeof SESSION_STATUSES)[number];

export const SESSION_STATUS_UI: Record<SessionStatus, { label: string; tone: string; bar: string }> = {
  in_progress: { label: "En cours", tone: "bg-success/15 text-success", bar: "bg-success" },
  planned: { label: "À venir", tone: "bg-brand-soft text-brand", bar: "bg-brand" },
  completed: { label: "Terminée", tone: "bg-[#ede9fe] text-[#6d28d9]", bar: "bg-success" },
  cancelled: { label: "Annulée", tone: "bg-danger/10 text-danger", bar: "bg-danger" },
};

export type SessionFilters = { q: string; course: string; status: string; mode: string; from: string; to: string; asc: boolean };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DAY = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;

/** Valeurs de filtre acceptées : tout le reste est ignoré ; une période inversée est remise dans l'ordre. */
export function parseSessionFilters(sp: { q?: string; formation?: string; statut?: string; mode?: string; du?: string; au?: string; tri?: string }): SessionFilters {
  let from = sp.du && DAY.test(sp.du) ? sp.du : "";
  let to = sp.au && DAY.test(sp.au) ? sp.au : "";
  if (from && to && from > to) [from, to] = [to, from];
  return {
    q: sp.q?.trim().slice(0, 100) ?? "",
    course: sp.formation && UUID.test(sp.formation) ? sp.formation : "",
    status: (SESSION_STATUSES as readonly string[]).includes(sp.statut ?? "") ? sp.statut! : "",
    mode: sp.mode && sp.mode in MODES ? sp.mode : "",
    from, to,
    asc: sp.tri === "asc",
  };
}

export type SessionRow = {
  id: string; reference: string; title: string; start_at: string; end_at: string; timezone: string;
  delivery_mode: keyof typeof MODES; location: string | null; capacity: number; raw_status: string;
  display_status: SessionStatus; taken: number;
  course_id: string; course_title: string; course_cover: string | null; category_slug: string | null; category_name: string | null;
  instructor_id: string; instructor_name: string; instructor_avatar: string | null;
};

type StatBlock = { count: number; month: number; prev: number };
export type SessionStats = Record<"total" | "in_progress" | "planned" | "completed" | "cancelled", StatBlock>;

/** Part d'un total en pourcentage entier (0 si le total est nul). */
export const sharePercent = (part: number, total: number) => (total > 0 ? Math.round((part / total) * 100) : 0);

/** Dates d'une session : « 12 – 16 oct. 2026 », ou « 12 oct. 2026 » si elle tient sur un jour. */
export function formatDayRange(startIso: string, endIso: string, timeZone: string): string {
  const day = (iso: string, o: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat("fr-FR", { ...o, timeZone }).format(new Date(iso));
  const full = (iso: string) => day(iso, { day: "numeric", month: "short", year: "numeric" });
  const key = (iso: string) => day(iso, { year: "numeric", month: "2-digit", day: "2-digit" });
  if (key(startIso) === key(endIso)) return full(startIso);
  const sameMonth = day(startIso, { month: "2-digit", year: "numeric" }) === day(endIso, { month: "2-digit", year: "numeric" });
  return sameMonth ? `${day(startIso, { day: "numeric" })} – ${full(endIso)}` : `${day(startIso, { day: "numeric", month: "short" })} – ${full(endIso)}`;
}

export const DESCRIPTION_MAX = 500;

const uuidList = z.array(z.string().uuid("Identifiant invalide")).max(10, "10 formateurs supplémentaires au maximum");
const toggle = z.enum(["0", "1"]).optional().transform((v) => v === "1");
const day = (msg: string) => z.string().trim().regex(/^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/, msg);
const time = (msg: string) => z.string().trim().regex(/^([01]\d|2[0-3]):[0-5]\d$/, msg);
const optionalInt = (msg: string) => z.string().trim().optional().transform((v) => (v ? Number(v) : null))
  .pipe(z.number({ error: msg }).int("Nombre entier attendu").min(1, "Au moins 1").max(10000, "10 000 au maximum").nullable());

/** Durée entre deux instants ISO, en heures (une décimale au plus). */
export const durationHours = (startIso: string, endIso: string) => Math.round(((Date.parse(endIso) - Date.parse(startIso)) / 3_600_000) * 10) / 10;

export const createAdminSessionSchema = z.object({
  courseId: z.string().uuid("Formation requise"),
  code: z.string().trim().toUpperCase().optional().transform((v) => v || null)
    .refine((v) => v === null || (/^[A-Z0-9]+(-[A-Z0-9]+)*$/.test(v) && v.length >= 3 && v.length <= 30), "Lettres, chiffres et tirets (3 à 30 caractères)"),
  title: z.string().trim().min(2, "Titre requis (2 caractères au minimum)").max(200, "200 caractères au maximum"),
  description: z.string().trim().max(DESCRIPTION_MAX, `${DESCRIPTION_MAX} caractères au maximum`).optional().transform((v) => v || null),
  startDate: day("Date de début requise"), startTime: time("Heure de début requise"),
  endDate: day("Date de fin requise"), endTime: time("Heure de fin requise"),
  timezone: z.enum(TIMEZONES.map((t) => t.id) as [string, ...string[]], { error: "Fuseau horaire invalide" }),
  mode: z.enum(["onsite", "online", "hybrid"], { error: "Mode requis" }),
  location: z.string().trim().max(300, "300 caractères au maximum").optional().transform((v) => v || null),
  meetingUrl: z.string().trim().optional().transform((v) => v || null)
    .refine((v) => v === null || /^https:\/\/\S+$/.test(v), "Le lien doit commencer par https://"),
  instructorId: z.string().uuid("Formateur principal requis"),
  extraInstructors: uuidList,
  capacity: optionalInt("Nombre de places requis").refine((v) => v !== null, "Nombre de places requis"),
  minCapacity: optionalInt("Nombre invalide"),
  deadlineDate: day("Date invalide").optional().or(z.literal("").transform(() => undefined)),
  initial: z.enum(["open", "draft"], { error: "Statut initial requis" }),
  waitlist: toggle, onlineRegistration: toggle, manualValidation: toggle, companyReserved: toggle,
  coverUrl: z.string().trim().optional().transform((v) => v || null).refine((v) => v === null || /^https:\/\/\S+$/.test(v), "Image invalide"),
}).superRefine((d, ctx) => {
  if (d.mode !== "online" && !d.location) ctx.addIssue({ code: "custom", path: ["location"], message: "Le lieu est requis pour une session en présentiel ou mixte" });
  if (d.mode !== "onsite" && !d.meetingUrl) ctx.addIssue({ code: "custom", path: ["meetingUrl"], message: "Le lien de connexion est requis pour une session en ligne ou mixte" });
  if (d.minCapacity !== null && d.capacity !== null && d.minCapacity > d.capacity) ctx.addIssue({ code: "custom", path: ["minCapacity"], message: "Le minimum dépasse le nombre de places" });
  if (d.extraInstructors.includes(d.instructorId)) ctx.addIssue({ code: "custom", path: ["extraInstructors"], message: "Le formateur principal est déjà responsable de la session" });
  const start = localToUtc(`${d.startDate}T${d.startTime}`, d.timezone);
  const end = localToUtc(`${d.endDate}T${d.endTime}`, d.timezone);
  if (start && end && end <= start) ctx.addIssue({ code: "custom", path: ["endDate"], message: "La fin doit être après le début" });
  if (d.deadlineDate && d.startDate && d.deadlineDate > d.startDate) ctx.addIssue({ code: "custom", path: ["deadlineDate"], message: "La date limite doit précéder le début" });
}).transform((d) => {
  const startAt = localToUtc(`${d.startDate}T${d.startTime}`, d.timezone)!;
  const endAt = localToUtc(`${d.endDate}T${d.endTime}`, d.timezone)!;
  // Date limite : jusqu'à la fin de la journée choisie, sans dépasser le début de la session
  const deadlineEnd = d.deadlineDate ? localToUtc(`${d.deadlineDate}T23:59`, d.timezone) : null;
  return { ...d, capacity: d.capacity as number, startAt, endAt, deadlineAt: deadlineEnd && deadlineEnd > startAt ? startAt : deadlineEnd };
});
