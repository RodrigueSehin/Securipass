import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { renderCertificatePdf, type CertificateContent } from "@/lib/certificates/pdf";
import { verificationUrl } from "@/lib/certificates/urls";

const uuid = /^[0-9a-f-]{36}$/i;
const LINK_TTL_SECONDS = 300;

/**
 * Télécharge la copie PDF d'un certificat. La lecture de la ligne passe par la RLS (titulaire ou personnel de la
 * formation) ; seule une URL signée valable quelques minutes est remise.
 *
 * Un certificat délivré automatiquement n'a pas encore de fichier : il est généré à la première demande, à partir de la copie
 * figée à l'émission, puis conservé.
 */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(new URL("/connexion", request.url));
  if (!uuid.test(id)) return new NextResponse("Introuvable", { status: 404 });

  const { data: cert } = await supabase
    .from("certificates")
    .select("pdf_path, certificate_number, verification_token, content")
    .eq("id", id)
    .maybeSingle<{ pdf_path: string | null; certificate_number: string; verification_token: string; content: CertificateContent }>();
  if (!cert?.pdf_path) return new NextResponse("Copie PDF introuvable", { status: 404 });

  const sign = () => supabase.storage.from("certificates").createSignedUrl(cert.pdf_path!, LINK_TTL_SECONDS, { download: `${cert.certificate_number}.pdf` });
  let { data } = await sign();
  if (!data?.signedUrl) {
    try {
      const bytes = await renderCertificatePdf(cert.content, { number: cert.certificate_number, verifyUrl: verificationUrl(cert.verification_token) });
      const { error } = await createAdminClient().storage.from("certificates")
        .upload(cert.pdf_path, new Blob([new Uint8Array(bytes)], { type: "application/pdf" }), { contentType: "application/pdf", upsert: true });
      if (!error) ({ data } = await sign());
    } catch {
      // La génération a échoué : la réponse ci-dessous l'indique.
    }
  }
  if (!data?.signedUrl) return new NextResponse("Copie PDF indisponible", { status: 404 });
  return NextResponse.redirect(data.signedUrl);
}
