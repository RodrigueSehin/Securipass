import Image from "next/image";
import { initials } from "@/lib/learners/overview";
import { cn } from "@/lib/utils";

/** Photo de profil ronde ; à défaut, les initiales. */
export function Avatar({ name, src, size = 40, className }: { name: string; src?: string | null; size?: number; className?: string }) {
  return (
    <span className={cn("relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-brand-soft text-xs font-bold text-brand", className)}
      style={{ width: size, height: size }} aria-hidden>
      {src ? <Image src={src} alt="" fill sizes={`${size}px`} className="object-cover" unoptimized /> : initials(name)}
    </span>
  );
}
