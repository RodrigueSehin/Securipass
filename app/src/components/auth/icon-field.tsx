"use client";

import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { cn } from "@/lib/utils";

type Props = Omit<React.InputHTMLAttributes<HTMLInputElement>, "id"> & {
  label: string;
  name: string;
  icon: React.ComponentType<{ className?: string }>;
  error?: string;
  hint?: string;
  /** Champ de mot de passe : ajoute le bouton afficher / masquer. */
  password?: boolean;
};

/** Champ avec icône à gauche, étoile rouge si obligatoire, message d'erreur lié au champ (accessibilité). */
export function IconField({ label, name, icon: Icon, error, hint, password, className, required, type, ...props }: Props) {
  const [shown, setShown] = useState(false);
  const id = `reg-${name}`;
  return (
    <div className={className}>
      <label htmlFor={id} className="mb-1.5 block text-sm font-semibold text-brand-dark">
        {label}{required && <span className="text-danger" aria-hidden> *</span>}
      </label>
      <div className="relative">
        <Icon className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
        <input
          id={id} name={name} required={required} aria-required={required} aria-invalid={!!error}
          aria-describedby={error ? `${id}-err` : hint ? `${id}-hint` : undefined}
          type={password ? (shown ? "text" : "password") : type}
          className={cn(
            "w-full rounded-lg border bg-white py-3 pl-10 text-sm text-brand-dark outline-none placeholder:text-muted/70 focus:border-brand focus:ring-2 focus:ring-brand/20",
            password ? "pr-11" : "pr-3",
            error ? "border-danger" : "border-line",
          )}
          {...props}
        />
        {password && (
          <button
            type="button" onClick={() => setShown((s) => !s)} aria-label={shown ? "Masquer le mot de passe" : "Afficher le mot de passe"} aria-pressed={shown}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded p-1.5 text-muted hover:text-brand"
          >
            {shown ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        )}
      </div>
      {error ? <p id={`${id}-err`} role="alert" className="mt-1 text-xs text-danger">{error}</p>
        : hint ? <p id={`${id}-hint`} className="mt-1 text-xs text-muted">{hint}</p> : null}
    </div>
  );
}
