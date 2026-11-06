import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const uuid = /^[0-9a-f-]{36}$/i;
const LINK_TTL_SECONDS = 300;

/** Télécharge une pièce jointe. La RLS ne laisse lire le message qu'aux participants de la conversation. */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(new URL("/connexion", request.url));
  if (!uuid.test(id)) return new NextResponse("Introuvable", { status: 404 });

  const { data: message } = await supabase
    .from("messages")
    .select("attachment_path, attachment_name")
    .eq("id", id)
    .maybeSingle<{ attachment_path: string | null; attachment_name: string | null }>();
  if (!message?.attachment_path) return new NextResponse("Introuvable", { status: 404 });

  const { data } = await supabase.storage.from("message-files").createSignedUrl(message.attachment_path, LINK_TTL_SECONDS, {
    download: message.attachment_name ?? true,
  });
  if (!data?.signedUrl) return new NextResponse("Fichier indisponible", { status: 404 });
  return NextResponse.redirect(data.signedUrl);
}
