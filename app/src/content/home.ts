/** Contenus éditoriaux de la page d'accueil. */

export type HomeCategory = {
  slug: string;
  title: string;
  tone: "blue" | "green" | "red";
  icon: "shield" | "cross" | "flame";
  /** Photo facultative : public/images/home/<image>.webp (ou .jpg/.png). Sans fichier, une illustration de marque la remplace. */
  image: string;
  items: string[];
};

export const HOME_CATEGORIES: HomeCategory[] = [
  {
    slug: "securite-privee", title: "Agent de sécurité", tone: "blue", icon: "shield", image: "agent-securite",
    items: ["Prévention et surveillance", "Contrôle d’accès", "Gestion des conflits", "Sécurité des sites", "Vidéosurveillance"],
  },
  {
    slug: "secourisme", title: "Secourisme au travail", tone: "green", icon: "cross", image: "secourisme",
    items: ["Premiers secours", "SST – Sauveteur Secouriste", "Gestes d’urgence", "Accidents du travail", "Organisation des secours"],
  },
  {
    slug: "securite-incendie", title: "Sécurité incendie", tone: "red", icon: "flame", image: "securite-incendie",
    items: ["Prévention incendie", "Utilisation des extincteurs", "Évacuation", "SSI et alarme incendie", "Intervention sur départ de feu"],
  },
];

export const HOME_BENEFITS = [
  { icon: "cap", tone: "orange", title: "Formations certifiantes", text: "Des parcours structurés, validés par des responsables pédagogiques." },
  { icon: "monitor", tone: "blue", title: "Flexible et accessible", text: "Apprenez à votre rythme, en ligne et en présentiel." },
  { icon: "shield", tone: "green", title: "Certificats vérifiables", text: "Des certificats sécurisés avec QR Code." },
  { icon: "users", tone: "red", title: "Formateurs experts", text: "Des professionnels dont les qualifications sont suivies." },
] as const;

export const ENTERPRISE_POINTS = [
  "Gestion centralisée des employés",
  "Suivi des formations et certifications",
  "Alertes de renouvellement",
  "Rapports et statistiques",
  "Formations sur site disponibles",
];

export const HERO_POINTS = [
  { icon: "laptop", label: "100% en ligne", sub: "et en présentiel" },
  { icon: "badge", label: "Certificats vérifiables", sub: "en ligne" },
  { icon: "users", label: "Formateurs", sub: "experts" },
] as const;

/**
 * Témoignages : uniquement des avis authentiques, avec l'accord de la personne.
 * Tant que cette liste est vide, la section n'est pas affichée (aucun faux avis).
 */
export type Testimonial = { quote: string; name: string; role: string; rating?: 1 | 2 | 3 | 4 | 5; photo?: string };
export const TESTIMONIALS: Testimonial[] = [];

/** Partenaires : uniquement des organisations ayant donné leur accord. Section masquée tant que la liste est vide. */
export type Partner = { name: string; logo: string; href?: string };
export const PARTNERS: Partner[] = [];

/** Diapositives du carrousel de la page d'accueil ; `image` : photo de public/images/home (sans extension). */
export const HERO_SLIDES = [
  {
    id: "partenaire", image: "hero", badge: "Votre partenaire en formation sécurité",
    title: "Formez-vous aujourd’hui pour un environnement", highlight: "plus sûr demain",
    text: "Des formations certifiantes en sécurité, secourisme et sécurité incendie pour les particuliers, les entreprises et les professionnels.",
    cta: { label: "Découvrir nos formations", href: "/formations" },
  },
  {
    id: "securite-privee", image: "agent-securite", badge: "Sécurité privée",
    title: "Devenez un agent de sécurité", highlight: "qualifié et reconnu",
    text: "Maîtrisez le cadre légal, la prévention et les bonnes pratiques de terrain avec des formateurs experts.",
    cta: { label: "Voir les formations de sécurité", href: "/formations?categorie=securite-privee" },
  },
  {
    id: "secourisme", image: "secourisme", badge: "Secourisme au travail",
    title: "Apprenez les gestes qui", highlight: "sauvent des vies",
    text: "Des formations pratiques au secourisme en milieu professionnel, validées par un certificat vérifiable en ligne.",
    cta: { label: "Voir les formations de secourisme", href: "/formations?categorie=secourisme" },
  },
  {
    id: "incendie", image: "securite-incendie", badge: "Sécurité incendie",
    title: "Prévenez et maîtrisez le", highlight: "risque incendie",
    text: "Équipiers de première intervention, évacuation, extincteurs : formez vos équipes aux bons réflexes.",
    cta: { label: "Voir les formations incendie", href: "/formations?categorie=securite-incendie" },
  },
  {
    id: "entreprises", image: "entreprise", badge: "Pour les entreprises",
    title: "Formez vos équipes,", highlight: "protégez votre activité",
    text: "Suivi des collaborateurs, sessions sur mesure et certificats délivrés : une offre pensée pour les organisations.",
    cta: { label: "Découvrir l’offre entreprise", href: "/entreprises" },
  },
] as const;
