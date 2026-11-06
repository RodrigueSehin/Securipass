/** Statut d'un certificat tel qu'affiché à l'apprenant : l'expiration se déduit de la date de validité. */
export type CertificateDisplayStatus = { label: string; tone: "success" | "warning" | "danger"; valid: boolean };

export function certificateDisplayStatus(
  c: { status: "valid" | "suspended" | "revoked"; valid_until: string | null },
  now = Date.now(),
): CertificateDisplayStatus {
  if (c.status === "revoked") return { label: "Révoqué", tone: "danger", valid: false };
  if (c.status === "suspended") return { label: "Suspendu", tone: "warning", valid: false };
  if (c.valid_until && new Date(c.valid_until).getTime() <= now) return { label: "Expiré", tone: "warning", valid: false };
  return { label: "Valide", tone: "success", valid: true };
}
