/** Contenus éditoriaux de la page Contact. */

export const CONTACT_TOPIC_CARDS = [
  { value: "particulier", icon: "user", tone: "bg-cta", title: "Particulier", text: "Des informations sur une formation, une inscription ou une certification." },
  { value: "entreprise", icon: "building", tone: "bg-[#1479ff]", title: "Entreprise", text: "Un projet de formation pour vos équipes ou un partenariat." },
  { value: "institution", icon: "graduation", tone: "bg-[#7c4dff]", title: "Institution", text: "Une collaboration, un appel d’offres ou un projet institutionnel." },
  { value: "partenariat", icon: "handshake", tone: "bg-success", title: "Partenariat", text: "Une proposition de partenariat ou de collaboration." },
] as const;

export const CONTACT_FAQ = [
  { q: "Quels sont vos horaires d’ouverture ?", a: "Les horaires de l’équipe sont indiqués en haut de cette page, dans la rubrique « Nos horaires ». En dehors de ces créneaux, écrivez-nous via le formulaire : nous vous répondons dès la réouverture." },
  { q: "Comment s’inscrire à une formation ?", a: "Créez votre compte, choisissez une formation et une session dans le catalogue, puis validez votre inscription depuis votre espace apprenant." },
  { q: "Quels sont les modes de paiement acceptés ?", a: "Les moyens de paiement disponibles sont affichés au moment de l’inscription. Pour les entreprises, les modalités de règlement sont précisées dans l’offre ou le contrat." },
  { q: "Proposez-vous des formations sur site pour les entreprises ?", a: "Des sessions peuvent être organisées dans vos locaux selon la formation et le nombre de participants. Précisez-le dans votre demande d’offre entreprise." },
  { q: "Combien de temps pour obtenir le certificat ?", a: "Le certificat est délivré une fois la formation terminée et les conditions de réussite remplies ; vous le retrouvez ensuite dans votre espace, vérifiable en ligne par QR code." },
  { q: "Comment modifier une inscription ?", a: "Écrivez-nous via le formulaire en indiquant la formation et la session concernées ainsi que la modification souhaitée : nous revenons vers vous rapidement." },
] as const;
