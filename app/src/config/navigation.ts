export type NavItem = {
  label: string;
  href: string;
  icon: string;
  /** Module pas encore livré : affiché désactivé avec une explication (jamais de bouton factice). */
  soon?: boolean;
};

export type AreaNav = { title: string; home: string; items: NavItem[] };

const soon = (label: string, href: string, icon: string): NavItem => ({ label, href, icon, soon: true });

export const LEARNER_NAV: AreaNav = {
  title: "Espace apprenant",
  home: "/app",
  items: [
    { label: "Accueil", href: "/app", icon: "home" },
    { label: "Mes formations", href: "/app/formations", icon: "book" },
    { label: "Catalogue", href: "/app/catalogue", icon: "grid" },
    { label: "Mes inscriptions", href: "/app/inscriptions", icon: "list" },
    { label: "Mes évaluations", href: "/app/evaluations", icon: "check" },
    { label: "Mes certificats", href: "/app/certificats", icon: "trophy" },
    { label: "Mon Security Pass", href: "/app/security-pass", icon: "id" },
    { label: "Mes paiements", href: "/app/paiements", icon: "card" },
    { label: "Notifications", href: "/app/notifications", icon: "bell" },
    { label: "Messages", href: "/app/messages", icon: "message" },
    { label: "Support", href: "/contact", icon: "support" },
    { label: "Mon profil", href: "/app/profil", icon: "user" },
  ],
};

export const INSTRUCTOR_NAV: AreaNav = {
  title: "Espace formateur",
  home: "/formateur",
  items: [
    { label: "Tableau de bord", href: "/formateur", icon: "home" },
    { label: "Mes formations", href: "/formateur/formations", icon: "book" },
    { label: "Contenus pédagogiques", href: "/formateur/contenus", icon: "file" },
    { label: "Mes sessions", href: "/formateur/sessions", icon: "calendar" },
    { label: "Mes apprenants", href: "/formateur/apprenants", icon: "users" },
    { label: "Évaluations", href: "/formateur/evaluations", icon: "check" },
    soon("Présences", "/formateur/presences", "list"),
    { label: "Certifications", href: "/formateur/certifications", icon: "trophy" },
    soon("Rapports", "/formateur/rapports", "chart"),
    soon("Revenus", "/formateur/revenus", "card"),
    soon("Messages", "/formateur/messages", "message"),
    { label: "Mon profil", href: "/app/profil", icon: "user" },
  ],
};

export const COMPANY_NAV: AreaNav = {
  title: "Espace entreprise",
  home: "/entreprise",
  items: [
    { label: "Tableau de bord", href: "/entreprise", icon: "home" },
    soon("Collaborateurs", "/entreprise/collaborateurs", "users"),
    { label: "Catalogue", href: "/formations", icon: "grid" },
    soon("Inscriptions", "/entreprise/inscriptions", "list"),
    soon("Sessions", "/entreprise/sessions", "calendar"),
    soon("Certifications", "/entreprise/certifications", "trophy"),
    soon("Rapports", "/entreprise/rapports", "chart"),
    soon("Demandes de devis", "/entreprise/devis", "file"),
    soon("Factures et paiements", "/entreprise/factures", "card"),
    soon("Paramètres", "/entreprise/parametres", "settings"),
  ],
};

export const ADMIN_NAV: AreaNav = {
  title: "Administration",
  home: "/admin",
  items: [
    { label: "Tableau de bord", href: "/admin", icon: "home" },
    { label: "Utilisateurs", href: "/admin/utilisateurs", icon: "users" },
    { label: "Apprenants", href: "/admin/apprenants", icon: "users" },
    { label: "Formateurs", href: "/admin/formateurs", icon: "users" },
    { label: "Entreprises", href: "/admin/entreprises", icon: "building" },
    { label: "Formations", href: "/admin/formations", icon: "grad" },
    { label: "Catégories", href: "/admin/categories", icon: "grid" },
    { label: "Sessions", href: "/admin/sessions", icon: "calendar" },
    { label: "Inscriptions", href: "/admin/inscriptions", icon: "list" },
    { label: "Évaluations", href: "/admin/evaluations", icon: "check" },
    { label: "Présences", href: "/admin/presences", icon: "presence" },
    { label: "Certifications", href: "/admin/certifications", icon: "trophy" },
    { label: "Paiements", href: "/admin/paiements", icon: "card" },
    { label: "Factures et remboursements", href: "/admin/factures", icon: "receipt" },
    soon("Commissions et versements", "/admin/commissions", "coins"),
    soon("Rapports", "/admin/rapports", "chart"),
    { label: "Blog et contenus publics", href: "/admin/blog", icon: "news" },
    soon("Notifications", "/admin/notifications", "bell"),
    soon("Support", "/admin/support", "support"),
    soon("Paramètres", "/admin/parametres", "settings"),
    soon("Journal d'audit", "/admin/audit", "log"),
  ],
};
