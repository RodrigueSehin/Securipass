"use client";

import { useState } from "react";
import { ChevronDown, SlidersHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";

/** Panneau de filtres : toujours visible sur ordinateur, repliable sur mobile. */
export function FilterPanel({ children, activeCount }: { children: React.ReactNode; activeCount: number }) {
  const [open, setOpen] = useState(false);
  return (
    <aside className="rounded-2xl border border-line bg-white shadow-card lg:self-start">
      <button
        type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-controls="catalogue-filters"
        className="flex w-full items-center justify-between px-5 py-4 text-left lg:cursor-default"
      >
        <span className="flex items-center gap-2 text-lg font-extrabold text-brand-dark">
          <SlidersHorizontal className="h-4 w-4 lg:hidden" aria-hidden />Filtres
          {activeCount > 0 && <span className="rounded-full bg-cta px-2 py-0.5 text-xs font-bold text-white">{activeCount}</span>}
        </span>
        <ChevronDown className={cn("h-4 w-4 text-muted transition-transform lg:hidden", open && "rotate-180")} aria-hidden />
      </button>
      <div id="catalogue-filters" className={cn("space-y-6 border-t border-line px-5 pb-5 pt-4", open ? "block" : "hidden", "lg:block")}>
        {children}
      </div>
    </aside>
  );
}
