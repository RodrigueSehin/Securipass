import { z } from "zod";

/** Gestion des présences par l'administration : filtres, statuts et calculs (pur : testé unitairement). */

export const ATTENDANCE_VIEWS = ["liste", "seances", "formations"] as const;
export type AttendanceView = (typeof ATTENDANCE_VIEWS)[number];

export const ATTENDANCE_STATUS_UI = {
  present: { label: "Présent", tone: "bg-success/15 text-success" },
  late: { label: "En retard", tone: "bg-warning/15 text-warning" },
  absent: { label: "Absent", tone: "bg-danger/10 text-danger" },
  excused: { label: "Absent", tone: "bg-danger/10 text-danger" },
} as const;
export type AttendanceStatus = keyof typeof ATTENDANCE_STATUS_UI;

/** Choix de la saisie : « excused » = absence justifiée. */
export const ATTENDANCE_CHOICES = { present: "Présent", late: "En retard", absent: "Absent (non justifié)", excused: "Absent (justifié)" } as const;

export type AttendanceFilters = { view: AttendanceView; course: string; session: string; date: string };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DAY = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;

/** Valeurs de filtre acceptées : tout le reste est ignoré. */
export function parseAttendanceFilters(sp: { vue?: string; formation?: string; session?: string; date?: string }): AttendanceFilters {
  return {
    view: (ATTENDANCE_VIEWS as readonly string[]).includes(sp.vue ?? "") ? (sp.vue as AttendanceView) : "liste",
    course: sp.formation && UUID.test(sp.formation) ? sp.formation : "",
    session: sp.session && UUID.test(sp.session) ? sp.session : "",
    date: sp.date && DAY.test(sp.date) ? sp.date : "",
  };
}

export type AttendanceOptions = {
  courses: { id: string; title: string }[];
  sessions: { id: string; title: string; course_id: string; start_at: string; end_at: string; timezone: string }[];
};
export type AttendanceStats = { enrolled: number; present: number; absent: number };
export type AttendanceRow = {
  learner_id: string; full_name: string; avatar_url: string | null; learner_code: string | null; organization: string | null;
  status: AttendanceStatus | null; check_in: string | null; check_out: string | null; justification: string | null;
};
export type AttendanceSessionHead = { session_id: string; title: string; start_at: string; end_at: string; timezone: string; course_id: string; course_title: string; delivery_mode: string; location: string | null; instructor_name: string };
export type AttendanceSummaryRow = { id: string; title: string; course_title?: string; start_at?: string; end_at?: string; timezone?: string; sessions?: number; enrolled: number; present: number; absent: number };

/** Taux de présence en pourcentage (une décimale) ; null sans inscrit. */
export function attendanceRate(present: number, enrolled: number): number | null {
  return enrolled > 0 ? Math.round((present / enrolled) * 1000) / 10 : null;
}

/** « 91,7 % » (virgule française) ou « — ». */
export function formatRate(rate: number | null): string {
  return rate === null ? "—" : `${rate.toLocaleString("fr-FR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} %`;
}

/** Libellé du commentaire d'une ligne : justification saisie, sinon mention selon le statut. */
export function attendanceComment(r: Pick<AttendanceRow, "status" | "justification">): string | null {
  if (r.justification) return r.justification;
  if (r.status === "excused") return "Absence justifiée";
  if (r.status === "absent") return "Non justifiée";
  return null;
}

const time = z.string().trim().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Heure invalide");
export const attendanceRowSchema = z.object({
  learner: z.string().uuid(),
  status: z.enum(["", "present", "late", "absent", "excused"]),
  checkIn: z.union([z.literal(""), time]),
  checkOut: z.union([z.literal(""), time]),
  justification: z.string().trim().max(500, "500 caractères au maximum"),
}).superRefine((d, ctx) => {
  if (d.checkIn && d.checkOut && d.checkOut <= d.checkIn) ctx.addIssue({ code: "custom", path: ["checkOut"], message: "Le départ doit suivre l’arrivée" });
});
