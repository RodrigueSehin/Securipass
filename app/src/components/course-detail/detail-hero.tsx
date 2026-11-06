import Image from "next/image";
import Link from "next/link";
import { BadgeCheck, BarChart3, ChevronRight, Clock, Laptop, MapPin, Layers } from "lucide-react";
import { MODE_DETAIL, summarize } from "@/lib/courses/detail";
import { LEVELS, MODES, type Mode } from "@/lib/courses/labels";
import type { PublicCourse } from "@/lib/courses/types";
import { formatDuration } from "@/lib/utils";

const MODE_ICONS: Record<Mode, typeof Laptop> = { online: Laptop, onsite: MapPin, hybrid: Layers };

export function DetailHero({ course: c, image, hasCertificate }: { course: PublicCourse; image: string | null; hasCertificate: boolean }) {
  const ModeIcon = MODE_ICONS[c.delivery_mode];
  const facts = [
    { Icon: Clock, label: formatDuration(c.duration_minutes), sub: "Durée totale" },
    { Icon: BarChart3, label: LEVELS[c.level], sub: "Niveau" },
    { Icon: ModeIcon, label: MODES[c.delivery_mode], sub: MODE_DETAIL[c.delivery_mode] },
    ...(hasCertificate ? [{ Icon: BadgeCheck, label: "Certificat SECURIPASS", sub: "Vérifiable en ligne" }] : []),
  ];
  return (
    <section className="relative overflow-hidden bg-brand-dark text-white">
      {image && (
        <div className="absolute inset-y-0 right-0 w-full opacity-25 lg:w-[48%] lg:opacity-100" aria-hidden>
          <Image src={image} alt="" fill priority sizes="(min-width: 1024px) 48vw, 100vw" className="object-cover object-[55%_20%]" unoptimized={image.startsWith("http")} />
          <div className="absolute inset-0 hidden bg-[linear-gradient(90deg,#092a66_0%,#092a66d9_28%,#092a6600_75%)] lg:block" />
        </div>
      )}
      <div className="relative mx-auto max-w-7xl px-4 py-9 md:py-12">
        <nav aria-label="Fil d’Ariane" className="flex flex-wrap items-center gap-1.5 text-xs text-white/80">
          <Link href="/" className="hover:text-white">Accueil</Link><ChevronRight className="h-3 w-3" aria-hidden />
          <Link href="/formations" className="hover:text-white">Formations</Link><ChevronRight className="h-3 w-3" aria-hidden />
          <span aria-current="page" className="text-white">{c.title}</span>
        </nav>
        <h1 className="mt-4 max-w-3xl text-3xl font-extrabold leading-tight md:text-5xl">{c.title}</h1>
        {c.description && <p className="mt-4 max-w-2xl text-white/85 md:text-lg">{summarize(c.description)}</p>}
        <ul className="mt-7 flex flex-wrap gap-x-8 gap-y-4">
          {facts.map(({ Icon, label, sub }, i) => (
            <li key={label} className={`flex items-center gap-3 ${i > 0 ? "lg:border-l lg:border-white/20 lg:pl-8" : ""}`}>
              <Icon className="h-9 w-9 shrink-0 text-white" strokeWidth={1.5} aria-hidden />
              <span className="leading-tight"><span className="block font-bold">{label}</span><span className="block text-sm text-white/75">{sub}</span></span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
