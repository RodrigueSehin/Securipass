"use client";

import { cn } from "@/lib/utils";

/** Interrupteur accessible. Envoie « 1 » ou « 0 » sous le nom donné ; `form` le rattache à un formulaire situé ailleurs dans la page. */
export function Switch({ name, label, on, onChange, form, disabled, className, labelClassName }: {
  name?: string; label: string; on: boolean; onChange: (value: boolean) => void; form?: string; disabled?: boolean;
  className?: string; labelClassName?: string;
}) {
  return (
    <span className={cn("inline-flex items-center gap-3", className)}>
      {name && <input type="hidden" name={name} value={on ? "1" : "0"} form={form} />}
      <button
        type="button"
        role="switch"
        aria-checked={on}
        aria-label={label}
        disabled={disabled}
        onClick={() => onChange(!on)}
        className={cn("relative h-6 w-11 shrink-0 rounded-full transition-colors disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand",
          on ? "bg-success" : "bg-line")}
      >
        <span aria-hidden className={cn("absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all", on ? "left-5.5" : "left-0.5")} />
      </button>
      <span className={cn("text-sm font-medium text-brand-dark", labelClassName)}>{label}</span>
    </span>
  );
}
