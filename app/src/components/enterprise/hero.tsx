import Image from "next/image";
import Link from "next/link";
import { ArrowRight, BarChart3, Building2, Check, ChevronRight, ClipboardCheck, ShieldCheck, UsersRound } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { ENTERPRISE_HERO_CARD, ENTERPRISE_HERO_POINTS } from "@/content/enterprise";
import { publicImage } from "@/lib/images";

const ICONS = { clipboard: ClipboardCheck, shield: ShieldCheck, users: UsersRound, chart: BarChart3 } as const;

export function EnterpriseHero() {
  const banner = publicImage("banners/industrial");
  return (
    <section className="relative overflow-hidden bg-brand-dark text-white">
      {banner && (
        <>
          {/* Maquette (1440 px) : les deux personnes occupent ~54 % → 81 % de la largeur ; la carte blanche couvre le reste. */}
          <Image src={banner} alt="" width={2000} height={667} priority sizes="900px" className="absolute left-[52.5%] top-0 hidden h-full w-[900px] max-w-none object-cover object-left lg:block" aria-hidden />
          <div className="absolute inset-0 bg-[linear-gradient(90deg,#092a66_0%,#092a66_42%,#092a66cc_52%,#092a6600_62%)]" aria-hidden />
        </>
      )}
      <div className="relative mx-auto grid max-w-[1440px] gap-6 px-4 py-6 lg:grid-cols-[1fr_276px] lg:py-6 lg:pl-[5.8vw] lg:pr-[2.2vw]">
        <div>
          <nav aria-label="Fil d’Ariane" className="flex items-center gap-1.5 text-xs text-white/80">
            <Link href="/" className="hover:text-white">Accueil</Link><ChevronRight className="h-3 w-3" aria-hidden />
            <span aria-current="page" className="text-white">Entreprises</span>
          </nav>
          <h1 className="mt-4 max-w-xl text-4xl font-extrabold leading-[1.1] lg:text-5xl">Formez et sécurisez <span className="block text-cta">vos équipes</span></h1>
          <p className="mt-4 max-w-[680px] text-white/90 md:text-xl md:leading-snug">
            Une solution complète pour la gestion des formations et certifications en sécurité, secourisme et sécurité incendie de vos collaborateurs.
          </p>
          <ul className="mt-6 grid max-w-[640px] grid-cols-2 gap-4 sm:grid-cols-4 sm:gap-0">
            {ENTERPRISE_HERO_POINTS.map((p) => {
              const Icon = ICONS[p.icon];
              return (
                <li key={p.label} className="flex items-center gap-2 sm:border-l sm:border-white/20 sm:pl-3 sm:first:border-l-0 sm:first:pl-0">
                  <Icon className="h-8 w-8 shrink-0" strokeWidth={1.5} aria-hidden />
                  <span className="whitespace-nowrap text-sm leading-tight"><strong className="block font-semibold">{p.label}</strong>{p.sub}</span>
                </li>
              );
            })}
          </ul>
        </div>

        <div className="flex flex-col justify-between gap-4 lg:self-stretch">
          <div className="rounded-xl bg-white p-4 text-brand-dark shadow-2xl">
            <p className="flex items-center gap-3 leading-tight">
              <Building2 className="h-9 w-9 shrink-0 text-cta" strokeWidth={1.5} aria-hidden />
              <span className="text-sm">{ENTERPRISE_HERO_CARD.title}</span>
            </p>
            <ul className="mt-3 space-y-2 text-xs">
              {ENTERPRISE_HERO_CARD.points.map((t) => (
                <li key={t} className="flex items-center gap-2.5">
                  <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-success text-white"><Check className="h-2.5 w-2.5" strokeWidth={3} aria-hidden /></span>{t}
                </li>
              ))}
            </ul>
          </div>
          <ButtonLink href="#devis" variant="cta" className="w-full whitespace-nowrap px-3 py-3 text-sm">
            Demander une offre entreprise <ArrowRight className="h-4 w-4" aria-hidden />
          </ButtonLink>
        </div>
      </div>
    </section>
  );
}
