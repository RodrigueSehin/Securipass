"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { ArrowRight, BadgeCheck, ChevronLeft, ChevronRight, Laptop, Pause, Play, UsersRound } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type HeroSlide = {
  id: string; badge: string; title: string; highlight: string; text: string; cta: { label: string; href: string };
  /** Photo déjà résolue côté serveur ; absente : le fond de marque est affiché. */
  photo: string | null;
};

type Point = { icon: "laptop" | "badge" | "users"; label: string; sub: string };

const POINT_ICONS = { laptop: Laptop, badge: BadgeCheck, users: UsersRound } as const;
const DELAY_MS = 6500;

/** Carrousel de la page d'accueil : la photo et le texte changent en fondu, avec zoom lent, pause au survol et indicateurs. */
export function HeroCarousel({ slides, points, learners, secondary, illustration }: {
  slides: HeroSlide[]; points: readonly Point[]; learners: number;
  secondary: React.ReactNode; illustration?: React.ReactNode;
}) {
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [hover, setHover] = useState(false);
  const [reduced, setReduced] = useState(true);
  const count = slides.length;
  const running = playing && !hover && !reduced && count > 1;

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReduced(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    if (!running) return;
    const t = window.setTimeout(() => setIndex((i) => (i + 1) % count), DELAY_MS);
    return () => window.clearTimeout(t);
  }, [running, index, count]);

  const go = (n: number) => setIndex(((n % count) + count) % count);

  return (
    <section className="relative overflow-hidden bg-brand-dark text-white" aria-roledescription="carrousel" aria-label="À la une"
      onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)} onFocus={() => setHover(true)} onBlur={() => setHover(false)}>
      {/* Photos : fondu enchaîné, zoom lent sur la photo active */}
      <div className="absolute inset-y-0 right-0 w-full overflow-hidden opacity-25 lg:w-[62%] lg:opacity-100" aria-hidden>
        {slides.map((s, i) => s.photo && (
          // Le zoom est une transition (et non une animation) : en quittant l'écran la photo ne revient pas brutalement à sa taille initiale.
          <Image key={s.id} src={s.photo} alt="" fill priority={i === 0} sizes="(min-width: 1024px) 62vw, 100vw"
            style={{ transition: "opacity 1100ms ease-in-out, transform 9000ms ease-out" }}
            className={cn("object-cover object-[55%_18%]", i === index ? "scale-100 opacity-100" : "scale-[1.08] opacity-0")} />
        ))}
        <div className="absolute inset-0 hidden bg-[linear-gradient(90deg,#092a66_0%,#092a66cc_20%,#092a6600_52%)] lg:block" />
      </div>
      {!slides.some((s) => s.photo) && <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_30%,#1747c8_0%,transparent_55%)]" aria-hidden />}

      <div className="relative mx-auto grid min-h-[34rem] max-w-7xl items-center gap-8 px-4 py-14 md:py-20 lg:grid-cols-2">
        <div>
          {/* Tous les textes occupent la même cellule : la hauteur reste celle du plus long, sans saut de page */}
          <div className="grid" aria-live={running ? "off" : "polite"}>
            {slides.map((s, i) => {
              const active = i === index;
              const Heading = i === 0 ? "h1" : "h2"; // un seul h1 par page
              return (
                <div key={s.id} role="group" aria-roledescription="diapositive" aria-label={`${i + 1} sur ${count}`} aria-hidden={!active} inert={!active}
                  className={cn("col-start-1 row-start-1 transition-[opacity,transform] ease-out",
                    // Le texte sortant disparaît vite, puis le suivant entre : jamais deux textes superposés.
                    active ? "translate-y-0 opacity-100 duration-700 delay-[400ms]" : "pointer-events-none -translate-y-2 opacity-0 duration-300")}>
                  <p className="inline-block rounded-full bg-white/10 px-4 py-1.5 text-xs font-semibold backdrop-blur">{s.badge}</p>
                  <Heading className="mt-5 text-4xl font-extrabold leading-[1.1] md:text-5xl">
                    {s.title} <span className="text-cta">{s.highlight}</span>
                  </Heading>
                  <p className="mt-5 max-w-lg text-base text-white/85 md:text-lg">{s.text}</p>
                  <div className="mt-7 flex flex-wrap gap-3">
                    <ButtonLink href={s.cta.href} variant="cta" className="px-6 py-3.5 text-base">{s.cta.label} <ArrowRight className="h-4 w-4" aria-hidden /></ButtonLink>
                    {secondary}
                  </div>
                </div>
              );
            })}
          </div>

          <ul className="mt-9 grid gap-4 sm:grid-cols-3">
            {points.map((p) => {
              const Icon = POINT_ICONS[p.icon];
              return (
                <li key={p.label} className="flex items-center gap-3">
                  <Icon className="h-9 w-9 shrink-0 text-white/90" strokeWidth={1.5} aria-hidden />
                  <span className="text-sm leading-tight text-white/90"><strong className="font-semibold">{p.label}</strong><br />{p.sub}</span>
                </li>
              );
            })}
          </ul>

          {count > 1 && (
            <div className="mt-8 flex items-center gap-3">
              <button type="button" onClick={() => go(index - 1)} aria-label="Diapositive précédente" className="rounded-full border border-white/40 p-2 hover:bg-white/10"><ChevronLeft className="h-4 w-4" aria-hidden /></button>
              <ol className="flex items-center gap-2" aria-label="Choisir une diapositive">
                {slides.map((s, i) => (
                  <li key={s.id}>
                    <button type="button" onClick={() => go(i)} aria-label={`Diapositive ${i + 1} : ${s.badge}`} aria-current={i === index ? "true" : undefined}
                      className="relative block h-2 overflow-hidden rounded-full bg-white/30 transition-all duration-500" style={{ width: i === index ? 40 : 12 }}>
                      {i === index && (
                        <span key={`${index}-${running}`} className={cn("absolute inset-y-0 left-0 rounded-full bg-cta", running ? "hero-progress" : "w-full")}
                          style={running ? { animationDuration: `${DELAY_MS}ms` } : undefined} />
                      )}
                    </button>
                  </li>
                ))}
              </ol>
              <button type="button" onClick={() => go(index + 1)} aria-label="Diapositive suivante" className="rounded-full border border-white/40 p-2 hover:bg-white/10"><ChevronRight className="h-4 w-4" aria-hidden /></button>
              <button type="button" onClick={() => setPlaying((p) => !p)} aria-label={playing ? "Mettre le défilement en pause" : "Relancer le défilement"} className="rounded-full border border-white/40 p-2 hover:bg-white/10">
                {playing ? <Pause className="h-4 w-4" aria-hidden /> : <Play className="h-4 w-4" aria-hidden />}
              </button>
            </div>
          )}
        </div>

        <div className="relative hidden lg:block">
          {illustration}
          {learners > 0 && (
            <div className="absolute bottom-0 right-0 flex items-center gap-3 rounded-2xl bg-white px-5 py-4 text-brand-dark shadow-2xl">
              <span className="flex h-11 w-11 items-center justify-center rounded-full bg-success text-white"><UsersRound className="h-5 w-5" aria-hidden /></span>
              <span>
                <span className="block text-xs text-muted">Déjà</span>
                <span className="block text-2xl font-extrabold leading-none">{new Intl.NumberFormat("fr-FR").format(learners)}</span>
                <span className="block text-xs text-muted">apprenant{learners > 1 ? "s" : ""} inscrit{learners > 1 ? "s" : ""}</span>
              </span>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
