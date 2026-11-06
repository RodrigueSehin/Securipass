import { createClient } from "@/lib/supabase/server";
import { mergeActivity, type Activity, type RoleKey } from "./dashboard";

export type Stats = {
  users: { active: number; month: number; prev: number; week: number; latest_at: string | null };
  enrollments: { total: number; month: number; prev: number; pending_payment: number; pending_payment_at: string | null };
  courses: { published: number; month: number; prev: number; in_review: number; in_review_at: string | null };
  sessions: { upcoming: number; week: number; month: number; prev: number };
  certificates: { total: number; month: number; prev: number; expiring: number; expiring_at: string | null };
  support: { open: number; in_progress: number; new: number; new_at: string | null; month: number; prev: number };
  series: Record<"users" | "enrollments" | "courses" | "sessions" | "certificates" | "support", number[]>;
  roles: Record<RoleKey, number>;
};

export type AdminDashboard = { name: string; stats: Stats | null; activity: Activity[]; failed: boolean };

const ROLE_LABEL: Record<string, string> = {
  admin: "Administrateur", instructor: "Formateur", company: "Entreprise", learner: "Apprenant",
  pedagogy_manager: "Responsable pédagogique", certification_manager: "Responsable certification", support: "Support",
};
const RANK = ["admin", "instructor", "company", "pedagogy_manager", "certification_manager", "support", "learner"];

type P = { full_name: string; avatar_url: string | null } | null;

/** Totaux (fonction SQL réservée au personnel) et activité récente ; les lectures passent par la RLS du personnel. */
export async function loadAdminDashboard(): Promise<AdminDashboard> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { name: "", stats: null, activity: [], failed: true };

  const [me, stats, enr, rev, certs, users] = await Promise.all([
    supabase.from("profiles").select("full_name").eq("id", user.id).maybeSingle<{ full_name: string }>(),
    supabase.rpc("admin_dashboard"),
    supabase.from("enrollments").select("id, enrolled_at, learner:profiles!enrollments_learner_id_fkey(full_name, avatar_url), course:courses(title)")
      .order("enrolled_at", { ascending: false }).limit(5).returns<{ id: string; enrolled_at: string; learner: P; course: { title: string } | null }[]>(),
    supabase.from("courses").select("id, title, updated_at, instructor:profiles!courses_instructor_id_fkey(full_name, avatar_url)").eq("status", "in_review")
      .order("updated_at", { ascending: false }).limit(5).returns<{ id: string; title: string; updated_at: string; instructor: P }[]>(),
    supabase.from("certificates").select("id, issued_at, learner:profiles!certificates_learner_id_fkey(full_name, avatar_url), course:courses(title)")
      .neq("status", "revoked").order("issued_at", { ascending: false }).limit(5)
      .returns<{ id: string; issued_at: string; learner: P; course: { title: string } | null }[]>(),
    supabase.from("profiles").select("id, full_name, avatar_url, created_at, roles:user_roles(role:roles(code))").order("created_at", { ascending: false }).limit(5)
      .returns<{ id: string; full_name: string; avatar_url: string | null; created_at: string; roles: { role: { code: string } | null }[] }[]>(),
  ]);
  if (stats.error || !stats.data) return { name: me.data?.full_name ?? "", stats: null, activity: [], failed: true };

  const who = (p: P) => ({ name: p?.full_name || "Utilisateur", avatar: p?.avatar_url ?? null });
  const activity = mergeActivity([
    (enr.data ?? []).map((e) => ({ id: `e-${e.id}`, ...who(e.learner), role: "Apprenant", kind: "Inscription" as const, detail: `Inscription à la formation ${e.course?.title ?? ""}`.trim(), at: e.enrolled_at })),
    (rev.data ?? []).map((c) => ({ id: `c-${c.id}`, ...who(c.instructor), role: "Formateur", kind: "Formation" as const, detail: `Formation « ${c.title} » soumise pour validation`, at: c.updated_at })),
    (certs.data ?? []).map((c) => ({ id: `k-${c.id}`, ...who(c.learner), role: "Apprenant", kind: "Certification" as const, detail: `Certificat émis — ${c.course?.title ?? ""}`.trim(), at: c.issued_at })),
    (users.data ?? []).map((u) => {
      const code = [...(u.roles ?? [])].map((r) => r.role?.code ?? "").sort((a, b) => RANK.indexOf(a) - RANK.indexOf(b))[0] ?? "learner";
      return { id: `u-${u.id}`, name: u.full_name || "Utilisateur", avatar: u.avatar_url, role: ROLE_LABEL[code] ?? "Utilisateur", kind: "Utilisateur" as const, detail: "Nouveau compte créé", at: u.created_at };
    }),
  ]);
  return { name: me.data?.full_name ?? "", stats: stats.data as Stats, activity, failed: false };
}
