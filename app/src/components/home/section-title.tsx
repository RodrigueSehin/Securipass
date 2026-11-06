import { cn } from "@/lib/utils";

/** Titre de section avec sur-titre orange encadré de filets, comme sur la maquette. */
export function SectionTitle({
  eyebrow, children, align = "center", className,
}: { eyebrow: string; children: React.ReactNode; align?: "center" | "left"; className?: string }) {
  return (
    <div className={cn(align === "center" ? "text-center" : "text-left", className)}>
      <p className={cn("flex items-center gap-3 text-xs font-bold uppercase tracking-widest text-cta", align === "center" && "justify-center")}>
        {align === "center" && <span className="h-px w-8 bg-cta/60" aria-hidden />}
        {eyebrow}
        <span className="h-px w-8 bg-cta/60" aria-hidden />
      </p>
      <h2 className="mt-2 text-2xl font-extrabold leading-tight text-brand-dark md:text-3xl">{children}</h2>
    </div>
  );
}
