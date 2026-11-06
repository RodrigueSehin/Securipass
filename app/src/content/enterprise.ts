/** Contenus éditoriaux de la page Entreprises. */

export const ENTERPRISE_HERO_POINTS = [
  { icon: "clipboard", label: "Conformité", sub: "réglementaire" },
  { icon: "shield", label: "Réduction", sub: "des risques" },
  { icon: "users", label: "Employés", sub: "plus compétents" },
  { icon: "chart", label: "Suivi et rapports", sub: "en temps réel" },
] as const;

export const ENTERPRISE_HERO_CARD = {
  title: "Pensé pour les entreprises",
  points: ["Formations sur mesure", "Suivi des certifications", "Rapports de suivi", "Accompagnement dédié"],
};

export const ENTERPRISE_FEATURES = [
  { icon: "users", tone: "blue", title: "Gestion des employés", text: "Ajoutez vos collaborateurs et suivez leurs formations." },
  { icon: "puzzle", tone: "orange", title: "Formations sur mesure", text: "Des parcours adaptés à vos besoins." },
  { icon: "badge", tone: "green", title: "Suivi des certifications", text: "Suivez les dates d’obtention et d’expiration." },
  { icon: "bell", tone: "red", title: "Alertes et renouvellements", text: "Recevez des notifications automatiques." },
  { icon: "chart", tone: "purple", title: "Rapports et statistiques", text: "Tableaux de bord détaillés et exportables." },
  { icon: "clipboard", tone: "sky", title: "Suivi réglementaire", text: "Gardez la trace des formations exigées par votre secteur." },
] as const;

export const ENTERPRISE_STEPS = [
  { icon: "building", tone: "bg-brand-dark", title: "Créer votre compte", text: "Inscrivez votre entreprise en quelques minutes." },
  { icon: "users", tone: "bg-[#1479ff]", title: "Ajouter vos employés", text: "Importez vos collaborateurs ou ajoutez-les manuellement." },
  { icon: "file", tone: "bg-cta", title: "Choisir les formations", text: "Sélectionnez les formations adaptées à vos besoins." },
  { icon: "calendar", tone: "bg-success", title: "Suivre la progression", text: "Visualisez l’avancement en temps réel." },
  { icon: "award", tone: "bg-[#7c4dff]", title: "Obtenir les certificats", text: "Téléchargez et partagez les attestations." },
] as const;

export const ENTERPRISE_FAQ = [
  {
    q: "Comment inscrire nos employés ?",
    a: "Depuis votre espace entreprise, vous ajoutez vos collaborateurs un par un ou par import CSV, puis vous les inscrivez à une formation ou à une session. Chaque collaborateur reçoit une invitation par e-mail pour activer son compte.",
  },
  {
    q: "Peut-on avoir des formations sur mesure ?",
    a: "Oui. Décrivez votre besoin (domaine, nombre de collaborateurs, lieu) dans la demande d’offre : notre équipe pédagogique vous propose un programme et un devis adaptés.",
  },
  {
    q: "Les certificats sont-ils reconnus ?",
    a: "Chaque certificat SECURIPASS atteste que son titulaire a suivi la formation et rempli les conditions de réussite ; il est vérifiable en ligne grâce à un QR code. Il ne remplace pas une habilitation ou un agrément délivré par une autorité réglementaire : vérifiez les exigences qui s’appliquent à votre activité.",
  },
  {
    q: "Comment suivre les certifications de nos employés ?",
    a: "Votre tableau de bord présente les certificats valides, ceux qui arrivent à expiration et les renouvellements à planifier, avec des alertes avant les échéances.",
  },
  {
    q: "Proposez-vous des formations sur site ?",
    a: "Des sessions peuvent être organisées dans vos locaux selon la formation et le nombre de participants. Précisez-le dans votre demande d’offre.",
  },
  {
    q: "Quels sont les moyens de paiement ?",
    a: "Pour les entreprises, la facturation et les modalités de règlement sont précisées dans l’offre ou le contrat. Les moyens de paiement disponibles en ligne seront communiqués à l’ouverture du paiement sécurisé.",
  },
] as const;

export const ENTERPRISE_CTA_POINTS = ["Accompagnement dédié", "Formations adaptées", "Tarification sur mesure", "Mise en place rapide"];

/**
 * Témoignages d'entreprises : uniquement des avis authentiques, avec l'accord de l'entreprise.
 * Tant que cette liste est vide, la section n'est pas affichée (aucun faux avis).
 */
export type CompanyTestimonial = { quote: string; name: string; role: string; company: string; rating?: 1 | 2 | 3 | 4 | 5; photo?: string };
export const COMPANY_TESTIMONIALS: CompanyTestimonial[] = [];
