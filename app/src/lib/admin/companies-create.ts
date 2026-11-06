"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import type { FormState } from "@/lib/auth/actions";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { createCompanySchema } from "./companies";

/** Crée une entreprise cliente avec ses contacts ; tracé dans le journal d'audit. */
export async function createCompany(_prev: FormState, formData: FormData): Promise<FormState> {
  const values = Object.fromEntries([...formData.entries()].filter(([, v]) => typeof v === "string")) as Record<string, string>;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Session expirée. Reconnectez-vous.", values };
  const { data: isAdmin } = await supabase.rpc("has_role", { _role: "admin" });
  if (!isAdmin) return { error: "Seul un administrateur peut effectuer cette action.", values };

  const parsed = createCompanySchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { fieldErrors: parsed.error.flatten().fieldErrors, values };
  const d = parsed.data;
  if (d.logoUrl && !new RegExp(`^https://[^/]+/storage/v1/object/public/company-logos/${user.id}/`).test(d.logoUrl)) return { fieldErrors: { logoUrl: ["Logo invalide"] }, values };

  const admin = createAdminClient();
  const { data: created, error } = await admin.from("organizations").insert({
    name: d.name, short_name: d.shortName, legal_form: d.legalForm, registration_number: d.registration, tax_id: d.taxId, industry: d.sector,
    description: d.description, country: d.country, city: d.city, commune: d.commune, address: d.address, billing_email: d.contactEmail,
    logo_url: d.logoUrl, primary_color: d.primaryColor, secondary_color: d.secondaryColor,
    status: d.status, partnership_type: d.partnership, allow_enrollments: d.allowEnrollments, invoicing_enabled: d.invoicing,
  }).select("id").single<{ id: string }>();
  if (error || !created) {
    if (error?.code === "23505") return { fieldErrors: { registration: ["Ce numéro RCCM est déjà enregistré"] }, values };
    return { error: "Impossible d’enregistrer l’entreprise. Vérifiez les informations.", values };
  }

  const contacts = [{ organization_id: created.id, kind: "primary", full_name: d.contactName, job_title: d.contactRole, phone: d.contactPhone, email: d.contactEmail }];
  if (d.hasSecondary) contacts.push({ organization_id: created.id, kind: "secondary", full_name: d.contact2Name!, job_title: d.contact2Role, phone: d.contact2Phone, email: d.contact2Email } as typeof contacts[number]);
  await admin.from("organization_contacts").insert(contacts);
  await admin.from("audit_logs").insert({ actor_id: user.id, action: "company.create", entity_type: "organization", entity_id: created.id, metadata: { status: d.status, partnership: d.partnership } });
  revalidatePath("/admin/entreprises");
  redirect("/admin/entreprises?resultat=creee");
}
