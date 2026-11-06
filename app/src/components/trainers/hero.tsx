import Image from "next/image";
import Link from "next/link";
import { ChevronRight, CogIcon, GraduationCap, Quote, Star, UsersRound } from "lucide-react";
import { HERO_POINTS } from "@/content/trainers";
import { publicImage } from "@/lib/images";

const ICONS = { graduation: GraduationCap, users: UsersRound, cog: CogIcon, star: Star } as const;

export function TrainersHero() {
  const photo = publicImage("banners/industrial");
  return (
    <section className="relative overflow-hidden bg-brand-dark text-white">
      {photo && (
        <>
          <Image
            src={photo} alt="" width={2000} height={667} priority sizes="900px" aria-hidden
            className="absolute left-[44%] top-0 hidden h-full w-[900px] max-w-none object-cover object-left lg:block [mask-image:linear-gradient(90deg,transparent_0,#000_15%)]"
          />
          <div className="absolute inset-0 hidden bg-[linear-gradient(90deg,#092a66_0%,#092a66_44%,#092a6600_58%)] lg:block" aria-hidden />
          <div className="absolute inset-x-0 bottom-0 hidden h-28 bg-gradient-to-t from-brand-dark via-brand-dark/80 to-transparent lg:block" aria-hidden />
        </>
      )}
      <div className="relative mx-auto flex min-h-[300px] max-w-[1384px] flex-col justify-between gap-6 px-4 py-8 lg:py-6 lg:pl-[5.8vw]">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <nav aria-label="Fil d’Ariane" className="flex items-center gap-1.5 text-sm text-white/85">
              <Link href="/" className="hover:text-white">Accueil</Link><ChevronRight className="h-3.5 w-3.5" aria-hidden />
              <span aria-current="page" className="text-white">Formateurs</span>
            </nav>
            <h1 className="mt-4 text-4xl font-extrabold leading-tight lg:text-5xl">Nos formateurs <span className="text-cta">experts</span></h1>
            <p className="mt-3 max-w-[640px] text-lg leading-snug text-white/90 lg:text-xl">Des professionnels de terrain pour une formation de qualité et adaptée à vos besoins.</p>
          </div>
          <div className="flex max-w-[300px] items-center gap-3 rounded-xl bg-white p-4 text-brand-dark shadow-2xl lg:mt-4">
            <Quote className="h-9 w-9 shrink-0 fill-cta text-cta" aria-hidden />
            <p className="text-sm leading-snug">Une équipe de formateurs passionnés, expérimentés, à l’écoute de vos besoins.</p>
          </div>
        </div>
        <ul className="grid grid-cols-2 gap-4 lg:grid-cols-4 lg:gap-8">
          {HERO_POINTS.map((p) => {
            const Icon = ICONS[p.icon];
            return (
              <li key={p.label} className="flex items-center gap-3">
                <Icon className="h-9 w-9 shrink-0" strokeWidth={1.5} aria-hidden />
                <span className="text-sm leading-tight text-white/90"><strong className="block text-base font-semibold text-white">{p.label}</strong>{p.sub}</span>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
