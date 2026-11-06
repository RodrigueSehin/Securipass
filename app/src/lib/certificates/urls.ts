/** Adresse de vérification publique, encodée dans le QR code et le PDF. */
export function verificationUrl(token: string): string {
  const site = (process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000").replace(/\/$/, "");
  return `${site}/verifier?code=${encodeURIComponent(token)}`;
}
