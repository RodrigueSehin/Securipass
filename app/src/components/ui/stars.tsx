import { Star } from "lucide-react";
import { cn } from "@/lib/utils";

/** Étoiles de notation (lecture seule). `value` de 0 à 5, avec demi-étoiles arrondies à l'étoile entière la plus proche. */
export function Stars({ value, className }: { value: number; className?: string }) {
  const full = Math.round(value);
  return (
    <span className={cn("inline-flex items-center gap-0.5", className)} role="img" aria-label={`Note : ${value.toLocaleString("fr-FR")} sur 5`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Star key={i} className={cn("h-3.5 w-3.5", i <= full ? "fill-warning text-warning" : "text-line")} aria-hidden />
      ))}
    </span>
  );
}
