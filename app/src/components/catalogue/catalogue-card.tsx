import Image from "next/image";
import { ArrowRight, BarChart3, Briefcase, Clock, Flame, Laptop, Layers, MapPin, Plus, Shield, Siren } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { categoryUi } from "@/content/categories";
import { summarize } from "@/lib/courses/detail";
import { LEVELS, MODES, type Mode } from "@/lib/courses/labels";
import type { CourseCard } from "@/lib/courses/queries";
import { publicImage } from "@/lib/images";
import { cn, formatDuration, formatFcfa } from "@/lib/utils";

const TONES = { brand: "bg-brand", success: "bg-success", danger: "bg-danger", dark: "bg-brand-dark" } as const;
const ICONS = { shield: Shield, cross: Plus, flame: Flame, briefcase: Briefcase, siren: Siren } as const;
const MODE_ICONS: Record<Mode, typeof Laptop> = { online: Laptop, onsite: MapPin, hybrid: Layers };

/** Carte de formation du catalogue. Sans couverture, la photo de la catégorie, puis une illustration, la remplacent. */
export function CatalogueCard({ course: c, priority = false, href, enrolled = false }: {
  course: CourseCard; priority?: boolean;
  /** Lien de la carte : par défaut la fiche publique de la formation. */
  href?: string;
  /** L’apprenant est déjà inscrit : la carte renvoie vers son espace. */
  enrolled?: boolean;
}) {
  const ui = categoryUi(c.category?.slug, c.category?.name);
  const Icon = ICONS[ui.icon];
  const ModeIcon = MODE_ICONS[c.delivery_mode];
  const cover = c.cover_url ?? (ui.image ? publicImage(`home/${ui.image}`) : null);

  return (
    <li className="flex flex-col overflow-hidden rounded-2xl border border-line bg-white shadow-card transition-shadow hover:shadow-lg">
      <div className="relative h-36 bg-brand-dark">
        {cover ? (
          <Image src={cover} alt="" fill priority={priority} sizes="(min-width: 1280px) 22vw, (min-width: 640px) 45vw, 100vw" className="object-cover" unoptimized={cover.startsWith("http")} />
        ) : (
          <div className="flex h-full items-center justify-center bg-[linear-gradient(135deg,#092a66,#0639d9)]" aria-hidden>
            <Icon className="h-12 w-12 text-white/80" strokeWidth={1.4} />
          </div>
        )}
        <span className={cn("absolute right-3 top-3 rounded-md px-2.5 py-1 text-xs font-bold text-white shadow", TONES[ui.tone])}>{ui.badge}</span>
      </div>
      <div className="flex flex-1 flex-col p-4">
        <p className="flex items-center gap-1.5 text-xs text-muted"><Clock className="h-3.5 w-3.5" aria-hidden />{formatDuration(c.duration_minutes)}</p>
        <h3 className="mt-1.5 text-lg font-extrabold leading-snug text-brand-dark">{c.title}</h3>
        <p className="mt-1.5 line-clamp-2 min-h-[2.5rem] text-sm text-muted">{summarize(c.description, 90)}</p>
        <div className="mt-3 flex items-center justify-between gap-2 text-xs text-muted">
          <span className="flex items-center gap-1.5"><BarChart3 className="h-3.5 w-3.5 text-brand" aria-hidden />{LEVELS[c.level]}</span>
          <span className="flex items-center gap-1.5"><ModeIcon className="h-3.5 w-3.5 text-brand" aria-hidden />{MODES[c.delivery_mode]}</span>
        </div>
        <p className="mt-3 text-xl font-extrabold text-brand-dark">{c.price_amount === 0 ? "Gratuit" : formatFcfa(c.price_amount)}</p>
        {enrolled ? (
          <ButtonLink href={`/app/formations/${c.id}`} variant="outline" className="mt-3 w-full">
            Accéder à ma formation <ArrowRight className="h-4 w-4" aria-hidden />
          </ButtonLink>
        ) : (
          <ButtonLink href={href ?? `/formations/${c.slug}`} variant="cta" className="mt-3 w-full">
            Voir la formation <ArrowRight className="h-4 w-4" aria-hidden />
          </ButtonLink>
        )}
      </div>
    </li>
  );
}
