import type { Metadata } from "next";
import { LegalPage } from "@/components/public/legal-page";

export const metadata: Metadata = { title: "Conditions d’utilisation" };

export default function Page() {
  return (
    <LegalPage
      title="Conditions d’utilisation"
      sections={[
        { heading: "Objet", body: "À compléter : conditions d’accès et d’utilisation de la plateforme." },
        { heading: "Inscriptions, paiements et remboursements", body: "À compléter : conditions commerciales, annulation, remboursement, frais éventuels." },
        { heading: "Certificats", body: "À compléter : nature des documents délivrés, conditions d’obtention, expiration, suspension et révocation." },
      ]}
    />
  );
}
