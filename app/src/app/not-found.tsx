import { ButtonLink } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-md px-4 py-24 text-center">
      <h1 className="text-3xl font-extrabold text-brand-dark">Page introuvable</h1>
      <p className="mt-3 text-muted">La page demandée n’existe pas ou n’est plus disponible.</p>
      <ButtonLink href="/" className="mt-6">Retour à l’accueil</ButtonLink>
    </div>
  );
}
