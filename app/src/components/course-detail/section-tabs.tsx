"use client";

import { useEffect, useState } from "react";
import { Award, ClipboardList, FileText, ListChecks, CalendarClock, Target } from "lucide-react";
import { cn } from "@/lib/utils";

const ICONS = { presentation: FileText, programme: ListChecks, objectifs: Target, sessions: CalendarClock, prerequis: ClipboardList, certification: Award } as const;
export type TabId = keyof typeof ICONS;

/** Onglets d'ancres collés sous l'en-tête ; l'onglet actif suit la section visible à l'écran. */
export function SectionTabs({ items }: { items: { id: TabId; label: string }[] }) {
  const [active, setActive] = useState<TabId>(items[0]?.id ?? "presentation");

  useEffect(() => {
    const els = items.map((i) => document.getElementById(i.id)).filter((e): e is HTMLElement => Boolean(e));
    if (els.length === 0) return;
    const io = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
        if (visible) setActive(visible.target.id as TabId);
      },
      { rootMargin: "-150px 0px -55% 0px", threshold: 0 },
    );
    els.forEach((e) => io.observe(e));
    return () => io.disconnect();
  }, [items]);

  return (
    <nav aria-label="Sections de la formation" className="sticky top-[116px] z-30 -mx-4 overflow-x-auto border-b border-line bg-white px-4 lg:top-[72px] lg:mx-0 lg:rounded-xl lg:border lg:px-2 lg:shadow-card">
      <ul className="flex min-w-max gap-1">
        {items.map(({ id, label }) => {
          const Icon = ICONS[id];
          const on = active === id;
          return (
            <li key={id}>
              <a href={`#${id}`} aria-current={on ? "true" : undefined}
                className={cn("flex items-center gap-2 border-b-2 px-4 py-3.5 text-sm font-semibold whitespace-nowrap", on ? "border-cta text-brand" : "border-transparent text-brand-dark hover:text-brand")}>
                <Icon className="h-4 w-4" aria-hidden />{label}
              </a>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
