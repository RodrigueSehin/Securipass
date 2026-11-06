import { Suspense } from "react";
import Link from "next/link";
import { Search } from "lucide-react";
import { Logo } from "@/components/ui/logo";
import { ButtonLink } from "@/components/ui/button";
import { getSessionInfo } from "@/lib/auth/session";
import { logout } from "@/lib/auth/actions";
import { HOME_CATEGORIES } from "@/content/home";
import { MobileNav, NavLinks } from "./nav-links";
import { TopBar } from "./top-bar";

const MENU_CATEGORIES = HOME_CATEGORIES.map((c) => ({ slug: c.slug, name: c.title }));

function GuestActions() {
  return (
    <>
      <ButtonLink href="/connexion" variant="outline" className="hidden sm:inline-flex">Se connecter</ButtonLink>
      <ButtonLink href="/inscription" variant="cta">S’inscrire</ButtonLink>
    </>
  );
}

/** Reflète l'état de connexion ; repli (visiteur) pendant le chargement. */
async function HeaderActions() {
  const session = await getSessionInfo();
  if (!session) return <GuestActions />;
  return (
    <>
      <ButtonLink href={session.home} variant="cta">Mon espace</ButtonLink>
      <form action={logout} className="hidden sm:block">
        <button className="rounded-lg border border-line px-3 py-2.5 text-sm font-medium text-brand-dark hover:bg-brand-soft">Déconnexion</button>
      </form>
    </>
  );
}

export function SiteHeader() {
  return (
    <>
    <TopBar />
    <header className="sticky top-0 z-40 bg-white shadow-[0_1px_0_var(--color-line)]">
      <div className="mx-auto flex h-[72px] max-w-7xl items-center justify-between gap-4 px-4">
        <Logo />
        <NavLinks categories={MENU_CATEGORIES} />
        <div className="flex items-center gap-2">
          <Link href="/formations" aria-label="Rechercher une formation" className="mr-1 rounded-full p-2 text-brand-dark hover:bg-brand-soft">
            <Search className="h-5 w-5" aria-hidden />
          </Link>
          <Suspense fallback={<GuestActions />}>
            <HeaderActions />
          </Suspense>
        </div>
      </div>
      <MobileNav />
    </header>
    </>
  );
}
