import type { Mode } from "./labels";
import { stripRichText } from "@/lib/rich-text";
import type { PublicCourse } from "./types";

/**
 * Résumé court d'une description pour le bandeau : premier paragraphe, coupé à la fin d'une phrase si possible,
 * sinon à un mot, avec « … ».
 */
export function summarize(text: string | null | undefined, max = 220): string {
  const first = stripRichText(text).trim().split(/\n\s*\n/)[0].replace(/\s+/g, " ");
  if (first.length <= max) return first;
  const cut = first.slice(0, max);
  const sentenceEnd = Math.max(cut.lastIndexOf(". "), cut.lastIndexOf("! "), cut.lastIndexOf("? "));
  if (sentenceEnd > max * 0.5) return cut.slice(0, sentenceEnd + 1);
  const wordEnd = cut.lastIndexOf(" ");
  return `${cut.slice(0, wordEnd > 0 ? wordEnd : max).replace(/[,;:\s]+$/, "")}…`;
}

export type ProgrammeStats = { modules: number; lessons: number; minutes: number };

export function programmeStats(modules: PublicCourse["modules"]): ProgrammeStats {
  let lessons = 0;
  let minutes = 0;
  for (const m of modules) {
    lessons += m.contents.length;
    minutes += m.contents.reduce((s, c) => s + c.duration_minutes, 0);
  }
  return { modules: modules.length, lessons, minutes };
}

export function moduleMeta(contents: { duration_minutes: number }[]): { lessons: number; minutes: number } {
  return { lessons: contents.length, minutes: contents.reduce((s, c) => s + c.duration_minutes, 0) };
}

/** Durée compacte d'un module : « 45 min » sous une heure, sinon « 6 h » ou « 1 h 30 ». */
export function formatShortDuration(minutes: number): string {
  if (minutes <= 0) return "";
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `${h} h` : `${h} h ${String(m).padStart(2, "0")}`;
}

export const MODE_DETAIL: Record<Mode, string> = {
  online: "100 % en ligne",
  onsite: "Sur site",
  hybrid: "En ligne + présentiel",
};

export function pluralize(n: number, one: string, many: string): string {
  return `${n} ${n > 1 ? many : one}`;
}

/** Durée de validité d'un certificat, en années si possible (« 3 ans »), sinon en mois. */
export function formatValidity(months: number): string {
  if (months % 12 === 0) return pluralize(months / 12, "an", "ans");
  return `${months} mois`;
}

export function initials(name: string): string {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase()).join("") || "?";
}
