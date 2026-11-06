import { PageHero, Section } from "./page-hero";
import { Alert } from "@/components/ui/feedback";

/** Page légale : trame de travail à faire valider par un conseil juridique avant mise en production. */
export function LegalPage({ title, sections }: { title: string; sections: { heading: string; body: string }[] }) {
  return (
    <>
      <PageHero title={title} />
      <Section>
        <div className="max-w-3xl space-y-6">
          <Alert tone="info">
            Trame provisoire : ce texte doit être complété et validé juridiquement (notamment au regard de la réglementation ivoirienne
            sur la protection des données) avant la mise en production.
          </Alert>
          {sections.map((s) => (
            <div key={s.heading}>
              <h2 className="text-lg font-bold text-brand-dark">{s.heading}</h2>
              <p className="mt-1 text-sm text-muted">{s.body}</p>
            </div>
          ))}
        </div>
      </Section>
    </>
  );
}
