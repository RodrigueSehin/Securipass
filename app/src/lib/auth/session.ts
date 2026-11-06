import { createClient } from "@/lib/supabase/server";
import { homeForRoles } from "./permissions";

export type SessionInfo = { userId: string; name: string; roles: string[]; home: string } | null;

/** Utilisateur connecté (jeton validé côté serveur) avec ses rôles. À appeler sous <Suspense>. */
export async function getSessionInfo(): Promise<SessionInfo> {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;
    const [{ data: rows }, { data: profile }] = await Promise.all([
      supabase.from("user_roles").select("roles(code)").eq("user_id", user.id),
      supabase.from("profiles").select("full_name").eq("id", user.id).maybeSingle(),
    ]);
    const roles = (rows ?? []).flatMap((r) => {
      const rel = r.roles as unknown as { code: string } | { code: string }[] | null;
      return Array.isArray(rel) ? rel.map((x) => x.code) : rel ? [rel.code] : [];
    });
    return { userId: user.id, name: profile?.full_name || user.email || "Mon compte", roles, home: homeForRoles(roles) };
  } catch {
    return null;
  }
}
