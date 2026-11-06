import { ButtonLink } from "@/components/ui/button";
import type { PublicCourse } from "@/lib/courses/types";
import { formatFcfa } from "@/lib/utils";

/** Barre d'action fixe en bas d'écran sur mobile : le prix et l'inscription restent accessibles pendant la lecture. */
export function MobileCta({ course: c }: { course: PublicCourse }) {
  const paid = c.price_amount > 0;
  return (
    <div className="fixed inset-x-0 bottom-0 z-30 flex items-center justify-between gap-3 border-t border-line bg-white px-4 py-3 shadow-[0_-4px_16px_rgb(9_42_102/0.08)] lg:hidden">
      <div className="leading-tight">
        <p className="text-xl font-extrabold text-brand-dark">{paid ? formatFcfa(c.price_amount) : "Gratuit"}</p>
        <p className="text-xs text-muted">{c.title.length > 28 ? `${c.title.slice(0, 27)}…` : c.title}</p>
      </div>
      {paid ? (
        <ButtonLink href="/contact" variant="cta" className="shrink-0">Nous contacter</ButtonLink>
      ) : (
        <ButtonLink href={`/formations/${c.slug}/inscription`} variant="cta" className="shrink-0">S’inscrire</ButtonLink>
      )}
    </div>
  );
}
