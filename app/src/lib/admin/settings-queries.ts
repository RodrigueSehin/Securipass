import { createClient } from "@/lib/supabase/server";
import type { PlatformSettings } from "./settings";

const COLUMNS = "name, default_language, currency, timezone, sender_email, color_primary, color_secondary, color_accent, updated_at, tagline, description, contact_phone, website, address, date_format, time_format, allow_registrations, email_notifications, sms_notifications, maintenance_mode";

/** Paramètres de la plateforme ; null si la lecture échoue (migration non appliquée, accès refusé). */
export async function loadPlatformSettings(): Promise<PlatformSettings | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("platform_settings").select(COLUMNS).maybeSingle();
  return error || !data ? null : (data as unknown as PlatformSettings);
}
