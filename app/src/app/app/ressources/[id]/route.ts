import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const uuid = /^[0-9a-f-]{36}$/i;
const LINK_TTL_SECONDS = 300;

/**
 * Télécharge une ressource de module. La RLS sur module_resources décide de l'accès : le formateur de la formation,
 * le personnel et les inscrits obtiennent une URL signée valable quelques minutes.
 */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(new URL("/connexion", request.url));
  if (!uuid.test(id)) return new NextResponse("Introuvable", { status: 404 });

  const { data: resource } = await supabase
    .from("module_resources")
    .select("file_path, name, module:course_modules(course:courses(allow_downloads, instructor_id))")
    .eq("id", id)
    .maybeSingle<{ file_path: string; name: string; module: { course: { allow_downloads: boolean; instructor_id: string } | null } | null }>();
  if (!resource) return new NextResponse("Introuvable", { status: 404 });
  // Téléchargement désactivé pour cette formation : seul son formateur peut encore récupérer les fichiers.
  const course = resource.module?.course;
  if (course && !course.allow_downloads && course.instructor_id !== user.id) {
    return new NextResponse("Le téléchargement des supports est désactivé pour cette formation.", { status: 403 });
  }

  const { data } = await supabase.storage.from("course-files").createSignedUrl(resource.file_path, LINK_TTL_SECONDS, { download: resource.name });
  if (data?.signedUrl) return NextResponse.redirect(data.signedUrl);
  return new NextResponse("Introuvable", { status: 404 });
}
