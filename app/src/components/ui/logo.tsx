import Image from "next/image";
import Link from "next/link";
import { cn } from "@/lib/utils";

/** Blason seul (illustration de secours du hero). Le logo officiel est l'image public/images/brand/logo.png. */
export function ShieldMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 56" className={className} aria-hidden="true">
      <path d="M24 2 4 9v18c0 13 8.5 22 20 27 11.5-5 20-14 20-27V9L24 2Z" fill="#092a66" />
      <path d="M24 6.5 8 12v15c0 10.6 6.6 18.2 16 22.6C33.4 45.2 40 37.6 40 27V12L24 6.5Z" fill="#0639d9" />
      <path d="m15.5 28 6 6 11-12.5" fill="none" stroke="#fff" strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="35" cy="14" r="4" fill="#d6a43b" />
    </svg>
  );
}

/**
 * Logo officiel SECURIPASS (fond blanc). Sur fond sombre (`onDark`), il est posé sur une pastille blanche
 * pour rester lisible sans altérer les couleurs de la marque.
 */
export function Logo({ onDark = false, className }: { onDark?: boolean; className?: string }) {
  const img = (
    <Image src="/images/brand/logo.png" alt="SECURIPASS — Former · Certifier · Sécuriser" width={588} height={176} priority className="h-11 w-auto" />
  );
  return (
    <Link href="/" className={cn("inline-flex items-center", onDark && "rounded-xl bg-white px-3 py-2", className)} aria-label="SECURIPASS — accueil">
      {img}
    </Link>
  );
}
