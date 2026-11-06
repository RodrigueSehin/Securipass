import { ButtonLink } from "@/components/ui/button";

export const metadata = { title: "Accès refusé" };

export default function ForbiddenPage() {
  return (
    <div className="mx-auto max-w-md px-4 py-24 text-center">
      <h1 className="text-3xl font-extrabold text-brand-dark">Accès refusé</h1>
      <p className="mt-3 text-muted">Votre compte n’a pas les autorisations nécessaires pour consulter cet espace.</p>
      <ButtonLink href="/" className="mt-6">Retour à l’accueil</ButtonLink>
    </div>
  );
}
