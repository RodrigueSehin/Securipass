import Link from "next/link";
import { ArrowRight, BarChart3, FileText, GraduationCap, Star, Users, UsersRound } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { LEARNER_TESTIMONIALS, WHY_POINTS } from "@/content/trainers";
import { cn } from "@/lib/utils";

const WHY_ICONS = { file: FileText, users: UsersRound, graduation: GraduationCap, chart: BarChart3 } as const;

export function WhySection() {
  return (
    <section aria-labelledby="why-title">
      <h2 id="why-title" className="text-2xl font-extrabold text-brand-dark">Pourquoi nos formateurs font la différence ?</h2>
      <ul className="mt-4 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {WHY_POINTS.map((p) => {
          const Icon = WHY_ICONS[p.icon];
          return (
            <li key={p.title} className="flex items-center gap-4">
              <span className={cn("flex h-[52px] w-[52px] shrink-0 items-center justify-center rounded-xl text-white", p.tone)}><Icon className="h-6 w-6" aria-hidden /></span>
              <div>
                <h3 className="font-bold text-brand-dark">{p.title}</h3>
                <p className="text-sm leading-snug text-muted">{p.text}</p>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/** Avis d'apprenants : section absente tant qu'aucun avis authentique n'est renseigné. */
export function LearnerTestimonials() {
  if (LEARNER_TESTIMONIALS.length === 0) return null;
  return (
    <section aria-labelledby="learners-title">
      <div className="flex items-end justify-between gap-4">
        <h2 id="learners-title" className="text-2xl font-extrabold text-brand-dark">Témoignages de nos apprenants</h2>
        <Link href="/formations" className="inline-flex items-center gap-1.5 text-sm font-semibold text-brand hover:underline">Voir tous les témoignages <ArrowRight className="h-4 w-4" aria-hidden /></Link>
      </div>
      <ul className="mt-4 grid gap-5 md:grid-cols-3">
        {LEARNER_TESTIMONIALS.map((t) => (
          <li key={t.name} className="rounded-xl border border-line bg-white p-5 shadow-card">
            <blockquote className="text-sm text-muted">« {t.quote} »</blockquote>
            <p className="mt-3 text-sm font-bold text-brand-dark">{t.name}</p>
            <p className="text-xs text-muted">{t.role}</p>
            {t.rating && <span className="mt-1 flex gap-0.5" role="img" aria-label={`${t.rating} sur 5`}>{Array.from({ length: t.rating }).map((_, i) => <Star key={i} className="h-3.5 w-3.5 fill-gold text-gold" aria-hidden />)}</span>}
          </li>
        ))}
      </ul>
    </section>
  );
}

export function JoinBand() {
  return (
    <section className="flex flex-col items-start gap-5 rounded-xl bg-brand-dark p-6 text-white md:flex-row md:items-center md:px-8" aria-labelledby="join-title">
      <Users className="hidden h-16 w-16 shrink-0 fill-cta/90 text-cta md:block" strokeWidth={1.25} aria-hidden />
      <div className="flex-1">
        <h2 id="join-title" className="text-2xl font-extrabold">Rejoignez nos formations animées par des experts !</h2>
        <p className="mt-1 max-w-2xl text-white/90 md:text-lg md:leading-snug">Bénéficiez de l’accompagnement de nos formateurs pour développer vos compétences en sécurité, secourisme et prévention des risques.</p>
      </div>
      <ButtonLink href="/formations" variant="cta" className="px-7 py-3.5 text-base">Découvrir nos formations <ArrowRight className="h-4 w-4" aria-hidden /></ButtonLink>
    </section>
  );
}
