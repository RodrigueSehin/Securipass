import { createClient } from "@/lib/supabase/server";
import { listMySessions, type MySession } from "@/lib/courses/instructor-queries";
import { isSelectable, type LearnerDraft } from "./wizard";

export type Registration = LearnerDraft & { id: string; status: string; photoUrl: string | null };

type Row = {
  id: string; first_name: string; last_name: string; email: string; phone: string; birth_date: string | null; gender: string | null;
  company: string | null; job_title: string | null; address: string | null; notes: string | null; photo_path: string | null;
  session_ids: string[]; notify: boolean; status: string;
};

const COLS = "id, first_name, last_name, email, phone, birth_date, gender, company, job_title, address, notes, photo_path, session_ids, notify, status";

const toDraft = (r: Row): LearnerDraft => ({
  firstName: r.first_name, lastName: r.last_name, email: r.email, phone: r.phone, birthDate: r.birth_date, gender: r.gender,
  company: r.company, jobTitle: r.job_title, address: r.address, notes: r.notes, photoPath: r.photo_path, sessionIds: r.session_ids, notify: r.notify,
});

/** Fiche en cours de saisie (brouillon) du formateur connecté, avec l'adresse signée de la photo. */
export async function getRegistrationDraft(id: string): Promise<Registration | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase.from("learner_registrations").select(COLS).eq("id", id).eq("instructor_id", user.id).eq("status", "draft").maybeSingle<Row>();
  if (!data) return null;
  const photoUrl = data.photo_path ? (await supabase.storage.from("profile-photos").createSignedUrl(data.photo_path, 600)).data?.signedUrl ?? null : null;
  return { ...toDraft(data), id: data.id, status: data.status, photoUrl };
}

/** Sessions proposées à l'étape 2 : planifiées, non terminées, avec une place ou une liste d'attente. */
export async function listSelectableSessions(now: number): Promise<MySession[]> {
  const all = await listMySessions();
  return all
    .filter((s) => isSelectable(s, now))
    .sort((a, b) => a.start_at.localeCompare(b.start_at));
}

/** Fiches en attente de la création d'un compte (l'inscription se fera à la création du compte). */
export async function listPendingRegistrations(): Promise<{ id: string; name: string; email: string; sessions: number }[]> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];
  const { data } = await supabase.from("learner_registrations").select("id, first_name, last_name, email, session_ids")
    .eq("instructor_id", user.id).eq("status", "pending").order("created_at", { ascending: false }).limit(20)
    .returns<{ id: string; first_name: string; last_name: string; email: string; session_ids: string[] }[]>();
  return (data ?? []).map((r) => ({ id: r.id, name: `${r.first_name} ${r.last_name}`.trim(), email: r.email, sessions: r.session_ids.length }));
}
