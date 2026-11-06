import type { Metadata } from "next";
import { LegalPage } from "@/components/public/legal-page";

export const metadata: Metadata = { title: "Mentions légales" };

export default function Page() {
  return (
    <LegalPage
      title="Mentions légales"
      sections={[
        { heading: "Éditeur du site", body: "À compléter : raison sociale, forme juridique, capital, numéro d’immatriculation, siège social, directeur de la publication." },
        { heading: "Hébergement", body: "À compléter : nom et coordonnées de l’hébergeur." },
        { heading: "Propriété intellectuelle", body: "À compléter : droits sur les contenus, marques et supports pédagogiques." },
      ]}
    />
  );
}
