"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import type { FormState } from "@/lib/auth/actions";

const reviewSchema = z.object({
  courseId: z.string().uuid(),
  decision: z.enum(["publish", "reject", "archive"]),
  reason: z.string().trim().max(2000).optional(),
});

/** Validation pédagogique. Les droits et la cohérence des statuts sont aussi imposés par la base (trigger + RLS). */
export async function reviewCourse(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = reviewSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "Décision invalide." };
  const { courseId, decision, reason } = parsed.data;
  if (decision === "reject" && (!reason || reason.length < 10)) {
    return { fieldErrors: { reason: ["Motivez le refus (10 caractères minimum) : le formateur le verra."] } };
  }

  const supabase = await createClient();
  const patch =
    decision === "publish" ? { status: "published" }
    : decision === "reject" ? { status: "rejected", rejection_reason: reason }
    : { status: "archived" };
  const { data, error } = await supabase.from("courses").update(patch).eq("id", courseId).select("status").maybeSingle();
  if (error || !data) return { error: "Action impossible : vérifiez vos droits et l’état de la formation." };

  revalidatePath("/admin/formations", "layout");
  revalidatePath("/formations", "layout");
  return {
    message:
      decision === "publish" ? "Formation publiée au catalogue."
      : decision === "reject" ? "Formation refusée. Le motif est visible par le formateur."
      : "Formation archivée.",
  };
}
