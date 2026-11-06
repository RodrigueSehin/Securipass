import type { ContentType, Level, Mode } from "./labels";

/** Forme retournée par la fonction SQL public_course_detail (aucune donnée sensible). */
export type PublicSession = {
  id: string;
  title: string;
  start_at: string;
  end_at: string;
  timezone: string;
  delivery_mode: Mode;
  location: string | null;
  capacity: number;
  seats_taken: number;
  registration_deadline: string | null;
  waitlist_enabled: boolean;
};

export type PublicCourse = {
  subtitle?: string | null;
  enrollment_mode?: "free" | "approval" | "code";
  keywords?: string[];
  audience_types?: string[];
  rating?: { average: number; total: number } | null;
  registrations_open?: boolean;
  payment_methods?: string[];
  allow_installments?: boolean;
  parent_course?: { title: string; slug: string } | null;
  id: string;
  slug: string;
  title: string;
  description: string | null;
  objectives: string[];
  prerequisites: string | null;
  target_audience: string | null;
  level: Level;
  duration_minutes: number;
  delivery_mode: Mode;
  price_amount: number;
  currency: string;
  cover_url: string | null;
  language: string;
  competencies: string[];
  evaluation_modalities: string | null;
  certificate_conditions: string | null;
  certificate_validity_months: number | null;
  cancellation_policy: string | null;
  accessibility: string | null;
  category: { name: string; slug: string } | null;
  instructor_name: string | null;
  prerequisite_course: { title: string; slug: string } | null;
  modules: {
    id: string;
    title: string;
    description: string | null;
    contents: { title: string; type: ContentType; duration_minutes: number }[];
  }[];
  sessions: PublicSession[];
};

export type SessionState = "open" | "waitlist" | "full" | "closed";

/** État d'inscription d'une session, calculé de la même façon que côté SQL. */
export function sessionState(s: PublicSession, now = new Date()): SessionState {
  const deadline = new Date(s.registration_deadline ?? s.start_at);
  if (deadline <= now) return "closed";
  if (s.seats_taken < s.capacity) return "open";
  return s.waitlist_enabled ? "waitlist" : "full";
}
