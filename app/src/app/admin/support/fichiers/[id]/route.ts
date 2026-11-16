import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const uuid = /^[0-9a-f-]{36}$/i;
const LINK_TTL_SECONDS = 120;

/** Télécharge une pièce jointe d'un ticket. Réservé aux administrateurs : la RLS de la table et du stockage refuse tout autre accès. */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(new URL("/connexion", request.url));
  if (!uuid.test(id)) return new NextResponse("Introuvable", { status: 404 });
  const { data: isAdmin } = await supabase.rpc("has_role", { _role: "admin" });
  if (!isAdmin) return new NextResponse("Accès refusé", { status: 403 });

  const { data: file } = await supabase.from("support_ticket_files").select("path, name").eq("id", id).maybeSingle<{ path: string; name: string }>();
  if (!file) return new NextResponse("Introuvable", { status: 404 });
  // ?apercu=1 : affichage en ligne (aperçu dans l'onglet) ; sinon téléchargement
  const preview = new URL(request.url).searchParams.get("apercu") === "1";
  const { data } = await supabase.storage.from("support-files").createSignedUrl(file.path, LINK_TTL_SECONDS, preview ? undefined : { download: file.name });
  if (!data?.signedUrl) return new NextResponse("Fichier indisponible", { status: 404 });
  return NextResponse.redirect(data.signedUrl);
}
