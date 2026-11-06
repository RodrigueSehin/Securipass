/** Codes d'erreur levés par les fonctions SQL d'inscription → messages utilisateur. */
const MESSAGES: Record<string, string> = {
  not_authenticated: "Connectez-vous pour continuer.",
  course_not_available: "Cette formation n’est pas disponible à l’inscription.",
  payment_required: "Cette formation est payante : l’inscription en ligne ouvrira avec le paiement sécurisé.",
  prerequisite_missing: "Vous devez d’abord avoir terminé la formation prérequise.",
  already_enrolled: "Vous êtes déjà inscrit à cette formation.",
  session_required: "Choisissez une session pour vous inscrire.",
  session_invalid: "Cette session n’est plus disponible.",
  registration_closed: "Les inscriptions à cette session sont closes.",
  session_full: "Cette session est complète.",
  forbidden: "Vous n’avez pas l’autorisation d’effectuer cette action.",
  learner_not_found: "Aucun compte SECURIPASS n’existe avec cette adresse e-mail. Demandez à l’apprenant de créer son compte.",
  enrollment_not_found: "Inscription introuvable.",
  not_cancellable: "Cette inscription ne peut plus être annulée.",
  session_started: "La session a déjà commencé : contactez le formateur pour annuler.",
  access_code_invalid: "Le code d’accès est incorrect. Vérifiez-le auprès du formateur.",
  not_pending: "Cette demande a déjà été traitée.",
  registrations_closed_course: "Les inscriptions à cette formation sont fermées pour le moment.",
  capacity_below_enrolled: "La capacité ne peut pas être inférieure au nombre d’inscrits.",
};

export function enrollmentErrorMessage(message: string | undefined): string {
  if (!message) return "Une erreur est survenue. Réessayez.";
  const code = Object.keys(MESSAGES).find((k) => message.includes(k));
  return code ? MESSAGES[code] : "Une erreur est survenue. Réessayez.";
}
