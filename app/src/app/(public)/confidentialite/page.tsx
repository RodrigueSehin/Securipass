import type { Metadata } from "next";
import { LegalPage } from "@/components/public/legal-page";

export const metadata: Metadata = { title: "Politique de confidentialité" };

export default function Page() {
  return (
    <LegalPage
      title="Politique de confidentialité"
      sections={[
        { heading: "Données collectées", body: "Identité, coordonnées, parcours de formation, résultats, présences, certificats et données de paiement traitées par le prestataire. À détailler." },
        { heading: "Finalités et bases légales", body: "À compléter : gestion des inscriptions, délivrance et vérification des certificats, facturation, support." },
        { heading: "Vérification publique des certificats", body: "Seules les informations autorisées sont affichées publiquement (numéro, titulaire selon la politique, formation, dates, statut). À préciser." },
        { heading: "Vos droits et durées de conservation", body: "À compléter : accès, rectification, suppression, opposition, contact du responsable du traitement, durées de conservation." },
      ]}
    />
  );
}
