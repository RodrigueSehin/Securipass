"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import type { FormState } from "@/lib/auth/actions";
import { safeRedirect } from "@/lib/auth/schemas";
import { enrollmentErrorMessage } from "./errors";

const enrollSchema = z.object({
  courseId: z.string().uuid(),
  accessCode: z.string().trim().max(40).optional(),
  sessionId: z.string().uuid().optional().or(z.literal("").transform(() => undefined)),
  accept: z.literal("on", { error: "Vous devez accepter les conditions pour vous inscrire" }),
});

export async function enrollSelf(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = enrollSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { fieldErrors: parsed.error.flatten().fieldErrors };

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: enrollmentErrorMessage("not_authenticated") };

  const { data, error } = await supabase.rpc("enroll_self", {
    p_course: parsed.data.courseId,
    p_session: parsed.data.sessionId ?? null,
    p_code: parsed.data.accessCode || null,
  });
  if (error) return { error: enrollmentErrorMessage(error.message) };

  const status = (data as { status?: string } | null)?.status ?? "confirmed";
  revalidatePath("/app/inscriptions");
  redirect(`/app/inscriptions?resultat=${status === "waitlisted" ? "attente" : status === "pending_approval" ? "demande" : "ok"}`);
}

/** Annule une inscription (apprenant, formateur de la formation ou personnel : contrôlé en SQL). */
export async function cancelEnrollment(formData: FormData): Promise<void> {
  const back = safeRedirect(formData.get("returnTo")?.toString(), "/app/inscriptions").split("?")[0];
  const id = z.string().uuid().safeParse(formData.get("enrollmentId"));
  if (!id.success) redirect(`${back}?resultat=erreur`);
  const supabase = await createClient();
  const { error } = await supabase.rpc("cancel_enrollment", { p_enrollment: id.data });
  revalidatePath("/", "layout");
  redirect(`${back}?resultat=${error ? "erreur" : "annule"}`);
}

/** Décision du formateur sur une demande d'inscription : accepter ou refuser (règles appliquées en SQL). */
export async function reviewEnrollment(formData: FormData): Promise<void> {
  const id = z.string().uuid().safeParse(formData.get("enrollmentId"));
  const courseId = z.string().uuid().safeParse(formData.get("courseId"));
  const approve = formData.get("decision") === "approve";
  if (!id.success || !courseId.success) redirect("/formateur/formations");
  const back = `/formateur/formations/${courseId.data}/sessions`;

  const supabase = await createClient();
  const { error } = await supabase.rpc("review_enrollment", { p_enrollment: id.data, p_approve: approve });
  revalidatePath(back);
  if (error) redirect(`${back}?erreur=${encodeURIComponent(enrollmentErrorMessage(error.message))}`);
  redirect(`${back}?decision=${approve ? "acceptee" : "refusee"}`);
}
