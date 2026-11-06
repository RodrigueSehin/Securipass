"use server";

import { revalidatePath } from "next/cache";
import type { FormState } from "@/lib/auth/actions";
import { fromScale } from "@/lib/courses/grading";
import { createClient } from "@/lib/supabase/server";
import { saveAssessmentSchema } from "./assessments";

const strings = (fd: FormData) => Object.fromEntries([...fd.entries()].filter(([, v]) => typeof v === "string")) as Record<string, string>;

/** Enregistre la note finale, le résultat et le commentaire d'un apprenant pour une session. La note est saisie sur l'échelle de la formation. */
export async function saveAssessment(_prev: FormState, formData: FormData): Promise<FormState> {
  const values = strings(formData);
  const parsed = saveAssessmentSchema.safeParse(values);
  if (!parsed.success) return { fieldErrors: parsed.error.flatten().fieldErrors, values };
  const d = parsed.data;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Session expirée. Reconnectez-vous.", values };

  const { data: session } = await supabase.from("sessions").select("id, course:courses(grading_scale)").eq("id", d.sessionId)
    .maybeSingle<{ id: string; course: { grading_scale: number } | null }>();
  if (!session) return { error: "Session introuvable.", values };
  const scale = session.course?.grading_scale ?? 20;
  if (d.score > scale) return { fieldErrors: { score: [`La note ne peut pas dépasser ${scale}`] }, values };

  const { error } = await supabase.from("session_assessments").upsert(
    { session_id: d.sessionId, learner_id: d.learnerId, score_percent: fromScale(d.score, scale), passed: d.result === "passed", comment: d.comment },
    { onConflict: "session_id,learner_id" },
  );
  if (error) return { error: "L’évaluation n’a pas pu être enregistrée. Vérifiez que l’apprenant est bien inscrit à cette session.", values };
  revalidatePath("/formateur/evaluations");
  return { message: "Évaluation enregistrée.", values };
}
