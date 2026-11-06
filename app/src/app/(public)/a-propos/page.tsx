import { Suspense } from "react";
import type { Metadata } from "next";
import { AboutHero } from "@/components/about/hero";
import { AboutCta, Domains, Milestones, Pillars, Story, Team, WhyAndCommitment } from "@/components/about/sections";
import { getPublicStats } from "@/lib/stats";

export const metadata: Metadata = { title: "À propos" };

/** Récit et chiffres réels : les totaux viennent de la base (mis en cache une heure), jamais écrits en dur. */
async function StoryWithStats() {
  return <Story stats={await getPublicStats()} />;
}

export default function AboutPage() {
  return (
    <>
      <AboutHero />
      <div className="mx-auto max-w-7xl space-y-14 px-4 py-10">
        <Suspense fallback={<Story stats={{ courses: 0, learners: 0, companies: 0 }} />}>
          <StoryWithStats />
        </Suspense>
        <Pillars />
        <Domains />
        <WhyAndCommitment />
        <Milestones />
        <Team />
        <AboutCta />
      </div>
    </>
  );
}
