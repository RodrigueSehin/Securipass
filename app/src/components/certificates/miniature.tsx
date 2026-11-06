import { ShieldMark } from "@/components/ui/logo";
import { cn } from "@/lib/utils";

type Layout = "classic" | "modern" | "minimal" | "professional";

/** Aperçu miniature d'un modèle de certificat (quatre mises en page), pour le choix du modèle. */
export function CertificateMiniature({ layout, title, className }: { layout: Layout; title?: string; className?: string }) {
  return (
    <div className={cn("relative aspect-[1.414] w-full overflow-hidden rounded-md bg-[#fffdf7] text-center shadow-sm", className,
      layout === "classic" && "border-[3px] border-gold p-1.5",
      layout === "minimal" && "border border-line p-2",
      layout === "modern" && "border border-line",
      layout === "professional" && "border border-line")}
      role="img" aria-label={`Aperçu du modèle ${layout}`}>
      {layout === "modern" && <div className="h-[22%] bg-brand-dark" aria-hidden />}
      <div className={cn("flex flex-col items-center px-3", layout === "modern" ? "pt-2" : layout === "classic" ? "h-full rounded-sm border border-gold/60 pt-2" : "pt-3")}>
        <ShieldMark className="h-5 w-4" />
        <p className="mt-0.5 text-[7px] font-extrabold tracking-wide text-brand-dark">SECURI<span className="text-cta">PASS</span></p>
        <p className="mt-1 line-clamp-2 text-[7px] font-bold tracking-widest text-brand-dark">{title ? title.toUpperCase() : "CERTIFICAT"}</p>
        <span className="mt-1.5 h-0.5 w-12 rounded bg-line" aria-hidden />
        <span className="mt-1 h-0.5 w-16 rounded bg-line" aria-hidden />
        <span className="mt-1 h-0.5 w-10 rounded bg-line" aria-hidden />
      </div>
      {layout === "professional" && <div className="absolute inset-x-0 bottom-0 h-[14%] bg-brand" aria-hidden />}
    </div>
  );
}
