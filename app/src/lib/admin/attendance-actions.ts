"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { FormState } from "@/lib/auth/actions";
import { createClient } from "@/lib/supabase/server";
import { attendanceRowSchema } from "./attendance";

/** Enregistre les présences d'une session (une ligne par inscrit, les lignes sans statut sont ignorées) ; tracé dans le journal d'audit. */
export async function recordAttendance(_prev: FormState, formData: FormData): Promise<FormState> {
  const session = z.string().uuid().safeParse(formData.get("sessionId"));
  if (!session.success) return { error: "Session invalide." };
  const ids = formData.getAll("learner").map(String);
  const rows: { learner: string; status: string; check_in: string; check_out: string; justification: string }[] = [];
  const fieldErrors: Record<string, string[]> = {};
  for (const id of ids) {
    const parsed = attendanceRowSchema.safeParse({
      learner: id, status: formData.get(`status-${id}`) ?? "", checkIn: formData.get(`in-${id}`) ?? "", checkOut: formData.get(`out-${id}`) ?? "", justification: formData.get(`note-${id}`) ?? "",
    });
    if (!parsed.success) { fieldErrors[id] = [parsed.error.issues[0].message]; continue; }
    const d = parsed.data;
    rows.push({ learner: d.learner, status: d.status, check_in: d.checkIn, check_out: d.checkOut, justification: d.justification });
  }
  if (Object.keys(fieldErrors).length) return { fieldErrors, error: "Corrigez les lignes signalées." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_record_attendance", { p_session: session.data, p_rows: rows });
  if (error) {
    const msg = error.message.includes("learner_not_in_session") ? "Un des apprenants n’est plus inscrit à cette session." : error.message.includes("session_invalid") ? "Session introuvable." : "Impossible d’enregistrer les présences. Réessayez.";
    return { error: msg };
  }
  revalidatePath("/admin/presences");
  redirect(`/admin/presences?session=${session.data}&resultat=enregistre`);
}
