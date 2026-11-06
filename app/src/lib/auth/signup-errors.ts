/** Codes d'erreur de l'authentification Supabase à l'inscription → messages utilisateur. */
const MESSAGES: Record<string, string> = {
  user_already_exists: "Un compte existe déjà avec cette adresse e-mail. Connectez-vous.",
  email_exists: "Un compte existe déjà avec cette adresse e-mail. Connectez-vous.",
  email_address_invalid: "Cette adresse e-mail n’est pas valide.",
  weak_password: "Ce mot de passe est trop faible. Choisissez-en un plus long et moins courant.",
  over_email_send_rate_limit: "Trop de demandes d’e-mail. Réessayez dans quelques minutes.",
  over_request_rate_limit: "Trop de tentatives. Réessayez dans quelques minutes.",
  signup_disabled: "Les inscriptions sont momentanément fermées.",
};

/**
 * Message affiché à l'inscription. Pour une erreur inconnue, le code est repris entre parenthèses :
 * l'utilisateur peut le transmettre au support, qui le retrouve dans le journal d'authentification.
 */
export function signupErrorMessage(code: string | undefined): string {
  if (code && MESSAGES[code]) return MESSAGES[code];
  const ref = code ? ` (code : ${code})` : "";
  return `Le compte n’a pas pu être créé${ref}. Réessayez dans quelques instants ; si le problème persiste, contactez le support.`;
}
