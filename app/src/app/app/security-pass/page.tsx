import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import QRCode from "qrcode";
import { Download, IdCard, ShieldCheck } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState, PageHeader, StatusBadge } from "@/components/ui/feedback";
import { formatDate, formatDateTime } from "@/lib/format";
import { activeCourses, loadLearnerState } from "@/lib/learner/queries";
import { verificationUrl } from "@/lib/certificates/urls";

export const metadata = { title: "Mon Security Pass" };

type Cert = {
  id: string;
  certificate_number: string;
  verification_token: string;
  issued_at: string;
  valid_until: string | null;
  status: "valid" | "suspended" | "revoked";
  pdf_path: string | null;
  content: { course_title: string };
};
type Verification = { certificate_id: string; verified_at: string; result: string };

/** Valide à l'instant de l'affichage : statut « valid » et non expiré. */
const isValidNow = (c: Cert) => c.status === "valid" && (!c.valid_until || new Date(c.valid_until).getTime() > Date.now());

const RESULT_LABEL: Record<string, string> = {
  valid: "Vérification réussie",
  expired: "Certificat expiré",
  suspended: "Certificat suspendu",
  revoked: "Certificat révoqué",
};

/**
 * Security Pass : synthèse des données réelles (spec §6.7). Il n'accorde aucune certification : il reflète les
 * certificats émis. Son statut est « Actif » seulement si au moins un certificat est valide à ce jour.
 */
async function Pass() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/connexion?redirect=/app/security-pass");

  const [{ data: profile }, state, { data: certs }, { data: verifications }] = await Promise.all([
    supabase.from("profiles").select("full_name, email, birth_date, phone").eq("id", user.id).maybeSingle<{
      full_name: string; email: string; birth_date: string | null; phone: string | null;
    }>(),
    loadLearnerState(supabase, user.id),
    supabase.from("certificates")
      .select("id, certificate_number, verification_token, issued_at, valid_until, status, pdf_path, content")
      .order("issued_at", { ascending: false })
      .returns<Cert[]>(),
    supabase.from("certificate_verifications")
      .select("certificate_id, verified_at, result")
      .order("verified_at", { ascending: false })
      .limit(5)
      .returns<Verification[]>(),
  ]);

  const list = certs ?? [];
  const primary = list.find(isValidNow) ?? list[0] ?? null;
  const primaryQr = primary ? await QRCode.toDataURL(verificationUrl(primary.verification_token), { margin: 1, width: 160 }) : null;
  const courses = activeCourses(state);
  const completed = courses.filter((c) => c.status === "completed").length;
  const validCount = list.filter(isValidNow).length;
  const titles = new Map(list.map((c) => [c.id, c.content.course_title]));
  const name = profile?.full_name || user.email || "";

  const passStatus = !primary ? { label: "Non activé", tone: "neutral" as const }
    : isValidNow(primary) ? { label: "Actif", tone: "success" as const }
    : primary.status === "suspended" ? { label: "Suspendu", tone: "warning" as const }
    : primary.status === "revoked" ? { label: "Révoqué", tone: "danger" as const }
    : { label: "Expiré", tone: "warning" as const };

  return (
    <>
      <div className="mb-6 rounded-2xl border border-line bg-white p-6">
        <div className="flex flex-col gap-6 md:flex-row md:items-center">
          <div className="flex h-24 w-24 shrink-0 items-center justify-center rounded-2xl bg-brand-soft text-2xl font-extrabold text-brand" aria-hidden>
            {name.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted">Carte d’identité professionnelle</p>
            <h2 className="text-2xl font-extrabold text-brand-dark">{name}</h2>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <StatusBadge tone={passStatus.tone}>{passStatus.label}</StatusBadge>
              <span className="text-sm text-muted">
                {primary ? `N° Security Pass : ${primary.certificate_number}` : "Le numéro est attribué à l’émission de votre premier certificat"}
              </span>
            </div>
          </div>
          {primaryQr ? (
            <div className="flex shrink-0 flex-col items-center gap-1">
              {/* eslint-disable-next-line @next/next/no-img-element -- QR généré localement (data URL) */}
              <img src={primaryQr} alt="QR code de vérification du Security Pass" width={130} height={130} className="rounded-lg border border-line" />
              <span className="text-xs text-muted">Scannez pour vérifier</span>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-line p-4 text-center">
              <p className="max-w-[12rem] text-xs text-muted">Le QR code de vérification apparaîtra avec votre premier certificat.</p>
            </div>
          )}
        </div>
      </div>

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <div className="flex items-center gap-4 rounded-2xl border border-line bg-white p-5">
          <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand text-white"><IdCard className="h-6 w-6" aria-hidden /></span>
          <span><span className="block text-3xl font-extrabold text-brand-dark">{courses.length}</span><span className="text-sm text-muted">Formations suivies</span></span>
        </div>
        <div className="flex items-center gap-4 rounded-2xl border border-line bg-white p-5">
          <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-success text-white"><ShieldCheck className="h-6 w-6" aria-hidden /></span>
          <span><span className="block text-3xl font-extrabold text-brand-dark">{completed}</span><span className="text-sm text-muted">Formations terminées</span></span>
        </div>
        <div className="flex items-center gap-4 rounded-2xl border border-line bg-white p-5">
          <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-surface text-brand-dark"><ShieldCheck className="h-6 w-6" aria-hidden /></span>
          <span><span className="block text-3xl font-extrabold text-brand-dark">{validCount}</span><span className="text-sm text-muted">Certificats valides</span></span>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <section className="rounded-2xl border border-line bg-white p-5 xl:col-span-2" aria-labelledby="identite">
          <h2 id="identite" className="mb-4 font-bold text-brand-dark">Mes informations</h2>
          <dl className="grid gap-4 text-sm sm:grid-cols-2">
            <div><dt className="text-muted">Nom complet</dt><dd className="font-semibold text-brand-dark">{profile?.full_name || "Non renseigné"}</dd></div>
            <div><dt className="text-muted">Date de naissance</dt><dd className="font-semibold text-brand-dark">{profile?.birth_date ? formatDate(profile.birth_date) : "Non renseignée"}</dd></div>
            <div><dt className="text-muted">E-mail</dt><dd className="font-semibold text-brand-dark">{profile?.email || user.email}</dd></div>
            <div><dt className="text-muted">Téléphone</dt><dd className="font-semibold text-brand-dark">{profile?.phone || "Non renseigné"}</dd></div>
          </dl>
          <div className="mt-5 flex flex-wrap gap-2">
            <ButtonLink href="/app/profil" variant="outline">Modifier mes informations</ButtonLink>
            {primary?.pdf_path && primary.status !== "revoked" && (
              <ButtonLink href={`/app/certificats/${primary.id}/pdf`} variant="cta">
                <Download className="h-4 w-4" aria-hidden />Télécharger le certificat
              </ButtonLink>
            )}
          </div>

          <h2 className="mb-3 mt-8 font-bold text-brand-dark">Certifications liées</h2>
          {list.length === 0 ? (
            <EmptyState title="Aucun certificat pour le moment">Vos certificats délivrés apparaîtront ici.</EmptyState>
          ) : (
            <ul className="divide-y divide-line text-sm">
              {list.map((c) => (
                <li key={c.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
                  <span>
                    <span className="font-semibold text-brand-dark">{c.content.course_title}</span>
                    <span className="block text-xs text-muted">{c.certificate_number} · émis le {formatDate(c.issued_at)}</span>
                  </span>
                  <StatusBadge tone={isValidNow(c) ? "success" : c.status === "revoked" ? "danger" : "warning"}>
                    {isValidNow(c) ? "Valide" : c.status === "revoked" ? "Révoqué" : c.status === "suspended" ? "Suspendu" : "Expiré"}
                  </StatusBadge>
                </li>
              ))}
            </ul>
          )}
        </section>

        <aside className="space-y-6">
          <section className="rounded-2xl border border-line bg-white p-5" aria-labelledby="verif">
            <h2 id="verif" className="mb-3 font-bold text-brand-dark">Historique de vérification</h2>
            {!verifications?.length ? (
              <p className="text-sm text-muted">Aucune vérification publique pour le moment.</p>
            ) : (
              <ul className="space-y-3 text-sm">
                {verifications.map((v, i) => (
                  <li key={`${v.certificate_id}-${i}`} className="flex justify-between gap-2">
                    <span>
                      <span className={v.result === "valid" ? "font-semibold text-success" : "font-semibold text-danger"}>{RESULT_LABEL[v.result] ?? v.result}</span>
                      <span className="block text-xs text-muted">{titles.get(v.certificate_id)}</span>
                    </span>
                    <span className="shrink-0 text-xs text-muted">{formatDateTime(v.verified_at)}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
          <p className="text-sm text-muted">
            Le Security Pass ne certifie rien à lui seul : il reflète vos certificats émis.{" "}
            <Link href="/app/certificats" className="font-semibold text-brand hover:underline">Voir mes certificats</Link>
          </p>
        </aside>
      </div>
    </>
  );
}

export default function SecurityPassPage() {
  return (
    <>
      <PageHeader title="Mon Security Pass" description="Votre identité professionnelle en sécurité : informations, certificats et vérifications." />
      <Suspense fallback={<div className="h-96 animate-pulse rounded-2xl bg-white" aria-hidden />}>
        <Pass />
      </Suspense>
    </>
  );
}
