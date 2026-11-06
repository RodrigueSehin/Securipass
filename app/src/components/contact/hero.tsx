import Image from "next/image";
import Link from "next/link";
import { ChevronRight, Headset } from "lucide-react";
import { publicImage } from "@/lib/images";

export function ContactHero() {
  const photo = publicImage("contact/equipe");
  return (
    <section className="relative overflow-hidden bg-brand-dark text-white">
      {photo && (
        <>
          {/* Photo à droite, fondue vers le bleu nuit côté texte (maquette : visage à ~60 % de la largeur). */}
          <Image
            src={photo} alt="" width={1536} height={1024} priority sizes="(min-width: 1024px) 66vw, 100vw" aria-hidden
            className="absolute right-[8%] top-0 hidden h-full w-[66%] object-cover object-[50%_25%] lg:block [mask-image:linear-gradient(90deg,transparent_0,#000_40%,#000_88%,transparent_100%)]"
          />
          <div className="absolute inset-0 hidden bg-[linear-gradient(90deg,#092a66_0%,#092a66_42%,#092a6600_62%)] lg:block" aria-hidden />
        </>
      )}
      <div className="relative mx-auto flex min-h-[242px] max-w-[1384px] flex-col justify-center gap-6 px-4 py-8 lg:flex-row lg:items-center lg:justify-between lg:py-0 lg:pl-[5.8vw]">
        <div>
          <nav aria-label="Fil d’Ariane" className="flex items-center gap-1.5 text-sm text-white/85">
            <Link href="/" className="hover:text-white">Accueil</Link><ChevronRight className="h-3.5 w-3.5" aria-hidden />
            <span aria-current="page" className="text-white">Contact</span>
          </nav>
          <h1 className="mt-4 text-4xl font-extrabold leading-tight lg:text-5xl">Contactez <span className="text-cta">SECURIPASS</span></h1>
          <p className="mt-3 max-w-[640px] text-lg leading-snug text-white/90 lg:text-xl">
            Une question, un besoin d’information ou un projet de formation ? Notre équipe est à votre écoute.
          </p>
        </div>
        <div className="flex max-w-[270px] gap-3 rounded-xl bg-white p-4 text-brand-dark shadow-2xl">
          <Headset className="h-9 w-9 shrink-0 text-cta" strokeWidth={1.5} aria-hidden />
          <p className="text-xs leading-snug text-muted"><strong className="block text-sm text-brand-dark">Une équipe à votre écoute</strong>pour vous accompagner dans votre projet de formation individuelle ou d’entreprise.</p>
        </div>
      </div>
    </section>
  );
}
