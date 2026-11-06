import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import QRCode from "qrcode";
import { Download, QrCode } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState, PageHeader, StatusBadge } from "@/components/ui/feedback";
import { formatDate, formatDateTime } from "@/lib/format";
import { verificationUrl } from "@/lib/certificates/urls";
import { certificateDisplayStatus } from "@/lib/certificates/status";

export const metadata = { title: "Mes certificats" };

type Row = {
  id: string;
  certificate_number: string;
  verification_token: string;
  issued_at: string;
  valid_until: string | null;
  status: "valid" | "suspended" | "revoked";
  revoked_at: string | null;
  revocation_reason: string | null;
  pdf_path: string | null;
  content: { course_title: string; session_title: string };
};

type Event = { certificate_id: string; event_type: string; created_at: string; reason: string | null };

const EVENT_LABEL: Record<string, string> = {
  issued: "Émis",
  suspended: "Suspendu",
  reinstated: "Suspension levée",
  revoked: "Révoqué",
  reissued: "Réémis",
  pdf_generated: "Copie PDF générée",
};

/** Statut affiché : l'expiration est calculée à partir de la date de validité, les autres statuts viennent de la base. */
function displayStatus(c: Row) {
  return certificateDisplayStatus(c);
}

async function List() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/connexion?redirect=/app/certificats");

  const { data: certs } = await supabase
    .from("certificates")
    .select("id, certificate_number, verification_token, issued_at, valid_until, status, revoked_at, revocation_reason, pdf_path, content")
    .order("issued_at", { ascending: false })
    .returns<Row[]>();
  const list = certs ?? [];
  if (list.length === 0) {
    return <EmptyState title="Aucun certificat pour le moment">Un certificat est délivré lorsque les conditions de la formation sont remplies : leçons, évaluations et présence.</EmptyState>;
  }

  const { data: events } = await supabase
    .from("certificate_events")
    .select("certificate_id, event_type, created_at, reason")
    .order("created_at", { ascending: false })
    .returns<Event[]>();
  const titles = new Map(list.map((c) => [c.id, c.content.course_title]));

  const items = await Promise.all(list.map(async (c) => ({
    cert: c,
    status: displayStatus(c),
    qr: await QRCode.toDataURL(verificationUrl(c.verification_token), { margin: 1, width: 160 }),
  })));

  return (
    <div className="space-y-8">
      <ul className="space-y-4">
        {items.map(({ cert: c, status, qr }) => (
          <li key={c.id} className="flex flex-col gap-5 rounded-2xl border border-line bg-white p-5 shadow-card md:flex-row">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="font-bold text-brand-dark">{c.content.course_title}</h2>
                <StatusBadge tone={status.tone}>{status.label}</StatusBadge>
              </div>
              {c.content.session_title && <p className="text-sm text-muted">{c.content.session_title}</p>}
              <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-3">
                <div><dt className="text-muted">Numéro</dt><dd className="font-semibold text-brand-dark">{c.certificate_number}</dd></div>
                <div><dt className="text-muted">Émis le</dt><dd className="font-semibold text-brand-dark">{formatDate(c.issued_at)}</dd></div>
                <div><dt className="text-muted">Validité</dt><dd className="font-semibold text-brand-dark">{c.valid_until ? `jusqu’au ${formatDate(c.valid_until)}` : "Sans limite"}</dd></div>
              </dl>
              {c.status === "revoked" && c.revocation_reason && (
                <p className="mt-2 text-sm text-danger">Motif de révocation : {c.revocation_reason}</p>
              )}
              <div className="mt-4 flex flex-wrap gap-2">
                {c.pdf_path && c.status !== "revoked" ? (
                  <ButtonLink href={`/app/certificats/${c.id}/pdf`} variant="cta">
                    <Download className="h-4 w-4" aria-hidden />Télécharger le PDF
                  </ButtonLink>
                ) : (
                  <span className="text-sm text-muted">{c.status === "revoked" ? "Ce certificat n’est plus téléchargeable." : "Copie PDF en préparation."}</span>
                )}
                <Link href={verificationUrl(c.verification_token)} className="inline-flex items-center rounded-lg border border-brand px-4 py-2.5 text-sm font-semibold text-brand hover:bg-brand-soft">
                  Page de vérification
                </Link>
              </div>
            </div>
            <div className="flex shrink-0 flex-col items-center gap-1 text-center">
              {/* eslint-disable-next-line @next/next/no-img-element -- QR généré localement (data URL) */}
              <img src={qr} alt={`QR code de vérification du certificat ${c.certificate_number}`} width={130} height={130} className="rounded-lg border border-line" />
              <span className="flex items-center gap-1 text-xs text-muted"><QrCode className="h-3.5 w-3.5" aria-hidden />Scannez pour vérifier</span>
            </div>
          </li>
        ))}
      </ul>

      <section className="rounded-2xl border border-line bg-white p-5" aria-labelledby="historique">
        <h2 id="historique" className="mb-3 font-bold text-brand-dark">Historique des certifications</h2>
        <ul className="divide-y divide-line text-sm">
          {(events ?? []).slice(0, 20).map((e, i) => (
            <li key={`${e.certificate_id}-${e.created_at}-${i}`} className="flex flex-wrap justify-between gap-2 py-2.5">
              <span className="text-brand-dark">
                <span className="font-semibold">{EVENT_LABEL[e.event_type] ?? e.event_type}</span>
                {" · "}{titles.get(e.certificate_id)}
                {e.reason && <span className="block text-xs text-muted">{e.reason}</span>}
              </span>
              <span className="text-xs text-muted">{formatDateTime(e.created_at)}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

export default function CertificatesPage() {
  return (
    <>
      <PageHeader title="Mes certificats" description="Vos certificats délivrés, leur statut réel, la copie PDF et le QR code de vérification." />
      <Suspense fallback={<div className="h-48 animate-pulse rounded-2xl bg-white" aria-hidden />}>
        <List />
      </Suspense>
    </>
  );
}
