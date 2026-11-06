import type { LucideIcon } from "lucide-react";

/** Carte de section de l'assistant : pastille d'icône, titre et sous-titre. */
export function Card({ icon: Icon, title, hint, children, className }: {
  icon: LucideIcon; title: string; hint?: string; children: React.ReactNode; className?: string;
}) {
  return (
    <section className={`space-y-4 rounded-2xl border border-line bg-white p-6 shadow-card ${className ?? ""}`}>
      <div className="flex items-start gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-brand-soft text-brand"><Icon className="h-5 w-5" aria-hidden /></span>
        <div>
          <h3 className="text-lg font-bold text-brand-dark">{title}</h3>
          {hint && <p className="text-sm text-muted">{hint}</p>}
        </div>
      </div>
      {children}
    </section>
  );
}
