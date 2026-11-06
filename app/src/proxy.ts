import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { areaForPath, canAccessArea } from "@/lib/auth/permissions";

/** Rafraîchit la session et protège les espaces connectés (première barrière ; la RLS reste la vraie). */
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll(list) {
          list.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          list.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        },
      },
    },
  );

  // getUser() valide le jeton auprès du serveur d'authentification (≠ getSession()).
  const { data: { user } } = await supabase.auth.getUser();
  const area = areaForPath(request.nextUrl.pathname);
  if (!area) return response;

  if (!user) {
    const url = request.nextUrl.clone();
    url.pathname = "/connexion";
    url.search = `?redirect=${encodeURIComponent(request.nextUrl.pathname)}`;
    return NextResponse.redirect(url);
  }

  // Compte suspendu par l'administration : plus d'accès aux espaces connectés
  const { data: profile } = await supabase.from("profiles").select("status").eq("id", user.id).maybeSingle<{ status: string }>();
  if (profile?.status === "suspended") {
    const url = request.nextUrl.clone();
    url.pathname = "/compte-suspendu";
    url.search = "";
    return NextResponse.rewrite(url, { status: 403 });
  }

  const { data } = await supabase
    .from("user_roles")
    .select("roles(code)")
    .eq("user_id", user.id);
  const roles = (data ?? []).flatMap((r) => {
    const rel = r.roles as unknown as { code: string } | { code: string }[] | null;
    return Array.isArray(rel) ? rel.map((x) => x.code) : rel ? [rel.code] : [];
  });

  if (!canAccessArea(roles, area)) {
    const url = request.nextUrl.clone();
    url.pathname = "/acces-refuse";
    url.search = "";
    return NextResponse.rewrite(url, { status: 403 });
  }
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|webp|ico)$).*)"],
};
