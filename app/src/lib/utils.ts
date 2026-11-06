import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Formate un montant en FCFA (XOF n'a pas de décimales). */
export function formatFcfa(amount: number): string {
  return `${new Intl.NumberFormat("fr-FR").format(amount).replace(/ /g, " ")} FCFA`;
}

export function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const h = Math.round(minutes / 60);
  return `${h} heure${h > 1 ? "s" : ""}`;
}
