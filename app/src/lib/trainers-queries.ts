import { createClient } from "@/lib/supabase/server";
import type { Trainer } from "@/content/trainers";

type Row = { slug: string; display_name: string; headline: string; bio: string; domain: Trainer["domain"]; tags: string[]; is_demo: boolean };

/** Formateurs publiés (RLS : les visiteurs ne voient que les profils publiés). `failed` distingue une panne d'un annuaire vide. */
export async function listPublishedTrainers(): Promise<{ trainers: Trainer[]; hasDemo: boolean; failed: boolean }> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("trainer_profiles")
    .select("slug, display_name, headline, bio, domain, tags, is_demo")
    .eq("is_published", true)
    .order("display_name")
    .returns<Row[]>();
  const rows = data ?? [];
  return {
    trainers: rows.map((r) => ({ slug: r.slug, name: r.display_name, role: r.headline, bio: r.bio, domain: r.domain, tags: r.tags })),
    hasDemo: rows.some((r) => r.is_demo),
    failed: Boolean(error),
  };
}
