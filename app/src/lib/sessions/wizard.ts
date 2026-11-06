import { z } from "zod";
import { fromDatetimeLocal } from "@/lib/format";
import { DEFAULT_TIMEZONE, TIMEZONES } from "./timezones";

/** Assistant « Créer une session » : étapes, brouillon et validations par étape (pur : testé unitairement). */

export const SESSION_STEPS = ["Informations générales", "Planification", "Participants et options", "Confirmation"] as const;
export const SESSION_STEP_COUNT = SESSION_STEPS.length;
export const DEFAULT_CAPACITY = 30;
export const MAX_OBJECTIVES = 10;

export function parseSessionStep(value: string | undefined): number {
  const n = Math.floor(Number(value));
  return Number.isFinite(n) && n >= 1 && n <= SESSION_STEP_COUNT ? n : 1;
}

export function sessionWizardUrl(draftId: string, next: string | undefined | null, fallbackStep = 2): string {
  if (next === "list") return "/formateur/sessions?resultat=assistant";
  const n = Math.floor(Number(next));
  const step = Number.isFinite(n) && n >= 1 && n <= SESSION_STEP_COUNT ? n : fallbackStep;
  return `/formateur/sessions/nouvelle/${draftId}?etape=${step}`;
}

export type Extra = { date: string; start: string; end: string };

/** Contenu du brouillon : toutes les valeurs sont des textes saisis, sauf les listes. */
export type SessionDraft = Partial<{
  courseId: string; title: string; deliveryMode: string; description: string; objectives: string[]; requiredLevel: string;
  prerequisiteCourseId: string; language: string; capacity: string;
  planning: string; startDate: string; startTime: string; endDate: string; endTime: string; timezone: string; extras: Extra[];
  platform: string; location: string; meetingUrl: string; welcomeMessage: string; sendInvitation: string; addToCalendar: string;
  registrationDeadline: string; waitlistEnabled: string;
}>;

const optionalText = (max: number, msg: string) =>
  z.string().trim().max(max, msg).optional().transform((v) => v ?? "");

export const sessionStep1Schema = z.object({
  courseId: z.string().min(1, "Choisissez une formation").uuid("Formation invalide"),
  title: z.string().trim().min(2, "Titre de la session requis").max(200, "200 caractères au maximum"),
  deliveryMode: z.enum(["online", "onsite"], { error: "Choisissez le mode de livraison" }),
  description: optionalText(1000, "1 000 caractères au maximum"),
  objectives: z.array(z.string().trim().min(1).max(150, "150 caractères au maximum par objectif")).max(MAX_OBJECTIVES, "10 objectifs au maximum"),
  requiredLevel: z.enum(["beginner", "intermediate", "advanced"], { error: "Niveau invalide" }),
  prerequisiteCourseId: z.string().optional().transform((v) => v ?? "").pipe(z.union([z.literal(""), z.string().uuid("Formation invalide")])),
  language: z.enum(["fr", "en"], { error: "Langue invalide" }),
  capacity: z.coerce.number("Capacité requise").int("Nombre entier").min(1, "Au moins 1 participant").max(10000, "10 000 au maximum"),
});

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
export const MAX_EXTRAS = 20;

const date = (msg: string) => z.string().regex(DATE, msg).refine((v) => !Number.isNaN(Date.parse(`${v}T00:00:00Z`)), msg);
const time = (msg: string) => z.string().regex(TIME, msg);

export const sessionStep2Schema = z
  .object({
    planning: z.enum(["single", "multiple"], { error: "Type de planification invalide" }),
    deliveryMode: z.enum(["online", "onsite", "hybrid"], { error: "Choisissez le mode de livraison" }),
    startDate: date("Date de début invalide"),
    startTime: time("Heure de début invalide"),
    endDate: date("Date de fin invalide"),
    endTime: time("Heure de fin invalide"),
    timezone: z.enum(TIMEZONES.map((z) => z.id) as [string, ...string[]], { error: "Fuseau horaire invalide" }),
    extras: z.array(z.object({ date: date("Date invalide"), start: time("Heure de début invalide"), end: time("Heure de fin invalide") })).max(MAX_EXTRAS, "20 séances au maximum"),
    platform: z.enum(["teams", "zoom", "meet", "other", ""], { error: "Plateforme invalide" }),
    location: optionalText(300, "300 caractères au maximum"),
    meetingUrl: z.string().trim().optional().transform((v) => v ?? ""),
    welcomeMessage: optionalText(500, "500 caractères au maximum"),
    sendInvitation: z.enum(["0", "1"]),
    addToCalendar: z.enum(["0", "1"]),
  })
  .superRefine((d, ctx) => {
    const bad = (path: string, message: string) => ctx.addIssue({ code: "custom", path: [path], message });
    if (d.startDate && d.endDate && d.startTime && d.endTime && `${d.endDate}T${d.endTime}` <= `${d.startDate}T${d.startTime}`) bad("endTime", "La fin doit être après le début");
    if (d.deliveryMode !== "onsite") {
      if (!d.platform) bad("platform", "Choisissez la plateforme de visioconférence");
      if (!d.meetingUrl) bad("meetingUrl", "Le lien de la session est requis");
      else if (!/^https:\/\/\S+$/.test(d.meetingUrl)) bad("meetingUrl", "Le lien doit commencer par https://");
    }
    if (d.deliveryMode !== "online" && !d.location) bad("location", "Le lieu est requis pour une session en présentiel");
    if (d.planning === "multiple") {
      d.extras.forEach((x, i) => { if (x.end <= x.start) bad("extras", `Séance ${i + 2} : la fin doit être après le début`); });
    }
  });

export const sessionStep3Schema = z.object({
  registrationDeadline: z.string().optional().transform((v, ctx) => {
    if (!v) return "";
    if (!fromDatetimeLocal(v)) ctx.addIssue({ code: "custom", message: "Date limite invalide" });
    return v;
  }),
  waitlistEnabled: z.string().optional().transform((v) => (v === "on" ? "on" : "")),
});

export type Occurrence = { start: string; end: string };

/** Créneaux à créer : la séance principale, plus les séances supplémentaires pour une planification multiple. Valeurs « AAAA-MM-JJThh:mm » locales. */
export function occurrences(d: SessionDraft): Occurrence[] {
  const main = { start: `${d.startDate ?? ""}T${d.startTime ?? ""}`, end: `${d.endDate ?? ""}T${d.endTime ?? ""}` };
  if (d.planning !== "multiple") return [main];
  return [main, ...(d.extras ?? []).map((x) => ({ start: `${x.date}T${x.start}`, end: `${x.date}T${x.end}` }))];
}

/** Premier chevauchement entre créneaux (même fuseau) : renvoie les numéros de séance (1 = principale) ou null. */
export function findOverlap(list: Occurrence[]): [number, number] | null {
  for (let i = 0; i < list.length; i++) {
    for (let j = i + 1; j < list.length; j++) {
      if (list[i].start < list[j].end && list[j].start < list[i].end) return [i + 1, j + 1];
    }
  }
  return null;
}

/** Durée entre deux saisies locales, en minutes (0 si invalide). */
export function minutesBetween(start: string, end: string): number {
  const a = Date.parse(`${start}:00Z`);
  const b = Date.parse(`${end}:00Z`);
  return Number.isNaN(a) || Number.isNaN(b) || b <= a ? 0 : Math.round((b - a) / 60_000);
}

/** « 3 heures », « 1 h 30 », « 2 jours » : durée lisible d'un créneau. */
export function spanLabel(minutes: number): string {
  if (minutes <= 0) return "—";
  if (minutes < 60) return `${minutes} min`;
  if (minutes % 1440 === 0) return `${minutes / 1440} jour${minutes >= 2880 ? "s" : ""}`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `${h} heure${h > 1 ? "s" : ""}` : `${h} h ${String(m).padStart(2, "0")}`;
}

/** Valeurs du brouillon sous forme de formulaire, pour réutiliser la création de session existante (un créneau à la fois). */
export function draftToFormData(draft: SessionDraft, extra: { draft?: boolean; occurrence?: Occurrence } = {}): FormData {
  const fd = new FormData();
  const set = (k: string, v: string | undefined) => { if (v !== undefined) fd.set(k, v); };
  const occ = extra.occurrence ?? occurrences(draft)[0];
  set("courseId", draft.courseId); set("title", draft.title); set("deliveryMode", draft.deliveryMode);
  set("description", draft.description ?? ""); set("requiredLevel", draft.requiredLevel ?? "beginner");
  set("prerequisiteCourseId", draft.prerequisiteCourseId ?? ""); set("language", draft.language ?? "fr");
  set("capacity", draft.capacity); set("start", occ.start); set("end", occ.end);
  set("timezone", draft.timezone ?? DEFAULT_TIMEZONE);
  set("location", draft.deliveryMode === "online" ? "" : draft.location ?? "");
  set("meetingUrl", draft.deliveryMode === "onsite" ? "" : draft.meetingUrl ?? "");
  set("meetingPlatform", draft.deliveryMode === "onsite" ? "" : draft.platform ?? "");
  set("welcomeMessage", draft.welcomeMessage ?? "");
  set("sendInvitation", draft.sendInvitation ?? "1"); set("addToCalendar", draft.addToCalendar ?? "0");
  set("registrationDeadline", draft.registrationDeadline ?? "");
  if (draft.waitlistEnabled === "on") fd.set("waitlistEnabled", "on");
  for (const o of draft.objectives ?? []) fd.append("objective", o);
  if (extra.draft) fd.set("draft", "1");
  return fd;
}

/** Valeurs du brouillon au format de l'étape 2 (avec les valeurs par défaut). */
export function step2Input(d: SessionDraft) {
  return {
    planning: d.planning ?? "single", deliveryMode: d.deliveryMode, startDate: d.startDate ?? "", startTime: d.startTime ?? "",
    endDate: d.endDate ?? "", endTime: d.endTime ?? "", timezone: d.timezone ?? DEFAULT_TIMEZONE, extras: d.extras ?? [],
    platform: d.platform ?? "", location: d.location, meetingUrl: d.meetingUrl, welcomeMessage: d.welcomeMessage,
    sendInvitation: d.sendInvitation ?? "1", addToCalendar: d.addToCalendar ?? "0",
  };
}

/** Étapes dont les données obligatoires manquent : sert à bloquer la confirmation et à guider vers l'étape à compléter. */
export function missingSteps(d: SessionDraft): number[] {
  const out: number[] = [];
  if (!sessionStep1Schema.safeParse({ ...d, objectives: d.objectives ?? [] }).success) out.push(1);
  if (!sessionStep2Schema.safeParse(step2Input(d)).success) out.push(2);
  return out;
}
