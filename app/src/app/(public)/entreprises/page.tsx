import type { Metadata } from "next";
import { EnterpriseHero } from "@/components/enterprise/hero";
import { EnterprisePreview } from "@/components/enterprise/preview";
import { CompanyTestimonials, CtaBand, Faq, Features, Steps } from "@/components/enterprise/sections";
import { Partners } from "@/components/home/social-proof";
import { RequestForm } from "@/components/public/request-form";

export const metadata: Metadata = { title: "Entreprises" };

export default function CompaniesPage() {
  return (
    <>
      <EnterpriseHero />

      <div className="mx-auto max-w-7xl space-y-14 px-4 py-12">
        <section className="grid gap-8 lg:grid-cols-[1fr_1.05fr]" aria-labelledby="platform-title">
          <div>
            <h2 id="platform-title" className="text-2xl font-extrabold leading-tight text-brand-dark md:text-3xl">Une plateforme pensée <br className="hidden md:block" />pour les entreprises</h2>
            <p className="mt-3 max-w-lg text-muted">
              Simplifiez la gestion des formations de vos employés, suivez les certifications et gardez la trace des exigences en matière de sécurité.
            </p>
            <div className="mt-6"><Features /></div>
          </div>
          <EnterprisePreview />
        </section>

        <Steps />
      </div>

      {/* Partenaires et témoignages : affichés uniquement s'ils sont authentiques et renseignés. */}
      <Partners />
      <div className="mx-auto max-w-7xl px-4"><CompanyTestimonials /></div>

      <div className="mx-auto max-w-7xl space-y-14 px-4 py-12">
        <Faq />
        <section id="devis" className="scroll-mt-28 rounded-2xl bg-surface p-6 md:p-8" aria-labelledby="quote-title">
          <h2 id="quote-title" className="text-2xl font-extrabold text-brand-dark md:text-3xl">Demander une offre entreprise</h2>
          <p className="mt-1 max-w-2xl text-muted">Décrivez votre besoin : notre équipe vous répond avec une proposition adaptée.</p>
          <div className="mt-6 max-w-3xl"><RequestForm kind="quote" /></div>
        </section>
      </div>

      <CtaBand />
    </>
  );
}
