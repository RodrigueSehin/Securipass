import Link from "next/link";
import { ChevronDown, LayoutDashboard, LogOut, User } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { logout } from "@/lib/auth/actions";
import { spacesForRoles } from "@/lib/auth/permissions";

/** Menu du compte : avatar (photo ou initiales), nom, rôle et menu déroulant (profil, déconnexion). */
export async function UserMenu({ roleLabel, currentHome }: { roleLabel: string; currentHome: string }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const [{ data: profile }, { data: roleRows }] = await Promise.all([
    supabase.from("profiles").select("full_name, photo_path").eq("id", user.id).maybeSingle(),
    supabase.from("user_roles").select("roles(code)").eq("user_id", user.id),
  ]);
  const roles = (roleRows ?? []).flatMap((r) => {
    const rel = r.roles as unknown as { code: string } | { code: string }[] | null;
    return Array.isArray(rel) ? rel.map((x) => x.code) : rel ? [rel.code] : [];
  });
  // Autres espaces accessibles : l'espace courant n'est pas répété.
  const spaces = spacesForRoles(roles).filter((s) => s.href !== currentHome);
  const name = profile?.full_name || user.email || "Mon compte";
  const photoUrl = profile?.photo_path
    ? (await supabase.storage.from("profile-photos").createSignedUrl(profile.photo_path, 300)).data?.signedUrl ?? null
    : null;
  const initials = name.split(/\s+/).filter(Boolean).slice(0, 2).map((p: string) => p[0]?.toUpperCase()).join("");

  return (
    <details className="relative">
      <summary className="flex cursor-pointer list-none items-center gap-3 rounded-lg p-1 hover:bg-brand-soft [&::-webkit-details-marker]:hidden">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-brand-soft text-sm font-extrabold text-brand">
          {photoUrl
            // eslint-disable-next-line @next/next/no-img-element
            ? <img src={photoUrl} alt="" className="h-full w-full object-cover" />
            : <span aria-hidden>{initials || "?"}</span>}
        </span>
        <span className="hidden min-w-0 text-left leading-tight sm:block">
          <span className="block max-w-[11rem] truncate text-sm font-bold text-brand-dark">{name}</span>
          <span className="block text-xs text-muted">{roleLabel}</span>
        </span>
        <ChevronDown className="h-4 w-4 text-muted" aria-hidden />
        <span className="sr-only">Menu du compte</span>
      </summary>
      <div className="absolute right-0 z-40 mt-2 w-56 rounded-xl border border-line bg-white py-1 shadow-card">
        <Link href="/app/profil" className="flex items-center gap-2 px-4 py-2.5 text-sm text-brand-dark hover:bg-surface">
          <User className="h-4 w-4" aria-hidden /> Mon profil
        </Link>
        {spaces.length > 0 && (
          <div className="border-y border-line py-1">
            <p className="px-4 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wide text-muted">Mes espaces</p>
            {spaces.map((s) => (
              <Link key={s.href} href={s.href} className="flex items-center gap-2 px-4 py-2.5 text-sm text-brand-dark hover:bg-surface">
                <LayoutDashboard className="h-4 w-4" aria-hidden /> {s.label}
              </Link>
            ))}
          </div>
        )}
        <form action={logout}>
          <button className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm text-danger hover:bg-surface">
            <LogOut className="h-4 w-4" aria-hidden /> Déconnexion
          </button>
        </form>
      </div>
    </details>
  );
}

export function UserMenuFallback() {
  return <div className="h-10 w-40 animate-pulse rounded bg-surface" aria-hidden />;
}
