import "server-only";
import { createClient } from "@supabase/supabase-js";

/** Client à clé privilégiée (contourne la RLS). Serveur uniquement : à n'utiliser qu'après contrôle des droits. */
export function createAdminClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error("SUPABASE_SERVICE_ROLE_KEY manquante");
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
