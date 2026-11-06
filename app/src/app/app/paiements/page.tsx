import Link from "next/link";
import { CreditCard, ShieldCheck } from "lucide-react";
import { Alert, EmptyState, PageHeader } from "@/components/ui/feedback";

export const metadata = { title: "Mes paiements" };

/**
 * Lot 6 non livré : aucun paiement n'est enregistré et aucun moyen de paiement n'est configuré.
 * La page l'indique au lieu d'afficher des montants ou des transactions fictifs.
 */
export default function PaymentsPage() {
  return (
    <>
      <PageHeader title="Mes paiements" description="Historique de vos paiements, reçus et factures." />
      <div className="space-y-6">
        <Alert tone="info">
          Les paiements en ligne ne sont pas encore ouverts. Les formations gratuites s’ouvrent directement depuis le catalogue ;
          les formations payantes seront disponibles avec le paiement sécurisé.
        </Alert>
        <EmptyState title="Aucun paiement pour le moment">
          <span className="flex flex-col items-center gap-3">
            <CreditCard className="h-8 w-8 text-muted" aria-hidden />
            Votre historique de paiements, vos reçus et vos factures apparaîtront ici.
          </span>
        </EmptyState>
        <section aria-labelledby="moyens" className="rounded-2xl border border-line bg-white p-5">
          <h2 id="moyens" className="mb-2 font-bold text-brand-dark">Moyens de paiement</h2>
          <p className="text-sm text-muted">Aucun moyen de paiement n’est enregistré. Les moyens acceptés (Mobile Money, carte bancaire) dépendront du prestataire de paiement retenu.</p>
          <p className="mt-3 flex items-center gap-2 text-xs text-muted"><ShieldCheck className="h-4 w-4 text-success" aria-hidden />Vos données de paiement ne seront jamais stockées par SECURIPASS.</p>
        </section>
        <p className="text-sm text-muted">
          Une question sur une inscription ? <Link href="/app/messages" className="font-semibold text-brand hover:underline">Écrire au support</Link>.
        </p>
      </div>
    </>
  );
}
