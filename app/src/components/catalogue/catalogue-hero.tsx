import Image from "next/image";
import Link from "next/link";
import { BadgeCheck, ChevronRight, Laptop, UsersRound } from "lucide-react";
import { publicImage } from "@/lib/images";

const POINTS = [
  { Icon: Laptop, text: "Formations en ligne et en présentiel" },
  { Icon: BadgeCheck, text: "Certificats vérifiables en ligne" },
  { Icon: UsersRound, text: "Formateurs experts" },
] as const;

export function CatalogueHero({ breadcrumb = true }: { breadcrumb?: boolean }) {
  const photo = publicImage("home/agent-securite");
  return (
    <section className="relative overflow-hidden bg-brand-dark text-white">
      {photo && (
        <div className="absolute inset-y-0 right-0 w-full opacity-25 md:w-[55%] md:opacity-100" aria-hidden>
          <Image src={photo} alt="" fill priority sizes="(min-width: 768px) 55vw, 100vw" className="object-cover object-[60%_20%]" />
          <div className="absolute inset-0 hidden bg-[linear-gradient(90deg,#092a66_0%,#092a66d9_25%,#092a6600_70%)] md:block" />
        </div>
      )}
      <div className="relative mx-auto max-w-7xl px-4 py-10 md:py-12">
        {breadcrumb && <nav aria-label="Fil d’Ariane" className="flex items-center gap-1.5 text-xs text-white/80">
          <Link href="/" className="hover:text-white">Accueil</Link>
          <ChevronRight className="h-3 w-3" aria-hidden />
          <span aria-current="page" className="text-white">Formations</span>
        </nav>}
        <h1 className="mt-4 text-3xl font-extrabold md:text-5xl">Catalogue des <span className="text-cta">formations</span></h1>
        <p className="mt-3 max-w-2xl text-white/85 md:text-lg">
          Découvrez nos formations certifiantes en sécurité, secourisme et sécurité incendie adaptées aux particuliers, aux entreprises et aux professionnels.
        </p>
        <ul className="mt-6 grid max-w-xl grid-cols-1 gap-3 rounded-xl border border-white/20 bg-white/10 p-3 backdrop-blur sm:grid-cols-3 md:absolute md:bottom-6 md:right-4 md:mt-0 md:w-[28rem] md:max-w-none">
          {POINTS.map(({ Icon, text }) => (
            <li key={text} className="flex items-center gap-2 text-xs leading-tight">
              <Icon className="h-6 w-6 shrink-0" strokeWidth={1.5} aria-hidden />{text}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
