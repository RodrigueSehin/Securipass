import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const uuid = /^[0-9a-f-]{36}$/i;
const LINK_TTL_SECONDS = 300;

/**
 * Ouvre le document d'une leçon. La RLS sur learning_contents décide de l'accès : seul un inscrit à la formation
 * (ou le personnel) obtient une URL signée valable quelques minutes.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(new URL("/connexion", _request.url));
  if (!uuid.test(id)) return new NextResponse("Introuvable", { status: 404 });

  const { data: content } = await supabase
    .from("learning_contents")
    .select("file_path, external_url")
    .eq("id", id)
    .maybeSingle<{ file_path: string | null; external_url: string | null }>();
  if (!content) return new NextResponse("Introuvable", { status: 404 });

  if (content.external_url) return NextResponse.redirect(content.external_url);
  if (content.file_path) {
    const { data } = await supabase.storage.from("course-files").createSignedUrl(content.file_path, LINK_TTL_SECONDS);
    if (data?.signedUrl) return NextResponse.redirect(data.signedUrl);
  }
  return new NextResponse("Introuvable", { status: 404 });
}
