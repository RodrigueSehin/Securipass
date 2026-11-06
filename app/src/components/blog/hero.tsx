import Image from "next/image";
import Link from "next/link";
import { ChevronRight, Quote } from "lucide-react";
import { publicImage } from "@/lib/images";

export function BlogHero() {
  const photo = publicImage("banners/industrial");
  return (
    <section className="relative overflow-hidden bg-brand-dark text-white">
      {photo && (
        <>
          <Image
            src={photo} alt="" width={2000} height={667} priority sizes="900px" aria-hidden
            className="absolute left-[58%] top-0 hidden h-full w-[900px] max-w-none object-cover object-left lg:block [mask-image:linear-gradient(90deg,transparent_0,#000_15%)]"
          />
          <div className="absolute inset-0 hidden bg-[linear-gradient(90deg,#092a66_0%,#092a66_50%,#092a6600_62%)] lg:block" aria-hidden />
        </>
      )}
      <div className="relative mx-auto flex min-h-[210px] max-w-[1384px] flex-col justify-center gap-6 px-4 py-8 lg:flex-row lg:items-center lg:justify-between lg:py-0 lg:pl-[5.8vw]">
        <div>
          <nav aria-label="Fil d’Ariane" className="flex items-center gap-1.5 text-sm text-white/85">
            <Link href="/" className="hover:text-white">Accueil</Link><ChevronRight className="h-3.5 w-3.5" aria-hidden />
            <span aria-current="page" className="text-white">Blog</span>
          </nav>
          <h1 className="mt-4 text-4xl font-extrabold leading-tight lg:text-5xl">Le Blog <span className="text-cta">SECURIPASS</span></h1>
          <p className="mt-2 max-w-[700px] text-lg leading-snug text-white/90 lg:text-xl">Conseils, actualités et bonnes pratiques pour un environnement plus sûr.</p>
        </div>
        <div className="flex max-w-[290px] items-center gap-3 rounded-xl bg-white p-4 text-brand-dark shadow-2xl">
          <Quote className="h-9 w-9 shrink-0 fill-cta text-cta" aria-hidden />
          <p className="text-sm leading-snug text-brand-dark">Informez-vous aujourd’hui pour mieux prévenir demain.</p>
        </div>
      </div>
    </section>
  );
}
