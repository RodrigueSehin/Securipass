import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createTestDb, type TestDb } from "./pg-harness";

let db: TestDb;
beforeAll(async () => { db = await createTestDb(); }, 120_000);
afterAll(async () => { await db.close(); });

async function signup(email: string, meta: Record<string, unknown>) {
  const u = await db.query<{ id: string }>(`insert into auth.users (email, raw_user_meta_data) values ($1,$2) returning id`, [email, JSON.stringify(meta)]);
  const id = u.rows[0].id;
  const p = await db.query<Record<string, unknown>>(`select * from public.profiles where id=$1`, [id]);
  const r = await db.query<{ code: string }>(`select r.code from public.user_roles ur join public.roles r on r.id=ur.role_id where ur.user_id=$1`, [id]);
  return { profile: p.rows[0], roles: r.rows.map((x) => x.code) };
}

describe("handle_new_user (inscription)", () => {
  it("enregistre les informations valides et le consentement", async () => {
    const { profile, roles } = await signup("a@x.ci", {
      full_name: "Awa Koné", phone: "+225 07 07 07 07 07", birth_date: "1995-04-12", situation: "employee",
      interests: ["secourisme", "securite-incendie"], notify_email: true, notify_sms: false, terms_accepted: true, terms_version: "2026-10",
    });
    expect(profile).toMatchObject({ full_name: "Awa Koné", phone: "+225 07 07 07 07 07", situation: "employee", terms_version: "2026-10" });
    expect(String(profile.birth_date)).toContain("1995");
    expect(profile.terms_accepted_at).toBeTruthy();
    expect(profile.preferences).toEqual({ interests: ["secourisme", "securite-incendie"], notify_email: true, notify_sms: false });
    expect(roles).toEqual(["learner"]);
  });

  it("ignore toute tentative d'élévation de rôle dans les métadonnées", async () => {
    const { roles } = await signup("b@x.ci", { full_name: "Pirate", role: "admin", roles: ["admin"], user_roles: ["admin"] });
    expect(roles).toEqual(["learner"]);
  });

  it("neutralise les valeurs invalides au lieu d'échouer ou de les stocker", async () => {
    const { profile } = await signup("c@x.ci", {
      full_name: "x".repeat(500), birth_date: "pas une date", situation: "roi", phone: "9".repeat(80),
      interests: ["ok-slug", "<script>", "../../etc", "Majuscule", ...Array.from({ length: 30 }, (_, i) => `t${i}`)],
      notify_email: "peut-être", terms_accepted: "oui",
    });
    expect(String(profile.full_name).length).toBe(120);
    expect(profile.birth_date).toBeNull();
    expect(profile.situation).toBeNull();
    expect(String(profile.phone).length).toBe(20);
    const prefs = profile.preferences as { interests: string[]; notify_email: boolean };
    expect(prefs.interests.length).toBeLessThanOrEqual(10);
    expect(prefs.interests).toContain("ok-slug");
    expect(prefs.interests.some((i) => /[<>.A-Z/]/.test(i))).toBe(false);
    expect(prefs.notify_email).toBe(true); // valeur inconnue : défaut
    expect(profile.terms_accepted_at).toBeNull(); // « oui » n'est pas un consentement valide
  });

  it("refuse une date de naissance dans le futur ou antérieure à 1900", async () => {
    expect((await signup("d@x.ci", { birth_date: "2999-01-01" })).profile.birth_date).toBeNull();
    expect((await signup("e@x.ci", { birth_date: "1800-01-01" })).profile.birth_date).toBeNull();
  });

  it("fonctionne sans aucune métadonnée (création par l'administration)", async () => {
    const { profile, roles } = await signup("f@x.ci", {});
    expect(profile).toMatchObject({ full_name: "", phone: null, situation: null });
    expect(profile.preferences).toEqual({ interests: [], notify_email: true, notify_sms: false });
    expect(roles).toEqual(["learner"]);
  });
});
