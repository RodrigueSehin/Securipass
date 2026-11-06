import { FlaskConical } from "lucide-react";

/** Mention obligatoire tant que des données de démonstration sont affichées (exigence de la spécification). */
export function DemoNotice({ children = "Formations de démonstration : contenus, prix et sessions fictifs, présentés à titre d’exemple." }: { children?: React.ReactNode }) {
  return (
    <p role="note" className="flex items-start gap-2 rounded-lg border border-warning/40 bg-warning/10 px-3.5 py-2.5 text-sm text-[#8a5a00]">
      <FlaskConical className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
      <span>{children}</span>
    </p>
  );
}
