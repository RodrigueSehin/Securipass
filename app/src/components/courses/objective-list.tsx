"use client";

import { useRef, useState } from "react";
import { GripVertical, Plus, Trash } from "lucide-react";

type Item = { id: number; text: string };

/**
 * Liste d'objectifs modifiable : saisie ligne par ligne, suppression, réordonnancement par glisser-déposer ou au
 * clavier (flèches haut et bas sur la poignée). Envoyée sous forme d'un objectif par ligne.
 */
export function ObjectiveList({ name, label, initial, errors }: { name: string; label: string; initial: string[]; errors?: string[] }) {
  const nextId = useRef(Math.max(initial.length, 1) + 1);
  const [items, setItems] = useState<Item[]>(() =>
    (initial.length ? initial : [""]).map((text, i) => ({ id: i + 1, text })));
  const [dragFrom, setDragFrom] = useState<number | null>(null);
  const err = errors?.[0];

  const move = (from: number, to: number) => {
    if (to < 0 || to >= items.length || from === to) return;
    const next = [...items];
    next.splice(to, 0, next.splice(from, 1)[0]);
    setItems(next);
  };

  return (
    <div>
      <p className="mb-2 text-sm font-medium text-brand-dark">{label}</p>
      <ul className="space-y-2">
        {items.map((item, i) => (
          <li
            key={item.id}
            draggable
            onDragStart={() => setDragFrom(i)}
            onDragOver={(e) => e.preventDefault()}
            onDrop={() => { if (dragFrom !== null) move(dragFrom, i); setDragFrom(null); }}
            onDragEnd={() => setDragFrom(null)}
            className="flex items-center gap-2 rounded-lg border border-line bg-white px-2 py-1.5"
          >
            <button
              type="button"
              aria-label={`Déplacer l’objectif ${i + 1} (flèches haut et bas)`}
              onKeyDown={(e) => {
                if (e.key === "ArrowUp") { e.preventDefault(); move(i, i - 1); }
                if (e.key === "ArrowDown") { e.preventDefault(); move(i, i + 1); }
              }}
              className="cursor-grab rounded p-1 text-muted hover:text-brand"
            >
              <GripVertical className="h-4 w-4" aria-hidden />
            </button>
            <input
              value={item.text}
              onChange={(e) => setItems(items.map((x) => (x.id === item.id ? { ...x, text: e.target.value } : x)))}
              onKeyDown={(e) => { if (e.key === "Enter") e.preventDefault(); }}
              aria-label={`Objectif ${i + 1}`}
              maxLength={300}
              className="min-w-0 flex-1 bg-transparent px-1 py-1 text-sm outline-none"
            />
            <button
              type="button"
              aria-label={`Supprimer l’objectif ${i + 1}`}
              onClick={() => setItems(items.length > 1 ? items.filter((x) => x.id !== item.id) : [{ id: item.id, text: "" }])}
              className="rounded p-1 text-danger hover:bg-danger/10"
            >
              <Trash className="h-4 w-4" aria-hidden />
            </button>
          </li>
        ))}
      </ul>
      <input type="hidden" name={name} value={items.map((x) => x.text.trim()).filter(Boolean).join("\n")} />
      <button
        type="button"
        onClick={() => setItems([...items, { id: nextId.current++, text: "" }])}
        className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg border border-brand px-4 py-2 text-sm font-semibold text-brand hover:bg-brand-soft"
      >
        <Plus className="h-4 w-4" aria-hidden /> Ajouter un objectif
      </button>
      {err && <p role="alert" className="mt-1 text-xs text-danger">{err}</p>}
    </div>
  );
}
