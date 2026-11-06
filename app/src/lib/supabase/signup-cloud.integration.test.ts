// Vérifie sur le projet Supabase configuré que le déclencheur d'inscription (migration 4) enregistre le profil
// avec les métadonnées produites par l'application, et neutralise celles d'un client malveillant.
// Ignoré tant que la migration 4 n'a pas été exécutée. Les comptes sont créés par l'API d'administration (aucun e-mail envoyé).
import { createClient } from "@supabase/supabase-js";
import { afterAll, describe, expect, it } from "vitest";
import { buildSignupMetadata, registerSchema, TERMS_VERSION } from "@/lib/auth/schemas";
import { cleanupTestUsers } from "@/test/cleanup";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const configured = Boolean(url && serviceKey);
const admin = configured ? createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } }) : null;
const applied = admin ? !(await admin.from("profiles").select("birth_date").limit(1)).error : false;

const run = Date.now();

describe.skipIf(!applied)("Inscription : profil créé par le déclencheur", () => {
  const db = admin!;
  const created: string[] = [];
  afterAll(async () => { await cleanupTestUsers(db, created); });

  async function signup(tag: string, metadata: Record<string, unknown>) {
    const { data, error } = await db.auth.admin.createUser({
      email: `signup-${tag}-${run}@example.test`, password: `Test-Passw0rd-${run}`, email_confirm: true, user_metadata: metadata,
    });
    if (error) throw error;
    created.push(data.user.id);
    const { data: profile } = await db.from("profiles").select("*").eq("id", data.user.id).single();
    const { data: roles } = await db.from("user_roles").select("roles(code)").eq("user_id", data.user.id);
    return { profile: profile!, roles: (roles ?? []).map((r) => (r.roles as unknown as { code: string }).code) };
  }

  it("enregistre date de naissance, situation, préférences et consentement envoyés par l'application", async () => {
    const parsed = registerSchema.parse({
      fullName: "Awa Koné", birthDate: "1995-04-12", email: "awa@exemple.test", phone: "+225 07 07 07 07 07",
      password: "Motdepasse2026", confirmPassword: "Motdepasse2026", acceptTerms: "on",
      situation: "employee", interests: ["secourisme", "securite-incendie"], notifyEmail: "on",
    });
    const { profile, roles } = await signup("ok", buildSignupMetadata(parsed));
    expect(profile).toMatchObject({ full_name: "Awa Koné", phone: "+225 07 07 07 07 07", situation: "employee", terms_version: TERMS_VERSION });
    expect(profile.birth_date).toBe("1995-04-12");
    expect(profile.terms_accepted_at).toBeTruthy();
    expect(profile.preferences).toEqual({ interests: ["secourisme", "securite-incendie"], notify_email: true, notify_sms: false });
    expect(roles).toEqual(["learner"]);
  });

  it("neutralise des métadonnées falsifiées (élévation de rôle, valeurs invalides)", async () => {
    const { profile, roles } = await signup("evil", {
      full_name: "x".repeat(400), role: "admin", roles: ["admin"], birth_date: "pas-une-date", situation: "roi",
      interests: ["<script>", "ok-slug"], terms_accepted: "oui",
    });
    expect(roles).toEqual(["learner"]);
    expect(String(profile.full_name).length).toBe(120);
    expect(profile.birth_date).toBeNull();
    expect(profile.situation).toBeNull();
    expect((profile.preferences as { interests: string[] }).interests).toEqual(["ok-slug"]);
    expect(profile.terms_accepted_at).toBeNull();
  });
});
