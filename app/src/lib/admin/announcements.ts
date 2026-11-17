import { z } from "zod";

export type Announcement = { id: string; message: string; link_url: string | null; active: boolean; position: number };

export const ANNOUNCEMENT_MAX = 200;
export const ANNOUNCEMENT_LIMIT = 20;

/** Lien facultatif : chemin interne (/formations) ou adresse en http(s). */
export const isAllowedLink = (v: string) => v === "" || (/^\/[^/\s]\S*$/.test(v) && v.length <= 300) || (/^https?:\/\/\S+$/i.test(v) && v.length <= 300);

export const announcementSchema = z.object({
  id: z.string().uuid().nullable(),
  message: z.string().trim().min(3, "Le message doit contenir au moins 3 caractères.").max(ANNOUNCEMENT_MAX, `Le message ne peut pas dépasser ${ANNOUNCEMENT_MAX} caractères.`),
  link: z.string().trim().refine(isAllowedLink, "Lien : chemin du site (ex. /formations) ou adresse en http(s)://."),
  active: z.boolean(),
});

export function parseAnnouncementForm(form: { get(name: string): FormDataEntryValue | null }) {
  const id = form.get("id")?.toString() || null;
  return announcementSchema.safeParse({ id, message: form.get("message")?.toString() ?? "", link: form.get("link")?.toString() ?? "", active: form.get("active") === "on" });
}
