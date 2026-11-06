import { ButtonLink } from "@/components/ui/button";

export const metadata = { title: "Compte suspendu" };

export default function SuspendedPage() {
  return (
    <div className="mx-auto max-w-md px-4 py-24 text-center">
      <h1 className="text-3xl font-extrabold text-brand-dark">Compte suspendu</h1>
      <p className="mt-3 text-muted">L’accès à votre compte a été suspendu par l’administration de SECURIPASS. Vos données sont conservées. Contactez le support pour en savoir plus.</p>
      <div className="mt-6 flex justify-center gap-3">
        <ButtonLink href="/contact">Contacter le support</ButtonLink>
        <ButtonLink href="/" variant="outline">Retour à l’accueil</ButtonLink>
      </div>
    </div>
  );
}
