"use client";

import { useState } from "react";
import { formatFcfa } from "@/lib/utils";

/** Curseur de prix à deux poignées. Les bornes par défaut ne sont pas envoyées (URL propre). */
export function PriceRange({ bound, initialMin, initialMax }: { bound: number; initialMin?: number; initialMax?: number }) {
  const step = bound > 200000 ? 5000 : 1000;
  const [min, setMin] = useState(Math.min(initialMin ?? 0, bound));
  const [max, setMax] = useState(Math.min(initialMax ?? bound, bound));
  const pct = (v: number) => (bound === 0 ? 0 : (v / bound) * 100);

  return (
    <div>
      {min > 0 && <input type="hidden" name="pmin" value={min} />}
      {max < bound && <input type="hidden" name="pmax" value={max} />}
      <div className="dual-range relative h-6">
        <div className="absolute left-0 right-0 top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-line" aria-hidden />
        <div className="absolute top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-cta" style={{ left: `${pct(min)}%`, right: `${100 - pct(max)}%` }} aria-hidden />
        <input
          type="range" min={0} max={bound} step={step} value={min} aria-label="Prix minimum (FCFA)"
          onChange={(e) => setMin(Math.min(Number(e.target.value), max))}
        />
        <input
          type="range" min={0} max={bound} step={step} value={max} aria-label="Prix maximum (FCFA)"
          onChange={(e) => setMax(Math.max(Number(e.target.value), min))}
        />
      </div>
      <div className="mt-1 flex justify-between text-xs text-muted">
        <span>{formatFcfa(min)}</span>
        <span>{formatFcfa(max)}</span>
      </div>
    </div>
  );
}
