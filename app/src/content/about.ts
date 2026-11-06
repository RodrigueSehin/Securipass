/** Contenus éditoriaux de la page À propos. */

export const ABOUT_STORY = [
  "SECURIPASS est née de la volonté de contribuer à un environnement plus sûr en Afrique, en répondant aux besoins croissants de formation et de certification dans les métiers de la sécurité, du secourisme et de la sécurité incendie.",
  "Face aux défis de la sécurité dans les entreprises, les institutions et les espaces publics, nous développons une solution moderne, accessible et fiable pour former, certifier et suivre les compétences des professionnels et des particuliers.",
];

export const ABOUT_MISSION =
  "Rendre la formation en sécurité, secourisme et sécurité incendie accessible, pratique et certifiante pour tous, afin de contribuer à la protection des personnes, des biens et des organisations.";

export const ABOUT_VISION =
  "Devenir la référence africaine en matière de formation et de certification des compétences en sécurité, en innovant continuellement pour des environnements plus sûrs et plus résilients.";

export const ABOUT_VALUES = [
  "Sécurité et responsabilité",
  "Qualité et excellence",
  "Intégrité et transparence",
  "Innovation et accessibilité",
  "Engagement pour l’humain",
];

export const ABOUT_WHY = [
  { icon: "medal", tone: "text-cta", title: "Formations certifiantes", text: "Des parcours structurés, validés par des responsables pédagogiques." },
  { icon: "monitor", tone: "text-[#1479ff]", title: "Flexible et accessible", text: "En ligne et en présentiel, à votre rythme." },
  { icon: "users", tone: "text-success", title: "Formateurs experts", text: "Des professionnels dont les qualifications sont suivies." },
  { icon: "qr", tone: "text-danger", title: "Certificats vérifiables", text: "Avec QR Code unique et vérification en ligne." },
  { icon: "chart", tone: "text-[#7c4dff]", title: "Suivi et renouvellement", text: "Gestion des certifications et alertes d’expiration." },
  { icon: "building", tone: "text-brand", title: "Solutions pour entreprises", text: "Accompagnement sur mesure de vos équipes." },
] as const;

export const ABOUT_COMMITMENTS = [
  { icon: "shield", text: "Contribuer à la réduction des risques professionnels et des accidents." },
  { icon: "users", text: "Promouvoir une culture de prévention et de sécurité." },
  { icon: "cog", text: "Accompagner les entreprises dans la conformité réglementaire." },
  { icon: "chart", text: "Développer les compétences pour des carrières durables." },
] as const;

/**
 * Étapes de l'histoire de l'entreprise : à renseigner avec des faits réels et datés.
 * Tant que la liste est vide, la section « Notre parcours » n'est pas affichée (aucune histoire inventée).
 */
export type Milestone = { year: string; title: string; text: string };
export const MILESTONES: Milestone[] = [];

/** Équipe : à renseigner avec l'accord des personnes. Section masquée tant que la liste est vide. */
export type TeamMember = { name: string; role: string; photo?: string };
export const TEAM: TeamMember[] = [];
