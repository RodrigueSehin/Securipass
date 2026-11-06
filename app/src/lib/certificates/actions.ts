"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { renderCertificatePdf, type CertificateContent } from "./pdf";
import { certificateErrorMessage, issueSchema, reissueSchema, statusSchema } from "./schemas";
import { verificationUrl } from "./urls";

const BACK = "/formateur/certifications";

/** Génère le PDF à partir de la copie figée du certificat et le dépose dans le stockage privé. */
async function storePdf(supabase: Awaited<ReturnType<typeof createClient>>, id: string): Promise<string | null> {
  const { data: row, error } = await supabase
    .from("certificates")
    .select("content, certificate_number, verification_token")
    .eq("id", id)
    .single<{ content: CertificateContent; certificate_number: string; verification_token: string }>();
  if (error || !row) return "Le certificat a été émis, mais sa copie PDF n’a pas pu être lue. Utilisez « Générer le PDF ».";

  const bytes = await renderCertificatePdf(row.content, {
    number: row.certificate_number,
    verifyUrl: verificationUrl(row.verification_token),
  });
  const { error: uploadError } = await supabase.storage
    .from("certificates")
    .upload(`${id}.pdf`, new Blob([new Uint8Array(bytes)], { type: "application/pdf" }), { contentType: "application/pdf", upsert: true });
  if (uploadError) return "Le certificat a été émis, mais la copie PDF n’a pas pu être enregistrée. Utilisez « Générer le PDF ».";
  return null;
}

function paramsOf(input: { title?: string; body?: string; signatoryName: string; signatoryRole: string; validityMonths?: number }) {
  return {
    title: input.title,
    body: input.body,
    signatory_name: input.signatoryName,
    signatory_role: input.signatoryRole,
    validity_months: input.validityMonths,
  };
}

/** Émission d'un certificat pour une inscription éligible (contrôlée en SQL). */
export async function issueCertificate(formData: FormData): Promise<void> {
  const parsed = issueSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) redirect(`${BACK}?erreur=${encodeURIComponent("Vérifiez les champs du formulaire.")}`);
  const input = parsed.data;

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("issue_certificate", {
    p_enrollment: input.enrollmentId,
    p_template: input.templateId,
    p_params: paramsOf(input),
  });
  if (error) redirect(`${BACK}?inscription=${input.enrollmentId}&erreur=${encodeURIComponent(certificateErrorMessage(error.message))}`);

  const result = data as { id: string };
  const pdfProblem = await storePdf(supabase, result.id);
  revalidatePath("/formateur/certifications");
  revalidatePath("/app/certificats");
  redirect(`${BACK}?inscription=${input.enrollmentId}&${pdfProblem ? `erreur=${encodeURIComponent(pdfProblem)}` : "resultat=emis"}`);
}

/** Réémission : révoque le certificat actif avec motif, puis en émet un nouveau. */
export async function reissueCertificate(formData: FormData): Promise<void> {
  const parsed = reissueSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) redirect(`${BACK}?erreur=${encodeURIComponent(parsed.error.issues[0]?.message ?? "Formulaire invalide.")}`);
  const input = parsed.data;

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("reissue_certificate", {
    p_old: input.certificateId,
    p_template: input.templateId,
    p_params: paramsOf(input),
    p_reason: input.reason,
  });
  const enrollment = formData.get("enrollmentId")?.toString() ?? "";
  if (error) redirect(`${BACK}?inscription=${enrollment}&erreur=${encodeURIComponent(certificateErrorMessage(error.message))}`);

  const pdfProblem = await storePdf(supabase, (data as { id: string }).id);
  revalidatePath("/formateur/certifications");
  revalidatePath("/app/certificats");
  redirect(`${BACK}?inscription=${enrollment}&${pdfProblem ? `erreur=${encodeURIComponent(pdfProblem)}` : "resultat=reemis"}`);
}

/** Suspension, levée de suspension ou révocation (motif obligatoire pour les deux dernières). */
export async function changeCertificateStatus(formData: FormData): Promise<void> {
  const parsed = statusSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) redirect(`${BACK}?erreur=${encodeURIComponent("Action invalide.")}`);
  const input = parsed.data;

  const supabase = await createClient();
  const { error } = await supabase.rpc("change_certificate_status", {
    p_id: input.certificateId,
    p_action: input.action,
    p_reason: input.reason ?? null,
  });
  const back = formData.get("inscription")?.toString() ?? "";
  if (error) redirect(`${BACK}?inscription=${back}&erreur=${encodeURIComponent(certificateErrorMessage(error.message))}`);
  revalidatePath("/formateur/certifications");
  revalidatePath("/app/certificats");
  revalidatePath("/verifier");
  redirect(`${BACK}?inscription=${back}&resultat=statut`);
}

/** Recrée la copie PDF d'un certificat (si le dépôt a échoué). Le contenu figé garantit un document identique. */
export async function regenerateCertificatePdf(formData: FormData): Promise<void> {
  const id = formData.get("certificateId")?.toString() ?? "";
  const back = formData.get("inscription")?.toString() ?? "";
  const supabase = await createClient();
  const problem = await storePdf(supabase, id);
  revalidatePath("/formateur/certifications");
  redirect(`${BACK}?inscription=${back}&${problem ? `erreur=${encodeURIComponent(problem)}` : "resultat=pdf"}`);
}

