import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const uuid = /^[0-9a-f-]{36}$/i;

/** Télécharge un fichier complémentaire d'un contenu ; la RLS limite l'accès au formateur propriétaire et au personnel. */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(new URL("/connexion", request.url));
  if (!uuid.test(id)) return new NextResponse("Introuvable", { status: 404 });
  const { data: row } = await supabase.from("content_attachments").select("file_path, name").eq("id", id).maybeSingle<{ file_path: string | null; name: string }>();
  if (!row?.file_path) return new NextResponse("Introuvable", { status: 404 });
  const { data } = await supabase.storage.from("course-files").createSignedUrl(row.file_path, 300, { download: row.name });
  return data?.signedUrl ? NextResponse.redirect(data.signedUrl) : new NextResponse("Introuvable", { status: 404 });
}
