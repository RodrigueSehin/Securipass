/** Navigation principale du site public (module neutre : utilisé par composants serveur et client). */
export const NAV = [
  { href: "/", label: "Accueil" },
  { href: "/formations", label: "Formations", menu: true },
  { href: "/entreprises", label: "Entreprises" },
  { href: "/certification", label: "Certification" },
  { href: "/formateurs", label: "Formateurs" },
  { href: "/blog", label: "Blog" },
  { href: "/a-propos", label: "À propos" },
  { href: "/contact", label: "Contact" },
] as const;
