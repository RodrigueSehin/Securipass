import Image from "next/image";
import Link from "next/link";
import { ChevronRight, Quote } from "lucide-react";
import { publicImage } from "@/lib/images";

export function AboutHero() {
  const photo = publicImage("home/hero");
  return (
    <section className="relative overflow-hidden bg-brand-dark text-white">
      {photo && (
        <div className="absolute inset-y-0 right-0 w-full opacity-25 md:w-[58%] md:opacity-100" aria-hidden>
          <Image src={photo} alt="" fill priority sizes="(min-width: 768px) 58vw, 100vw" className="object-cover object-[55%_20%]" />
          <div className="absolute inset-0 hidden bg-[linear-gradient(90deg,#092a66_0%,#092a66d9_22%,#092a6600_60%)] md:block" />
        </div>
      )}
      <div className="relative mx-auto max-w-7xl px-4 py-10 md:py-14">
        <nav aria-label="Fil d’Ariane" className="flex items-center gap-1.5 text-xs text-white/80">
          <Link href="/" className="hover:text-white">Accueil</Link><ChevronRight className="h-3 w-3" aria-hidden />
          <span aria-current="page" className="text-white">À propos</span>
        </nav>
        <h1 className="mt-4 text-4xl font-extrabold md:text-5xl">À propos de <span className="text-cta">SECURIPASS</span></h1>
        <p className="mt-3 max-w-xl text-xl text-white md:text-2xl">Former aujourd’hui des acteurs de la sécurité de demain.</p>
        <p className="mt-4 max-w-xl text-white/85">
          SECURIPASS est une plateforme digitale dédiée à la formation, à la certification et à la gestion des compétences en sécurité, secourisme et sécurité incendie.
        </p>
        <blockquote className="mt-7 flex max-w-xs items-start gap-3 rounded-xl bg-white/95 p-4 text-sm text-brand-dark shadow-xl md:absolute md:right-4 md:top-12 md:mt-0">
          <Quote className="h-8 w-8 shrink-0 fill-brand text-brand" aria-hidden />
          <p>Des compétences certifiées pour des environnements plus sûrs.</p>
        </blockquote>
      </div>
    </section>
  );
}
