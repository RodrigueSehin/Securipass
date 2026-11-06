/**
 * Contenus du blog. Les articles sont rédigés par l'équipe : en attendant l'administration (Lot 8, table blog_posts),
 * cette liste est la source. `image` : chemin sous public/images/ (sans extension) ; sans image, une tuile illustrée est affichée.
 * Ajouter les photos manquantes dans maquettes/images/ puis lancer `npm run images` (voir scripts/optimize-images.mjs).
 */

export const BLOG_CATEGORIES = [
  { slug: "agent-securite", label: "Agent de sécurité", icon: "shield", tone: "bg-[#1479ff]" },
  { slug: "secourisme", label: "Secourisme au travail", icon: "plus", tone: "bg-success" },
  { slug: "securite-incendie", label: "Sécurité incendie", icon: "flame", tone: "bg-[#f2551c]" },
  { slug: "reglementation", label: "Réglementation", icon: "scale", tone: "bg-[#7c4dff]" },
  { slug: "entreprise", label: "Entreprise", icon: "building", tone: "bg-cta" },
  { slug: "temoignages", label: "Témoignages", icon: "quote", tone: "bg-[#8b3fd9]" },
] as const;

export type BlogCategorySlug = (typeof BLOG_CATEGORIES)[number]["slug"];

export type BlogPost = {
  slug: string;
  title: string;
  excerpt: string;
  category: BlogCategorySlug;
  /** Date de publication (ISO). */
  date: string;
  readMinutes: number;
  image?: string;
  popular?: number;
};

export const BLOG_POSTS: BlogPost[] = [
  {
    slug: "bien-utiliser-un-extincteur", category: "securite-incendie", date: "2026-10-12T09:00:00+00:00", readMinutes: 5, popular: 1,
    title: "Comment bien utiliser un extincteur ? Guide pratique étape par étape",
    excerpt: "Apprenez les gestes essentiels pour maîtriser un départ de feu et assurer votre sécurité et celle des autres.",
    image: "blog/extincteur",
  },
  {
    slug: "gestes-qui-sauvent-arret-cardiaque", category: "secourisme", date: "2026-10-08T09:00:00+00:00", readMinutes: 6, popular: 2,
    title: "Les gestes qui sauvent : que faire en cas d’arrêt cardiaque ?",
    excerpt: "Découvrez les étapes clés de la réanimation cardiopulmonaire (RCP) et augmentez vos chances de sauver une vie.",
    image: "home/secourisme",
  },
  {
    slug: "role-de-l-agent-de-securite", category: "agent-securite", date: "2026-10-05T09:00:00+00:00", readMinutes: 4,
    title: "Le rôle de l’agent de sécurité dans la prévention des risques",
    excerpt: "Zoom sur les missions, les compétences et l’importance de l’agent de sécurité dans votre environnement de travail.",
    image: "home/agent-securite",
  },
  {
    slug: "normes-et-obligations-hse", category: "reglementation", date: "2026-09-28T09:00:00+00:00", readMinutes: 7, popular: 4,
    title: "Normes et obligations en matière de sécurité au travail en Côte d’Ivoire",
    excerpt: "Tout ce qu’il faut savoir sur la réglementation HSE et les obligations légales des employeurs.",
    image: "blog/reglementation",
  },
  {
    slug: "pourquoi-former-ses-employes", category: "entreprise", date: "2026-09-22T09:00:00+00:00", readMinutes: 5, popular: 3,
    title: "Pourquoi former ses employés en sécurité ?",
    excerpt: "Les avantages pour les entreprises : réduction des risques, conformité réglementaire et meilleure performance.",
    image: "home/entreprise",
  },
  {
    slug: "videosurveillance-securite-des-sites", category: "agent-securite", date: "2026-09-18T09:00:00+00:00", readMinutes: 6,
    title: "Vidéosurveillance : un outil efficace pour la sécurité des sites",
    excerpt: "Comment la vidéosurveillance contribue à la prévention des risques et à la protection des biens et des personnes.",
    image: "blog/videosurveillance",
  },
  {
    slug: "trousse-de-premiers-secours", category: "secourisme", date: "2026-09-12T09:00:00+00:00", readMinutes: 4, popular: 5,
    title: "La trousse de premiers secours : que doit-elle contenir ?",
    excerpt: "Liste complète du matériel indispensable et conseils pour bien l’utiliser.",
    image: "blog/trousse-secours",
  },
  {
    slug: "types-d-incendies-et-extinction", category: "securite-incendie", date: "2026-09-08T09:00:00+00:00", readMinutes: 5,
    title: "Les différents types d’incendies et leurs modes d’extinction",
    excerpt: "Comprendre les classes de feu pour choisir le bon moyen d’extinction.",
    image: "home/securite-incendie",
  },
];

export const BLOG_TAGS = [
  "Sécurité incendie", "Premiers secours", "Agent de sécurité", "Réglementation", "Vidéosurveillance", "Prévention", "Entreprise", "HSE", "Formation", "SST",
] as const;

export const BLOG_PAGE_SIZE = 9;
