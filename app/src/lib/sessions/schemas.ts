import { z } from "zod";
import { fromDatetimeLocal } from "@/lib/format";

const dt = (msg: string) =>
  z.string().transform((v, ctx) => {
    const iso = fromDatetimeLocal(v);
    if (!iso) ctx.addIssue({ code: "custom", message: msg });
    return iso ?? "";
  });

export const sessionSchema = z
  .object({
    courseId: z.string().uuid(),
    title: z.string().trim().min(2, "Nom de session requis").max(200),
    start: dt("Date de début invalide"),
    end: dt("Date de fin invalide"),
    registrationDeadline: z
      .string()
      .optional()
      .transform((v, ctx) => {
        if (!v) return undefined;
        const iso = fromDatetimeLocal(v);
        if (!iso) ctx.addIssue({ code: "custom", message: "Date limite invalide" });
        return iso ?? undefined;
      }),
    deliveryMode: z.enum(["onsite", "online", "hybrid"], { error: "Modalité invalide" }),
    location: z.string().trim().max(300).optional().transform((v) => v || undefined),
    meetingUrl: z.string().trim().url("Lien invalide").startsWith("https://", "Le lien doit commencer par https://").optional().or(z.literal("").transform(() => undefined)),
    capacity: z.coerce.number("Capacité requise").int("Nombre entier").min(1, "Au moins 1 place").max(10000),
    waitlistEnabled: z.string().optional().transform((v) => v === "on"),
    // Informations pédagogiques : absentes = inchangées à la modification
    description: z.string().trim().max(1000, "1 000 caractères au maximum").optional().transform((v) => (v === undefined ? undefined : v || null)),
    objectives: z.array(z.string().trim().min(1).max(150, "150 caractères au maximum par objectif")).max(10, "10 objectifs au maximum").optional(),
    requiredLevel: z.enum(["beginner", "intermediate", "advanced"], { error: "Niveau invalide" }).optional(),
    prerequisiteCourseId: z.string().optional().transform((v) => (v === undefined ? undefined : v === "" ? null : v)).pipe(z.string().uuid("Formation invalide").nullable().optional()),
    language: z.enum(["fr", "en"], { error: "Langue invalide" }).optional(),
    timezone: z.enum(["Africa/Abidjan", "Africa/Lagos", "Africa/Johannesburg", "Africa/Nairobi"], { error: "Fuseau horaire invalide" }).optional(),
    meetingPlatform: z.enum(["teams", "zoom", "meet", "other"], { error: "Plateforme invalide" }).optional().or(z.literal("").transform(() => undefined)),
    welcomeMessage: z.string().trim().max(500, "500 caractères au maximum").optional().transform((v) => (v === undefined ? undefined : v || null)),
    sendInvitation: z.enum(["0", "1"]).optional(),
    addToCalendar: z.enum(["0", "1"]).optional(),
  })
  .superRefine((d, ctx) => {
    if (d.start && d.end && d.end <= d.start) ctx.addIssue({ code: "custom", path: ["end"], message: "La fin doit être après le début" });
    if (d.registrationDeadline && d.start && d.registrationDeadline > d.start) {
      ctx.addIssue({ code: "custom", path: ["registrationDeadline"], message: "La date limite doit précéder le début" });
    }
    if (d.deliveryMode !== "online" && !d.location) ctx.addIssue({ code: "custom", path: ["location"], message: "Le lieu est requis pour une session en présentiel ou hybride" });
    if (d.deliveryMode !== "onsite" && !d.meetingUrl) ctx.addIssue({ code: "custom", path: ["meetingUrl"], message: "Le lien de connexion est requis pour une session à distance ou hybride" });
  });

export const enrollByEmailSchema = z.object({
  sessionId: z.string().uuid(),
  email: z.string().trim().toLowerCase().email("Adresse e-mail invalide"),
});
