import Image from "next/image";
import { Star } from "lucide-react";
import { PARTNERS, TESTIMONIALS } from "@/content/home";
import { SectionTitle } from "./section-title";

/** Témoignages : section absente tant qu'aucun avis authentique n'est renseigné dans src/content/home.ts. */
export function Testimonials() {
  if (TESTIMONIALS.length === 0) return null;
  return (
    <section className="mx-auto max-w-7xl px-4 pb-14">
      <SectionTitle eyebrow="Ils nous font confiance">Ce que disent nos apprenants</SectionTitle>
      <ul className="mt-8 grid gap-5 md:grid-cols-3">
        {TESTIMONIALS.map((t) => (
          <li key={t.name} className="flex gap-4 rounded-2xl border border-line bg-white p-5 shadow-card">
            {t.photo && <Image src={t.photo} alt="" width={56} height={56} className="h-14 w-14 shrink-0 rounded-full object-cover" />}
            <figure>
              <blockquote className="text-sm text-muted">« {t.quote} »</blockquote>
              <figcaption className="mt-2">
                <span className="block text-sm font-bold text-brand-dark">{t.name}</span>
                <span className="block text-xs text-muted">{t.role}</span>
                {t.rating && (
                  <span className="mt-1 flex gap-0.5" role="img" aria-label={`${t.rating} sur 5`}>
                    {Array.from({ length: t.rating }).map((_, i) => <Star key={i} className="h-3.5 w-3.5 fill-gold text-gold" aria-hidden />)}
                  </span>
                )}
              </figcaption>
            </figure>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** Partenaires : section absente tant qu'aucune organisation consentante n'est renseignée. */
export function Partners() {
  if (PARTNERS.length === 0) return null;
  return (
    <section className="mx-auto max-w-7xl px-4 pb-14">
      <p className="mb-5 flex items-center justify-center gap-3 text-xs font-bold uppercase tracking-widest text-cta">
        <span className="h-px w-8 bg-cta/60" aria-hidden />Nos partenaires<span className="h-px w-8 bg-cta/60" aria-hidden />
      </p>
      <ul className="flex flex-wrap items-center justify-center gap-x-10 gap-y-4">
        {PARTNERS.map((p) => (
          <li key={p.name}>
            {p.href ? (
              <a href={p.href} target="_blank" rel="noopener noreferrer"><Image src={p.logo} alt={p.name} width={120} height={48} className="h-10 w-auto opacity-70 grayscale hover:opacity-100 hover:grayscale-0" /></a>
            ) : (
              <Image src={p.logo} alt={p.name} width={120} height={48} className="h-10 w-auto opacity-70 grayscale" />
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
