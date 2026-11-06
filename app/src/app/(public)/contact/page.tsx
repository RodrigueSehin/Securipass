import { Suspense } from "react";
import type { Metadata } from "next";
import { ContactHero } from "@/components/contact/hero";
import { ContactForm } from "@/components/contact/form";
import { DetailsCard, InfoCards, MapCard, Topics } from "@/components/contact/sections";
import { Faq } from "@/components/enterprise/sections";
import { CONTACT_FAQ } from "@/content/contact";
import { CONTACT_TOPICS } from "@/lib/requests/schemas";

export const metadata: Metadata = { title: "Contact" };

// searchParams est une donnée dynamique : elle est lue sous Suspense (règle du projet, cacheComponents).
export default function ContactPage({ searchParams }: { searchParams: Promise<{ type?: string }> }) {
  return (
    <Suspense fallback={null}>
      <ContactContent searchParams={searchParams} />
    </Suspense>
  );
}

async function ContactContent({ searchParams }: { searchParams: Promise<{ type?: string }> }) {
  const { type } = await searchParams;
  const defaultTopic = CONTACT_TOPICS.some((t) => t.value === type) ? type : undefined;

  return (
    <>
      <ContactHero />
      <div className="mx-auto max-w-[1384px] space-y-8 px-4 py-8">
        <InfoCards />

        <div className="grid items-stretch gap-6 lg:grid-cols-[1.22fr_1fr]">
          <section id="message" className="scroll-mt-28 rounded-xl border border-line bg-white p-6 shadow-card" aria-labelledby="form-title">
            <h2 id="form-title" className="text-2xl font-extrabold text-brand-dark">Envoyez-nous un message</h2>
            <p className="mb-5 mt-1 text-muted">Remplissez le formulaire ci-dessous et notre équipe vous répondra dans les plus brefs délais.</p>
            <ContactForm key={defaultTopic} defaultTopic={defaultTopic} />
          </section>
          <div className="flex flex-col gap-4">
            <MapCard />
            <DetailsCard />
          </div>
        </div>

        <Topics />
        <Faq items={CONTACT_FAQ} subtitle="Trouvez rapidement des réponses à vos questions." moreHref={null} />
      </div>
    </>
  );
}
