import { Suspense } from "react";
import type { Metadata } from "next";
import { PageHero, Section } from "@/components/public/page-hero";
import { Alert, StatusBadge } from "@/components/ui/feedback";
import { formatDate } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Vérifier un certificat" };

type Result = {
  found: boolean;
  certificate_number?: string;
  holder_name?: string;
  course_title?: string;
  issued_at?: string;
  valid_until?: string | null;
  issuer?: string;
  status?: "valid" | "suspended" | "revoked" | "expired";
  revoked_at?: string | null;
};

const STATUS = {
  valid: { label: "Valide", tone: "success", text: "Ce certificat a été émis par SECURIPASS et est valide." },
  expired: { label: "Expiré", tone: "warning", text: "Ce certificat a bien été émis, mais sa durée de validité est dépassée." },
  suspended: { label: "Suspendu", tone: "warning", text: "Ce certificat est suspendu temporairement par SECURIPASS." },
  revoked: { label: "Révoqué", tone: "danger", text: "Ce certificat a été révoqué par SECURIPASS et n’est plus valide." },
} as const;

async function Result({ code }: { code: string }) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("verify_certificate", { p_code: code });
  if (error) return <Alert>La vérification est momentanément indisponible. Réessayez dans quelques instants.</Alert>;
  const r = data as Result;
  if (!r?.found || !r.status) {
    return <Alert>Aucun certificat ne correspond à ce code. Vérifiez le numéro ou scannez à nouveau le QR code.</Alert>;
  }
  const s = STATUS[r.status];
  return (
    <section aria-live="polite" className="max-w-2xl rounded-2xl border border-line bg-white p-6 shadow-card">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-bold text-brand-dark">Résultat de la vérification</h2>
        <StatusBadge tone={s.tone}>{s.label}</StatusBadge>
      </div>
      <p className="mt-2 text-sm text-muted">{s.text}</p>
      <dl className="mt-5 grid gap-4 text-sm sm:grid-cols-2">
        <div><dt className="text-muted">Numéro</dt><dd className="font-semibold text-brand-dark">{r.certificate_number}</dd></div>
        <div><dt className="text-muted">Titulaire</dt><dd className="font-semibold text-brand-dark">{r.holder_name}</dd></div>
        <div><dt className="text-muted">Formation</dt><dd className="font-semibold text-brand-dark">{r.course_title}</dd></div>
        <div><dt className="text-muted">Organisme émetteur</dt><dd className="font-semibold text-brand-dark">{r.issuer}</dd></div>
        <div><dt className="text-muted">Date d’émission</dt><dd className="font-semibold text-brand-dark">{r.issued_at && formatDate(r.issued_at)}</dd></div>
        <div><dt className="text-muted">Validité</dt><dd className="font-semibold text-brand-dark">{r.valid_until ? `jusqu’au ${formatDate(r.valid_until)}` : "Sans limite"}</dd></div>
        {r.status === "revoked" && r.revoked_at && (
          <div><dt className="text-muted">Révoqué le</dt><dd className="font-semibold text-danger">{formatDate(r.revoked_at)}</dd></div>
        )}
      </dl>
      <p className="mt-5 text-xs text-muted">Seules les informations ci-dessus sont publiques. Le nom est limité au prénom et à l’initiale du nom.</p>
    </section>
  );
}

export default async function VerifyPage({ searchParams }: { searchParams: Promise<{ code?: string }> }) {
  return (
    <>
      <PageHero eyebrow="Vérification" title="Vérifier un certificat">
        Contrôlez l’authenticité et le statut d’un certificat émis sur SECURIPASS, à partir de son numéro ou de son QR code.
      </PageHero>
      <Section>
        <div className="max-w-2xl space-y-6">
          <form action="/verifier" method="get" className="flex flex-col gap-3 sm:flex-row">
            <label htmlFor="code" className="sr-only">Numéro du certificat ou code de vérification</label>
            <input id="code" name="code" type="text" required minLength={6} maxLength={80} placeholder="Ex. : SP-2026-000123"
              className="min-w-0 flex-1 rounded-lg border border-line bg-white px-3 py-2.5 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20" />
            <button className="rounded-lg bg-brand px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-dark">Vérifier</button>
          </form>
          <Suspense fallback={null}>
            <Lookup searchParams={searchParams} />
          </Suspense>
        </div>
      </Section>
    </>
  );
}

async function Lookup({ searchParams }: { searchParams: Promise<{ code?: string }> }) {
  const { code } = await searchParams;
  const value = code?.trim();
  if (!value) return null;
  if (value.length < 6 || value.length > 80) return <Alert>Le code saisi n’est pas valide.</Alert>;
  return <Result code={value} />;
}
