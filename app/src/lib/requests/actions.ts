"use server";

import { headers } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";
import type { FormState } from "@/lib/auth/actions";
import { isRateLimited, requestSchema } from "./schemas";

const HOUR_MS = 3_600_000;
const NEWSLETTER_OK = "Merci, votre inscription à la newsletter est enregistrée.";

export async function submitRequest(_prev: FormState, formData: FormData): Promise<FormState> {
  const raw = Object.fromEntries(formData);
  const values = Object.fromEntries(
    Object.entries(raw).filter(([, v]) => typeof v === "string") as [string, string][],
  );
  const parsed = requestSchema.safeParse(raw);
  if (!parsed.success) return { fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>, values };

  const { kind, fullName, email, phone, message, website, ...extra } = parsed.data as typeof parsed.data & {
    website?: string;
    phone?: string;
  };

  // Champ piège rempli : on répond comme si tout allait bien, sans rien enregistrer.
  if (website) return { message: kind === "newsletter" ? NEWSLETTER_OK : "Merci, votre demande a bien été transmise." };

  const h = await headers();
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || null;
  const db = createAdminClient();
  const since = new Date(Date.now() - HOUR_MS).toISOString();

  // Pas de `head: true` : ces requêtes masquent les erreurs et feraient échouer la limite « ouverte ».
  const [byEmail, byIp] = await Promise.all([
    db.from("public_requests").select("id", { count: "exact" }).eq("email", email).gte("created_at", since).limit(1),
    ip
      ? db.from("public_requests").select("id", { count: "exact" }).eq("ip_address", ip).gte("created_at", since).limit(1)
      : Promise.resolve({ count: 0, error: null }),
  ]);
  if (byEmail.error || byIp.error) {
    return { error: "Service momentanément indisponible. Réessayez dans quelques instants.", values };
  }
  if (isRateLimited({ byEmail: byEmail.count ?? 0, byIp: byIp.count ?? 0 })) {
    return { error: "Trop de demandes envoyées. Réessayez dans une heure.", values };
  }

  const { subject, organization, ...payload } = extra as Record<string, unknown>;
  const { error } = await db.from("public_requests").insert({
    kind,
    full_name: fullName,
    email,
    phone: phone ?? null,
    organization: typeof organization === "string" ? organization : null,
    subject: typeof subject === "string" ? subject : null,
    message,
    payload,
    ip_address: ip,
  });
  if (error) return { error: "Votre demande n’a pas pu être enregistrée. Réessayez plus tard.", values };

  return { message: kind === "newsletter" ? NEWSLETTER_OK : "Merci, votre demande a bien été transmise. Nous vous répondrons rapidement." };
}
