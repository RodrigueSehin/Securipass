import type { PublicStats } from "./stats-types";

export type StatItem = { key: "learners" | "courses" | "companies"; value: number; label: string };

const plural = (n: number, one: string, many: string) => (n > 1 ? many : one);

/**
 * Indicateurs à afficher sur l'accueil. Règles : un indicateur à zéro est masqué, et le bandeau entier disparaît
 * s'il en reste moins de deux, pour ne jamais présenter de chiffres dérisoires ou inventés.
 */
export function buildStatItems(stats: PublicStats): StatItem[] {
  const all: StatItem[] = [
    { key: "learners", value: stats.learners, label: plural(stats.learners, "Apprenant inscrit", "Apprenants inscrits") },
    { key: "courses", value: stats.courses, label: plural(stats.courses, "Formation disponible", "Formations disponibles") },
    { key: "companies", value: stats.companies, label: plural(stats.companies, "Entreprise cliente", "Entreprises clientes") },
  ];
  const items = all.filter((i) => i.value > 0);
  return items.length >= 2 ? items : [];
}
