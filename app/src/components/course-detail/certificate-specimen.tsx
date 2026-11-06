import { QrCode } from "lucide-react";
import { ShieldMark } from "@/components/ui/logo";

/** Spécimen illustratif : il ne représente aucun certificat réellement émis (mention « SPÉCIMEN » visible). */
export function CertificateSpecimen() {
  return (
    <div className="relative rounded-lg border-2 border-gold bg-[#fffdf7] p-1.5 shadow-md" role="img" aria-label="Exemple de certificat SECURIPASS (spécimen)">
      <div className="relative rounded border border-gold/60 px-4 py-4 text-center">
        <ShieldMark className="mx-auto h-8 w-7" />
        <p className="mt-1 text-sm font-extrabold tracking-wide text-brand-dark">SECURI<span className="text-cta">PASS</span></p>
        <p className="mt-1 text-[10px] font-bold tracking-widest text-brand-dark">CERTIFICAT DE FORMATION</p>
        <div className="mx-auto mt-2 h-1.5 w-24 rounded bg-line" aria-hidden />
        <div className="mx-auto mt-1.5 h-1.5 w-32 rounded bg-line" aria-hidden />
        <div className="mt-3 flex items-end justify-between">
          <QrCode className="h-10 w-10 text-brand-dark" aria-hidden />
          <span className="h-9 w-9 rounded-full bg-gold/80 ring-2 ring-gold/40" aria-hidden />
        </div>
        <span className="pointer-events-none absolute inset-0 flex items-center justify-center text-3xl font-black tracking-widest text-brand-dark/10 -rotate-12" aria-hidden>SPÉCIMEN</span>
      </div>
    </div>
  );
}
