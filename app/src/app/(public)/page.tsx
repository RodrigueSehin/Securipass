import { Suspense } from "react";
import { Hero } from "@/components/home/hero";
import { CategoryCards } from "@/components/home/category-cards";
import { StatsBand } from "@/components/home/stats-band";
import { Benefits } from "@/components/home/benefits";
import { FeaturedCourses, FeaturedCoursesFallback } from "@/components/home/featured-courses";
import { EnterpriseBanner } from "@/components/home/enterprise-banner";
import { Partners, Testimonials } from "@/components/home/social-proof";
import { getPublicStats } from "@/lib/stats";

/** Hero + bandeau de chiffres : dépendent des totaux réels (mis en cache une heure). */
async function StatsDependent() {
  const stats = await getPublicStats();
  return (
    <>
      <Hero learners={stats.learners} />
      <CategoryCards />
      <StatsBand stats={stats} />
    </>
  );
}

export default function HomePage() {
  return (
    <>
      <Suspense fallback={<><Hero learners={0} /><CategoryCards /></>}>
        <StatsDependent />
      </Suspense>
      <Benefits />
      <Suspense fallback={<FeaturedCoursesFallback />}>
        <FeaturedCourses />
      </Suspense>
      <EnterpriseBanner />
      <Testimonials />
      <Partners />
    </>
  );
}
