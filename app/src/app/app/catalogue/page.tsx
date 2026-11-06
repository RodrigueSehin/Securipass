import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { CatalogueHero } from "@/components/catalogue/catalogue-hero";
import { CatalogueListing } from "@/components/catalogue/catalogue-listing";
import { categoryUi } from "@/content/categories";
import { getCategories, getPublishedCourses } from "@/lib/courses/queries";
import { getCoursePopularity } from "@/lib/courses/popularity";
import type { RawParams } from "@/lib/courses/filters";
import { createClient } from "@/lib/supabase/server";
import { formatFcfa } from "@/lib/utils";

export const metadata: Metadata = { title: "Catalogue" };

type SP = Promise<RawParams>;

const ACTIVE = ["confirmed", "completed", "waitlisted", "pending_payment", "pending_approval", "suspended"];

/** Formations de l'apprenant : inscriptions en cours, en attente ou terminées. */
async function enrolledCourseIds(userId: string): Promise<Set<string>> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("enrollments")
    .select("course_id")
    .eq("learner_id", userId)
    .in("status", ACTIVE)
    .returns<{ course_id: string }[]>();
  return new Set((data ?? []).map((e) => e.course_id));
}

/** Colonne latérale : catégories avec leur nombre réel de formations, et formations les plus suivies. */
async function Aside({ enrolled }: { enrolled: ReadonlySet<string> }) {
  const [{ courses }, categories, popularity] = await Promise.all([getPublishedCourses(), getCategories(), getCoursePopularity()]);
  const byCategory = new Map<string, number>();
  for (const c of courses) if (c.category) byCategory.set(c.category.slug, (byCategory.get(c.category.slug) ?? 0) + 1);
  const popular = [...courses]
    .filter((c) => (popularity[c.id] ?? 0) > 0)
    .sort((a, b) => (popularity[b.id] ?? 0) - (popularity[a.id] ?? 0))
    .slice(0, 3);

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-line bg-white p-5">
        <h2 className="mb-3 font-bold text-brand-dark">Catégories de formations</h2>
        <ul className="space-y-1">
          <li><Link href="/app/catalogue" className="flex justify-between rounded-lg px-3 py-2 text-sm font-medium text-brand-dark hover:bg-brand-soft"><span>Toutes les formations</span><span className="text-muted">{courses.length}</span></Link></li>
          {categories.map((c) => (
            <li key={c.id}>
              <Link href={`/app/catalogue?categorie=${c.slug}`} className="flex justify-between rounded-lg px-3 py-2 text-sm font-medium text-brand-dark hover:bg-brand-soft">
                <span>{categoryUi(c.slug, c.name).label}</span><span className="text-muted">{byCategory.get(c.slug) ?? 0}</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      {popular.length > 0 && (
        <section className="rounded-2xl border border-line bg-white p-5">
          <h2 className="mb-3 font-bold text-brand-dark">Formations les plus suivies</h2>
          <ul className="space-y-4">
            {popular.map((c) => (
              <li key={c.id}>
                <Link href={enrolled.has(c.id) ? `/app/formations/${c.id}` : `/formations/${c.slug}`} className="block hover:underline">
                  <span className="block text-sm font-semibold text-brand-dark">{c.title}</span>
                  <span className="text-xs text-muted">{popularity[c.id]} inscrit{(popularity[c.id] ?? 0) > 1 ? "s" : ""} · {c.price_amount === 0 ? "Gratuit" : formatFcfa(c.price_amount)}</span>
                </Link>
              </li>
            ))}
          </ul>
          <Link href="/app/catalogue?tri=populaires" className="mt-4 block rounded-lg border border-brand px-4 py-2 text-center text-sm font-semibold text-brand hover:bg-brand-soft">Voir les plus suivies</Link>
        </section>
      )}
    </div>
  );
}

async function Listing({ searchParams }: { searchParams: SP }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/connexion?redirect=/app/catalogue");
  const enrolled = await enrolledCourseIds(user.id);
  return (
    <CatalogueListing
      searchParams={searchParams}
      basePath="/app/catalogue"
      enrolledIds={enrolled}
      aside={<Suspense fallback={null}><Aside enrolled={enrolled} /></Suspense>}
    />
  );
}

export default function LearnerCataloguePage({ searchParams }: { searchParams: SP }) {
  return (
    <>
      <CatalogueHero breadcrumb={false} />
      <Suspense fallback={<div className="mx-auto h-96 max-w-7xl animate-pulse px-4 py-6" aria-hidden />}>
        <Listing searchParams={searchParams} />
      </Suspense>
    </>
  );
}
