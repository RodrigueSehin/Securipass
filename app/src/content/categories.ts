/** Habillage visuel des catégories (pastille, icône, photo par défaut d'une formation sans couverture). */
export type CategoryUi = {
  /** Libellé court (onglets, filtres). */
  label: string;
  /** Libellé très court (pastille sur la carte). */
  badge: string;
  tone: "brand" | "success" | "danger" | "dark";
  icon: "shield" | "cross" | "flame" | "briefcase" | "siren";
  /** Photo par défaut : public/images/home/<image>.webp */
  image?: string;
};

const UI: Record<string, CategoryUi> = {
  "securite-privee": { label: "Agent de sécurité", badge: "Agent de sécurité", tone: "brand", icon: "shield", image: "agent-securite" },
  secourisme: { label: "Secourisme au travail", badge: "Secourisme", tone: "success", icon: "cross", image: "secourisme" },
  "securite-incendie": { label: "Sécurité incendie", badge: "Incendie", tone: "danger", icon: "flame", image: "securite-incendie" },
  "prevention-risques": { label: "Prévention des risques", badge: "Prévention", tone: "dark", icon: "briefcase" },
  "situations-urgence": { label: "Situations d’urgence", badge: "Urgences", tone: "dark", icon: "siren" },
};

export function categoryUi(slug: string | undefined | null, fallbackName?: string): CategoryUi {
  return (slug && UI[slug]) || { label: fallbackName ?? "Formation", badge: fallbackName ?? "Formation", tone: "dark", icon: "briefcase" };
}

/** Ordre d'affichage voulu (maquette) ; les catégories inconnues suivent, par ordre alphabétique. */
const ORDER = ["securite-privee", "secourisme", "securite-incendie", "prevention-risques", "situations-urgence"];

export function sortCategories<T extends { slug: string; name: string }>(categories: T[]): T[] {
  const rank = (slug: string) => { const i = ORDER.indexOf(slug); return i === -1 ? ORDER.length : i; };
  return [...categories].sort((a, b) => rank(a.slug) - rank(b.slug) || a.name.localeCompare(b.name, "fr"));
}
