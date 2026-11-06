/**
 * Contenus de la page Formateurs. Les profils viennent de la table trainer_profiles (publiés par l'administration après vérification) ;
 * les avis d'apprenants restent masqués tant qu'aucun avis authentique n'est renseigné.
 * Photo d'un formateur : déposer public/images/trainers/<slug>.webp (sinon ses initiales sont affichées).
 */

export const TRAINER_DOMAINS = [
  { slug: "securite", label: "Agents de sécurité" },
  { slug: "secourisme", label: "Secourisme au travail" },
  { slug: "incendie", label: "Sécurité incendie" },
  { slug: "reglementation", label: "Réglementation" },
] as const;

export type TrainerDomain = (typeof TRAINER_DOMAINS)[number]["slug"];

export type Trainer = {
  slug: string;
  name: string;
  /** Intitulé court, ex. « Formateur en sécurité incendie ». */
  role: string;
  bio: string;
  domain: TrainerDomain;
  tags: string[];
};

export type LearnerTestimonial = { quote: string; name: string; role: string; rating?: 1 | 2 | 3 | 4 | 5 };
export const LEARNER_TESTIMONIALS: LearnerTestimonial[] = [];

export const HERO_POINTS = [
  { icon: "graduation", label: "Profils vérifiés", sub: "Qualifications contrôlées" },
  { icon: "users", label: "Expérience terrain", sub: "Des experts du métier" },
  { icon: "cog", label: "Pédagogie active", sub: "Apprendre par la pratique" },
  { icon: "star", label: "Suivi personnalisé", sub: "Accompagnement continu" },
] as const;

export const WHY_POINTS = [
  { icon: "file", tone: "bg-cta", title: "Qualifications vérifiées", text: "Des profils contrôlés avant d’être mis en avant." },
  { icon: "users", tone: "bg-[#1479ff]", title: "Expérience terrain", text: "Des années d’expérience dans leurs domaines." },
  { icon: "graduation", tone: "bg-success", title: "Pédagogie interactive", text: "Des méthodes basées sur la pratique et des cas réels." },
  { icon: "chart", tone: "bg-[#7c4dff]", title: "Suivi et évaluation", text: "Un accompagnement personnalisé de chaque apprenant." },
] as const;
