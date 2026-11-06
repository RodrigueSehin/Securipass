import Image from "next/image";
import { ArrowRight, Check } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { publicImage } from "@/lib/images";

const POINTS = ["Formations sur site", "Suivi des employés", "Rapports personnalisés", "Accompagnement dédié"];

export function CustomOfferBanner() {
  const photo = publicImage("home/entreprise");
  return (
    <section className="mt-10 overflow-hidden rounded-2xl bg-[linear-gradient(100deg,#eaf2ff_0%,#dbe9ff_100%)]" aria-labelledby="custom-offer">
      <div className="grid items-center gap-6 md:grid-cols-[18rem_1fr_auto]">
        {photo && (
          <div className="relative hidden h-40 md:block" aria-hidden>
            <Image src={photo} alt="" fill sizes="18rem" className="object-cover [mask-image:linear-gradient(to_right,black_70%,transparent)]" />
          </div>
        )}
        <div className={`px-6 py-6 ${photo ? "" : "md:col-span-2"}`}>
          <h2 id="custom-offer" className="text-xl font-extrabold text-brand-dark md:text-2xl">
            Besoin d’une formation sur mesure pour <span className="text-cta">votre entreprise</span> ?
          </h2>
          <p className="mt-2 text-sm text-muted">Formez vos équipes, suivez leurs certifications et assurez la conformité de votre organisation.</p>
          <ButtonLink href="/entreprises" variant="cta" className="mt-4">Demander une offre entreprise <ArrowRight className="h-4 w-4" aria-hidden /></ButtonLink>
        </div>
        <ul className="space-y-2 px-6 pb-6 md:pb-0 md:pr-8">
          {POINTS.map((p) => (
            <li key={p} className="flex items-center gap-2.5 text-sm font-medium text-brand-dark">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand-dark text-white"><Check className="h-3 w-3" strokeWidth={3} aria-hidden /></span>{p}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
