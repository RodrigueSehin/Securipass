import { BadgeCheck, Flame, HeartPulse, Play, Shield } from "lucide-react";
import { HeroCarousel, type HeroSlide } from "@/components/home/hero-carousel";
import { ButtonLink } from "@/components/ui/button";
import { ShieldMark } from "@/components/ui/logo";
import { HERO_POINTS, HERO_SLIDES } from "@/content/home";
import { promoVideoUrl } from "@/config/site";
import { publicImage } from "@/lib/images";

/** Illustration de marque affichée tant qu'aucune photo n'est déposée dans public/images/home. */
function HeroIllustration() {
  return (
    <div className="relative mx-auto aspect-square w-full max-w-md" aria-hidden>
      <div className="absolute inset-0 rounded-full bg-white/5 blur-2xl" />
      <ShieldMark className="absolute left-1/2 top-1/2 h-72 w-64 -translate-x-1/2 -translate-y-1/2 drop-shadow-2xl" />
      <span className="absolute left-[8%] top-[18%] flex h-16 w-16 items-center justify-center rounded-2xl bg-white shadow-xl"><HeartPulse className="h-8 w-8 text-success" /></span>
      <span className="absolute right-[6%] top-[28%] flex h-16 w-16 items-center justify-center rounded-2xl bg-white shadow-xl"><Flame className="h-8 w-8 text-danger" /></span>
      <span className="absolute bottom-[12%] left-[22%] flex h-16 w-16 items-center justify-center rounded-2xl bg-white shadow-xl"><Shield className="h-8 w-8 text-brand" /></span>
    </div>
  );
}

export function Hero({ learners }: { learners: number }) {
  // Seules les diapositives dont la photo existe sont animées ; sans aucune photo, une seule diapositive et l'illustration de marque.
  const withPhoto: HeroSlide[] = HERO_SLIDES.map((s) => ({ ...s, photo: publicImage(`home/${s.image}`) })).filter((s) => s.photo);
  const slides = withPhoto.length > 0 ? withPhoto : [{ ...HERO_SLIDES[0], photo: null }];

  const secondary = promoVideoUrl ? (
    <a href={promoVideoUrl} target="_blank" rel="noopener noreferrer"
      className="inline-flex items-center gap-2 rounded-lg border border-white/60 px-6 py-3.5 text-base font-semibold hover:bg-white/10">
      <Play className="h-4 w-4 fill-current" aria-hidden /> Voir la vidéo
    </a>
  ) : (
    <ButtonLink href="/verifier" variant="ghost" className="border border-white/60 px-6 py-3.5 text-base text-white hover:bg-white/10">
      <BadgeCheck className="h-4 w-4" aria-hidden /> Vérifier un certificat
    </ButtonLink>
  );

  return (
    <HeroCarousel slides={slides} points={HERO_POINTS} learners={learners} secondary={secondary}
      illustration={withPhoto.length === 0 ? <HeroIllustration /> : undefined} />
  );
}
