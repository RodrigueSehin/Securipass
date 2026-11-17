"use client";

import { useEffect, useRef, useState } from "react";
import { MoreHorizontal, MoreVertical } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Menu « … » d'une ligne de tableau. Le panneau est en position fixe, calculée au clic :
 * il passe au-dessus du tableau au lieu d'être rogné par son défilement horizontal.
 * Il s'ouvre vers le haut quand il n'y a pas assez de place en dessous, et se ferme au clic extérieur, à Échap ou au défilement.
 */
export function RowMenu({ label, children, className, vertical }: { label: string; children: React.ReactNode; className?: string; vertical?: boolean }) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top?: number; bottom?: number; right: number } | null>(null);
  const button = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);

  function toggle() {
    if (open) return setOpen(false);
    const r = button.current?.getBoundingClientRect();
    if (!r) return;
    const below = window.innerHeight - r.bottom;
    const right = Math.max(8, window.innerWidth - r.right);
    setPos(below < 260 && r.top > below ? { bottom: window.innerHeight - r.top + 4, right } : { top: r.bottom + 4, right });
    setOpen(true);
  }

  useEffect(() => {
    if (!open) return;
    const close = () => setOpen(false);
    const outside = (e: MouseEvent) => { if (!panel.current?.contains(e.target as Node) && !button.current?.contains(e.target as Node)) close(); };
    const key = (e: KeyboardEvent) => { if (e.key === "Escape") { close(); button.current?.focus(); } };
    document.addEventListener("mousedown", outside);
    document.addEventListener("keydown", key);
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    return () => {
      document.removeEventListener("mousedown", outside);
      document.removeEventListener("keydown", key);
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
    };
  }, [open]);

  return (
    <div className="inline-block">
      <button ref={button} type="button" aria-label={label} aria-haspopup="menu" aria-expanded={open} onClick={toggle}
        className={cn("flex h-9 w-10 items-center justify-center rounded-lg border border-line text-brand-dark hover:bg-brand-soft", className)}>{vertical ? <MoreVertical className="h-4 w-4" aria-hidden /> : <MoreHorizontal className="h-4 w-4" aria-hidden />}</button>
      {open && pos && (
        <div ref={panel} role="menu" style={{ position: "fixed", top: pos.top, bottom: pos.bottom, right: pos.right }}
          className="z-50 w-56 rounded-lg border border-line bg-white py-1 text-sm shadow-card">{children}</div>
      )}
    </div>
  );
}
