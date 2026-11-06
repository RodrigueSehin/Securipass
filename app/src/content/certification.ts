/** Contenus de la page Certifications. */

export const CERT_HERO_POINTS = [
  { icon: "shield", label: "Certificats", sub: "vérifiables en ligne" },
  { icon: "users", label: "Pensés pour", sub: "les entreprises" },
  { icon: "badge", label: "Conformes à notre", sub: "référentiel pédagogique" },
  { icon: "lock", label: "Sécurisés avec", sub: "QR Code unique" },
] as const;

export const CERT_STEPS = [
  { icon: "book", tone: "bg-brand-dark", title: "Suivi de la formation", text: "Cours en ligne et/ou sessions pratiques" },
  { icon: "quiz", tone: "bg-[#1479ff]", title: "Évaluations", text: "Quiz, examens théoriques et pratiques" },
  { icon: "check", tone: "bg-cta", title: "Validation", text: "Par nos formateurs experts" },
  { icon: "cert", tone: "bg-brand-dark", title: "Délivrance du certificat", text: "Certificat numérique avec QR Code" },
  { icon: "verify", tone: "bg-[#7c4dff]", title: "Vérification", text: "Authentification en ligne à tout moment" },
] as const;

export const CERT_EXAMPLES = [
  { tone: "blue", label: "Certificat Agent de sécurité", course: "Agent de prévention et de sécurité" },
  { tone: "green", label: "Certificat Secourisme au travail", course: "Secourisme au travail" },
  { tone: "red", label: "Certificat Sécurité incendie", course: "Sécurité incendie" },
] as const;

export const CERT_ENTERPRISE_POINTS = ["Gestion centralisée des certificats", "Suivi des renouvellements", "Rapports et statistiques", "Vérification simplifiée"];

export const CERT_FAQ = [
  { q: "Les certificats SECURIPASS sont-ils reconnus ?", a: "Chaque certificat SECURIPASS atteste que son titulaire a suivi la formation et rempli les conditions de réussite ; il est vérifiable en ligne. Il ne remplace pas une habilitation ou un agrément délivré par une autorité réglementaire : vérifiez les exigences qui s’appliquent à votre activité." },
  { q: "Comment vérifier un certificat ?", a: "Saisissez le numéro indiqué sur le document ou scannez son QR Code. Le statut réel du certificat (valide, expiré, suspendu ou révoqué) s’affiche à la vérification dès l’ouverture du service." },
  { q: "Quelle est la durée de validité d’un certificat ?", a: "Elle dépend de la formation : la durée de validité (en mois) est indiquée sur la fiche de la formation et sur le certificat, avec sa date d’expiration." },
  { q: "Le certificat est-il envoyé en version papier ?", a: "Le certificat est numérique : vous le téléchargez depuis votre espace et vous pouvez le partager ou l’imprimer. Son QR Code permet de contrôler son authenticité." },
  { q: "Que faire en cas de perte du certificat ?", a: "Votre certificat reste disponible dans votre espace apprenant : vous pouvez le télécharger à nouveau à tout moment. En cas de difficulté, contactez-nous." },
  { q: "Les entreprises peuvent-elles vérifier les certificats ?", a: "Oui. La vérification est ouverte à tous avec le numéro ou le QR Code du certificat, sans compte. Les entreprises clientes suivent en plus les certificats de leurs employés depuis leur espace." },
] as const;
