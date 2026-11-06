import Image from "next/image";
import { ArrowRight, Check } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { ENTERPRISE_POINTS } from "@/content/home";
import { publicImage } from "@/lib/images";

export function EnterpriseBanner() {
  const photo = publicImage("home/entreprise");
  return (
    <section className="mx-auto max-w-7xl px-4 pb-14" aria-labelledby="enterprise-title">
      <div className="relative overflow-hidden rounded-2xl bg-[linear-gradient(100deg,#eaf2ff_0%,#dbe9ff_100%)] px-6 py-9 md:px-10">
        {photo && (
          <div className="pointer-events-none absolute inset-y-0 left-[42%] hidden w-[29%] md:block" aria-hidden>
            <Image src={photo} alt="" fill sizes="30vw" className="object-cover [mask-image:linear-gradient(to_right,transparent,black_30%,black_70%,transparent)]" />
          </div>
        )}
        <div className="relative grid items-center gap-8 md:grid-cols-[1fr_auto]">
          <div className="max-w-md">
            <h2 id="enterprise-title" className="text-2xl font-extrabold leading-tight text-brand-dark md:text-3xl">Une solution adaptée aux entreprises</h2>
            <p className="mt-3 text-muted">Formez vos équipes, suivez leurs certifications et assurez la conformité de votre organisation.</p>
            <ButtonLink href="/entreprises" variant="cta" className="mt-6 px-6 py-3.5">
              Découvrir l’offre entreprise <ArrowRight className="h-4 w-4" aria-hidden />
            </ButtonLink>
          </div>
          <ul className="space-y-2.5 md:pr-6">
            {ENTERPRISE_POINTS.map((p) => (
              <li key={p} className="flex items-center gap-3 text-sm font-medium text-brand-dark">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand-dark text-white"><Check className="h-3 w-3" strokeWidth={3} aria-hidden /></span>
                {p}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
