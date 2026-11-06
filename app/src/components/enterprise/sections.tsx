import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Award, Bell, BadgeCheck, BarChart3, Building2, CalendarCheck, Check, ChevronDown, ClipboardCheck, FileText, Puzzle, Star, UsersRound } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import {
  COMPANY_TESTIMONIALS, ENTERPRISE_CTA_POINTS, ENTERPRISE_FAQ, ENTERPRISE_FEATURES, ENTERPRISE_STEPS,
} from "@/content/enterprise";
import { publicImage } from "@/lib/images";
import { cn } from "@/lib/utils";

const FEATURE_ICONS = { users: UsersRound, puzzle: Puzzle, badge: BadgeCheck, bell: Bell, chart: BarChart3, clipboard: ClipboardCheck } as const;
const FEATURE_TONES = { blue: "bg-[#1479ff]", orange: "bg-cta", green: "bg-success", red: "bg-danger", purple: "bg-[#7c4dff]", sky: "bg-[#2b8cff]" } as const;
const STEP_ICONS = { building: Building2, users: UsersRound, file: FileText, calendar: CalendarCheck, award: Award } as const;

export function Features() {
  return (
    <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {ENTERPRISE_FEATURES.map((f) => {
        const Icon = FEATURE_ICONS[f.icon];
        return (
          <li key={f.title} className="rounded-2xl border border-line bg-white p-5 shadow-card">
            <span className={cn("flex h-11 w-11 items-center justify-center rounded-xl text-white", FEATURE_TONES[f.tone])}><Icon className="h-5 w-5" aria-hidden /></span>
            <h3 className="mt-3 font-bold text-brand-dark">{f.title}</h3>
            <p className="mt-1 text-sm text-muted">{f.text}</p>
          </li>
        );
      })}
    </ul>
  );
}

export function Steps() {
  return (
    <section aria-labelledby="steps-title">
      <h2 id="steps-title" className="text-2xl font-extrabold text-brand-dark md:text-3xl">Comment ça marche ?</h2>
      <p className="mt-1 text-muted">Mettez en place votre programme de formation en quelques étapes simples.</p>
      <ol className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-5 lg:gap-4">
        {ENTERPRISE_STEPS.map((s, i) => {
          const Icon = STEP_ICONS[s.icon];
          return (
            <li key={s.title}>
              <div className="flex items-center gap-3">
                <span className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-lg font-extrabold text-white", s.tone)}>{i + 1}</span>
                <Icon className="h-9 w-9 text-brand" strokeWidth={1.5} aria-hidden />
                {i < ENTERPRISE_STEPS.length - 1 && <ArrowRight className="mx-auto hidden h-5 w-12 text-line lg:block" strokeWidth={1.25} aria-hidden />}
              </div>
              <h3 className="mt-3 text-sm font-bold text-brand-dark">{s.title}</h3>
              <p className="mt-0.5 text-xs text-muted">{s.text}</p>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

/** Témoignages d'entreprises : section absente tant qu'aucun avis authentique n'est renseigné. */
export function CompanyTestimonials() {
  if (COMPANY_TESTIMONIALS.length === 0) return null;
  return (
    <section aria-labelledby="testimonials-title">
      <h2 id="testimonials-title" className="text-2xl font-extrabold text-brand-dark md:text-3xl">Témoignages d’entreprises</h2>
      <ul className="mt-6 grid gap-5 md:grid-cols-3">
        {COMPANY_TESTIMONIALS.map((t) => (
          <li key={t.name} className="rounded-2xl border border-line bg-white p-5 shadow-card">
            <blockquote className="text-sm text-muted">« {t.quote} »</blockquote>
            <p className="mt-3 text-sm font-bold text-brand-dark">{t.name}</p>
            <p className="text-xs text-muted">{t.role} · {t.company}</p>
            {t.rating && <span className="mt-1 flex gap-0.5" role="img" aria-label={`${t.rating} sur 5`}>{Array.from({ length: t.rating }).map((_, i) => <Star key={i} className="h-3.5 w-3.5 fill-gold text-gold" aria-hidden />)}</span>}
          </li>
        ))}
      </ul>
    </section>
  );
}

export function Faq({ items = ENTERPRISE_FAQ, subtitle, moreHref = "/contact" }: { items?: readonly { q: string; a: string }[]; subtitle?: string; moreHref?: string | null } = {}) {
  return (
    <section aria-labelledby="faq-title">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h2 id="faq-title" className="text-2xl font-extrabold text-brand-dark md:text-3xl">Questions fréquentes</h2>
          {subtitle && <p className="mt-1 text-muted">{subtitle}</p>}
        </div>
        {moreHref && <Link href={moreHref} className="inline-flex items-center gap-1.5 text-sm font-semibold text-brand hover:underline">Voir toutes les questions <ArrowRight className="h-4 w-4" aria-hidden /></Link>}
      </div>
      <div className="mt-4 grid gap-3 lg:grid-flow-col lg:grid-cols-2 lg:grid-rows-3">
        {items.map((f) => (
          <details key={f.q} className="group rounded-xl border border-line bg-white open:shadow-card">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3.5 font-semibold text-brand-dark [&::-webkit-details-marker]:hidden">
              {f.q}<ChevronDown className="h-4 w-4 shrink-0 transition-transform group-open:rotate-180" aria-hidden />
            </summary>
            <p className="border-t border-line px-4 py-3 text-sm leading-relaxed text-muted">{f.a}</p>
          </details>
        ))}
      </div>
    </section>
  );
}

export function CtaBand() {
  const banner = publicImage("banners/collaborative");
  return (
    <section className="relative overflow-hidden bg-brand-dark text-white md:min-h-[214px]" aria-labelledby="cta-title">
      {banner && (
        <>
          {/* Maquette = page de 1440 px réduite à 1024 px (×1,406) : bannière de 1237 px, décalée de 101 px à gauche et de 17 px vers
              le haut ; seules les deux personnes de gauche restent visibles. Le masque fond l'image dans le bleu nuit. */}
          <Image
            src={banner} alt="" width={2000} height={667} sizes="1237px" aria-hidden
            className="absolute -top-[17px] left-[101px] hidden h-auto w-[1237px] max-w-none md:block [mask-image:linear-gradient(90deg,transparent_0,#000_110px,#000_260px,transparent_430px)]"
          />
        </>
      )}
      <div className="relative mx-auto grid max-w-7xl items-center gap-6 px-4 py-8 md:min-h-[214px] md:grid-cols-[487px_minmax(0,1fr)_auto] md:gap-x-0">
        <div aria-hidden className="hidden md:block" />
        <div>
          <h2 id="cta-title" className="text-2xl font-extrabold leading-tight">Prêt à former et certifier <span className="block text-cta">vos équipes ?</span></h2>
          <p className="mt-2 max-w-md text-sm leading-snug text-white/90">Demandez une offre personnalisée et découvrez comment SECURIPASS peut accompagner votre entreprise.</p>
          <div className="mt-4 flex flex-wrap gap-3">
            <ButtonLink href="#devis" variant="cta" className="px-5 py-2.5">Demander une offre entreprise <ArrowRight className="h-4 w-4" aria-hidden /></ButtonLink>
            <ButtonLink href="/contact" variant="ghost" className="border border-white/70 px-6 py-2.5 text-white hover:bg-white/10">Nous contacter</ButtonLink>
          </div>
        </div>
        <ul className="space-y-2.5">
          {ENTERPRISE_CTA_POINTS.map((p) => (
            <li key={p} className="flex items-center gap-3 text-sm">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-cta text-white"><Check className="h-3 w-3" strokeWidth={3} aria-hidden /></span>{p}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
