import { Suspense } from "react";
import type { Metadata } from "next";
import { RequestForm } from "@/components/public/request-form";
import { TrainerDirectory } from "@/components/trainers/directory";
import { TrainersHero } from "@/components/trainers/hero";
import { JoinBand, LearnerTestimonials, WhySection } from "@/components/trainers/sections";

export const metadata: Metadata = { title: "Nos formateurs" };

// searchParams est une donnée dynamique : elle est lue sous Suspense (règle du projet, cacheComponents).
export default function TrainersPage({ searchParams }: { searchParams: Promise<{ domaine?: string; q?: string }> }) {
  return (
    <Suspense fallback={null}>
      <TrainersContent searchParams={searchParams} />
    </Suspense>
  );
}

async function TrainersContent({ searchParams }: { searchParams: Promise<{ domaine?: string; q?: string }> }) {
  const sp = await searchParams;
  return (
    <>
      <TrainersHero />
      <div className="mx-auto max-w-[1384px] space-y-10 px-4 py-8">
        <TrainerDirectory domain={sp.domaine} q={sp.q?.trim().slice(0, 80) || undefined} />
        <WhySection />
        <LearnerTestimonials />

        <section id="candidature" className="scroll-mt-28 rounded-2xl bg-surface p-6 md:p-8" aria-labelledby="apply-title">
          <h2 id="apply-title" className="text-2xl font-extrabold text-brand-dark">Devenir formateur</h2>
          <div className="mt-5 grid gap-8 lg:grid-cols-[1fr_1.2fr]">
            <div>
              <h3 className="font-bold text-brand-dark">Critères d’admission et processus</h3>
              <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm text-muted">
                <li>Vous déposez votre candidature avec votre spécialité et votre expérience.</li>
                <li>Notre équipe pédagogique étudie votre profil et vous demande les justificatifs applicables à votre domaine (qualifications, agréments, attestations).</li>
                <li>Vos qualifications déclarées sont vérifiées avant d’être mises en avant ; elles ne sont jamais présentées comme certifiées par SECURIPASS sans vérification.</li>
                <li>Vos formations sont validées par un responsable pédagogique avant publication.</li>
              </ol>
              <p className="mt-4 text-sm text-muted">Un espace complet : formations, contenus, sessions, présences, évaluations, rapports et certificats vérifiables.</p>
            </div>
            <RequestForm kind="trainer_application" />
          </div>
        </section>

        <JoinBand />
      </div>
    </>
  );
}
