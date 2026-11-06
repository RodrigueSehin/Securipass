"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const uuid = z.string().uuid();
const RESULTS = { active: "active", pending: "attente", suspended: "suspendue" } as const;

/** Change le statut d'une entreprise ; `back` ramène à la liste d'où l'action est partie (adresse interne uniquement). */
export async function setCompanyStatus(formData: FormData): Promise<void> {
  const id = uuid.safeParse(formData.get("orgId"));
  const status = z.enum(["active", "pending", "suspended"]).safeParse(formData.get("status"));
  const raw = formData.get("back")?.toString() ?? "";
  const back = /^\/admin\/entreprises[^\s]*$/.test(raw) && !raw.includes("//") ? raw : "/admin/entreprises";
  if (!id.success || !status.success) redirect(back);
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_set_company_status", { p_org: id.data, p_status: status.data });
  revalidatePath("/admin/entreprises");
  const sep = back.includes("?") ? "&" : "?";
  redirect(`${back}${sep}${error ? `erreur=${encodeURIComponent("L’opération a échoué. Réessayez.")}` : `resultat=${RESULTS[status.data]}`}`);
}
