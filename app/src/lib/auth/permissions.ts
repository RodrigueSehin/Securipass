export const ROLES = [
  "learner",
  "instructor",
  "company",
  "admin",
  "pedagogy_manager",
  "certification_manager",
  "support",
] as const;
export type Role = (typeof ROLES)[number];

/** Espaces connectés et rôles autorisés à y accéder (contrôle serveur, en plus de la RLS). */
export const AREA_ROLES = {
  "/app": ["learner", "instructor", "company", "admin", "pedagogy_manager", "certification_manager", "support"],
  "/formateur": ["instructor", "admin"],
  "/entreprise": ["company", "admin"],
  "/admin": ["admin", "pedagogy_manager", "certification_manager", "support"],
} as const satisfies Record<string, readonly Role[]>;

export type Area = keyof typeof AREA_ROLES;

export function areaForPath(pathname: string): Area | null {
  const hit = (Object.keys(AREA_ROLES) as Area[]).find(
    (a) => pathname === a || pathname.startsWith(`${a}/`),
  );
  return hit ?? null;
}

export function canAccessArea(roles: readonly string[], area: Area): boolean {
  const allowed: readonly string[] = AREA_ROLES[area];
  return roles.some((r) => allowed.includes(r));
}

/** Espace d'atterrissage après connexion, selon le rôle le plus privilégié. */
export function homeForRoles(roles: readonly string[]): string {
  if (roles.includes("admin")) return "/admin";
  if (roles.some((r) => ["pedagogy_manager", "certification_manager", "support"].includes(r))) return "/admin";
  if (roles.includes("instructor")) return "/formateur";
  if (roles.includes("company")) return "/entreprise";
  return "/app";
}

/** Espaces proposés dans le menu du compte : ceux auxquels l'utilisateur a accès (l'espace apprenant demande le rôle apprenant ou admin). */
export const SPACE_LABELS: Record<Area, string> = {
  "/app": "Espace apprenant",
  "/formateur": "Espace formateur",
  "/entreprise": "Espace entreprise",
  "/admin": "Administration",
};

export function spacesForRoles(roles: readonly string[]): { label: string; href: Area }[] {
  return (Object.keys(AREA_ROLES) as Area[])
    .filter((a) => canAccessArea(roles, a) && (a !== "/app" || roles.includes("learner") || roles.includes("admin")))
    .map((a) => ({ label: SPACE_LABELS[a], href: a }));
}
