import { Award, QrCode } from "lucide-react";
import { ShieldMark } from "@/components/ui/logo";
import { cn } from "@/lib/utils";

const TONES = {
  blue: { frame: "border-[#c9a24a]", band: "from-brand-dark", ribbon: "bg-[#c9a24a]", text: "text-brand-dark" },
  green: { frame: "border-success", band: "from-success", ribbon: "bg-success", text: "text-success" },
  red: { frame: "border-danger", band: "from-danger", ribbon: "bg-danger", text: "text-danger" },
} as const;

/**
 * Spécimen de certificat : toutes les valeurs sont des gabarits (« NOM PRÉNOM », numéro en X) et le filigrane SPÉCIMEN
 * est visible : il ne représente aucun certificat réellement émis.
 */
export function CertificateCard({ tone = "blue", course, size = "lg" }: { tone?: keyof typeof TONES; course: string; size?: "lg" | "sm" }) {
  const t = TONES[tone];
  const lg = size === "lg";
  return (
    <div className={cn("relative rounded-md border-[3px] bg-[#fffdf7] shadow-card", t.frame, lg ? "p-2" : "p-1")} role="img" aria-label={`Exemple de certificat SECURIPASS : ${course} (spécimen)`}>
      <div className={cn("relative rounded-sm border border-line text-center", lg ? "px-6 py-5" : "px-2 py-2")}>
        <div className={cn("flex items-center justify-center gap-2", lg ? "" : "scale-90")}>
          <ShieldMark className={lg ? "h-8 w-7" : "h-6 w-5"} />
          <span className={cn("font-extrabold tracking-tight text-brand-dark", lg ? "text-xl" : "text-sm")}>SECURI<span className="text-cta">PASS</span></span>
        </div>
        <p className={cn("mt-2 font-bold tracking-wide text-brand-dark", lg ? "text-xs" : "text-[8px]")}>CERTIFICAT DE FORMATION</p>
        <p className={cn("text-muted", lg ? "mt-2 text-[11px]" : "mt-1 text-[7px]")}>Nous attestons que</p>
        <p className={cn("font-extrabold text-brand-dark", lg ? "mt-1 text-lg" : "text-xs")}>NOM PRÉNOM</p>
        <p className={cn("text-muted", lg ? "mt-1 text-[11px]" : "text-[7px]")}>a suivi avec succès la formation</p>
        <p className={cn("font-bold", t.text, lg ? "text-sm" : "text-[9px] leading-tight")}>{course}</p>
        <p className={cn("text-muted", lg ? "text-[11px]" : "text-[7px]")}>et a satisfait à toutes les évaluations.</p>
        <div className={cn("grid grid-cols-3 gap-2 text-brand-dark", lg ? "mt-4 text-[10px]" : "mt-2 text-[6px]")}>
          <p><span className="block text-muted">N° de certificat</span>SP-XXX-0000-000000</p>
          <p><span className="block text-muted">Date d’obtention</span>JJ/MM/AAAA</p>
          <p><span className="block text-muted">Date d’expiration</span>JJ/MM/AAAA</p>
        </div>
        <div className={cn("flex items-end justify-between", lg ? "mt-3" : "mt-1")}>
          <span className={cn("text-muted", lg ? "text-[10px]" : "text-[6px]")}>Le Directeur</span>
          <QrCode className={cn("text-brand-dark", lg ? "h-16 w-16" : "h-8 w-8")} aria-hidden />
          <span className={cn("text-muted", lg ? "text-[10px]" : "text-[6px]")}>Le Formateur</span>
        </div>
        <span className={cn("absolute right-3 top-3 flex items-center justify-center rounded-full text-white", t.ribbon, lg ? "h-12 w-12" : "h-6 w-6")} aria-hidden><Award className={lg ? "h-7 w-7" : "h-4 w-4"} /></span>
        <span className={cn("pointer-events-none absolute inset-0 flex items-center justify-center -rotate-12 font-black tracking-widest text-brand-dark/10", lg ? "text-5xl" : "text-xl")} aria-hidden>SPÉCIMEN</span>
      </div>
    </div>
  );
}
