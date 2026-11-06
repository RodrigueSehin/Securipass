import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

const STEPS = ["Informations personnelles", "Profil et préférences", "Confirmation"] as const;

/** Indicateur d'étapes : étape courante en orange, étapes terminées cochées. */
export function Stepper({ step }: { step: 1 | 2 | 3 }) {
  return (
    <ol className="flex items-center gap-2 sm:gap-3" aria-label="Progression de l’inscription">
      {STEPS.map((label, i) => {
        const n = i + 1;
        const current = n === step;
        const done = n < step;
        return (
          <li key={label} className="flex flex-1 items-center gap-2 last:flex-none" aria-current={current ? "step" : undefined}>
            <span className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-bold",
              current ? "bg-cta text-white" : done ? "bg-success text-white" : "bg-line text-muted")}>
              {done ? <Check className="h-4 w-4" strokeWidth={3} aria-label="terminée" /> : n}
            </span>
            <span className={cn("hidden text-sm leading-tight sm:block", current ? "font-bold text-cta" : "text-muted")}>{label}</span>
            {n < STEPS.length && <span className="hidden h-px flex-1 bg-line sm:block" aria-hidden />}
          </li>
        );
      })}
    </ol>
  );
}
