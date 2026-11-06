"use client";

import { useEffect, useRef } from "react";

/**
 * Formulaire GET qui s'envoie dès qu'une case ou une liste change. Les curseurs attendent la fin du geste
 * (utile au clavier, où chaque flèche déclenche un changement) ; les champs de saisie libre s'envoient avec Entrée.
 * Sans JavaScript, il reste utilisable grâce au bouton « Appliquer les filtres ».
 */
export function AutoSubmitForm({ children, action, className }: { children: React.ReactNode; action: string; className?: string }) {
  const ref = useRef<HTMLFormElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);

  return (
    <form
      ref={ref} action={action} method="get" className={className}
      onChange={(e) => {
        const t = e.target;
        if (t instanceof HTMLInputElement && ["search", "text", "number"].includes(t.type)) return;
        clearTimeout(timer.current);
        const delay = t instanceof HTMLInputElement && t.type === "range" ? 700 : 0;
        timer.current = setTimeout(() => ref.current?.requestSubmit(), delay);
      }}
    >
      {children}
    </form>
  );
}
