import { createClient } from "@/lib/supabase/server";
import { COURSE_CARD_SELECT } from "@/lib/selects";
import { sortCategories } from "@/content/categories";
import type { Level, Mode } from "./labels";
import type { PublicCourse } from "./types";

export type CourseCard = {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  duration_minutes: number;
  price_amount: number;
  currency: string;
  cover_url: string | null;
  delivery_mode: Mode;
  level: Level;
  published_at: string | null;
  is_demo: boolean;
  featured?: boolean;
  category: { name: string; slug: string } | null;
};

export type Category = { id: string; name: string; slug: string };

const CARD_COLUMNS = COURSE_CARD_SELECT;

/** Dernières formations publiées. La RLS garantit que seules les formations publiées sont visibles. */
export async function getFeaturedCourses(limit = 4): Promise<CourseCard[]> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("courses")
      .select(CARD_COLUMNS)
      .eq("status", "published")
      .order("featured", { ascending: false })
      .order("published_at", { ascending: false })
      .limit(limit)
      .returns<CourseCard[]>();
    if (error) return [];
    return data ?? [];
  } catch {
    return [];
  }
}

export async function getCategories(): Promise<Category[]> {
  try {
    const supabase = await createClient();
    const { data } = await supabase.from("categories").select("id, name, slug").eq("visible_catalogue", true).order("name");
    return sortCategories(data ?? []);
  } catch {
    return [];
  }
}

/** Détail public d'une formation publiée (fonction SQL : contenus et liens sensibles exclus). */
export async function getPublicCourse(slug: string): Promise<PublicCourse | null> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("public_course_detail", { p_slug: slug });
    if (error || !data) return null;
    return data as unknown as PublicCourse;
  } catch {
    return null;
  }
}

/** Toutes les formations publiées (le catalogue filtre, trie et pagine côté serveur sur cette liste). */
export async function getPublishedCourses(): Promise<{ courses: CourseCard[]; failed: boolean }> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("courses")
      .select(CARD_COLUMNS)
      .eq("status", "published")
      .order("published_at", { ascending: false })
      .limit(1000)
      .returns<CourseCard[]>();
    return { courses: data ?? [], failed: Boolean(error) };
  } catch {
    return { courses: [], failed: true };
  }
}

/** Identifiants des formations ayant au moins une session ouverte avec des places. */
export async function getOpenCourseIds(): Promise<Set<string>> {
  try {
    const supabase = await createClient();
    const { data } = await supabase.rpc("courses_with_open_sessions");
    return new Set((data as string[] | null) ?? []);
  } catch {
    return new Set();
  }
}

/** Formations publiées de la même catégorie (hors formation courante), les plus récentes d'abord. */
export async function getSimilarCourses(categorySlug: string | undefined, excludeId: string, limit = 4): Promise<CourseCard[]> {
  if (!categorySlug) return [];
  try {
    const supabase = await createClient();
    const { data: cat } = await supabase.from("categories").select("id").eq("slug", categorySlug).maybeSingle();
    if (!cat) return [];
    const { data } = await supabase
      .from("courses")
      .select(CARD_COLUMNS)
      .eq("status", "published")
      .eq("category_id", cat.id)
      .neq("id", excludeId)
      .order("published_at", { ascending: false })
      .limit(limit)
      .returns<CourseCard[]>();
    return data ?? [];
  } catch {
    return [];
  }
}

/** Indique si une formation publiée est une formation de démonstration (pour afficher la mention obligatoire). */
export async function getIsDemo(slug: string): Promise<boolean> {
  try {
    const supabase = await createClient();
    const { data } = await supabase.from("courses").select("is_demo").eq("slug", slug).eq("status", "published").maybeSingle();
    return Boolean(data?.is_demo);
  } catch {
    return false;
  }
}
