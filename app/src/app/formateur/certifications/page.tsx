import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Alert, EmptyState, PageHeader, StatusBadge } from "@/components/ui/feedback";
import { cn } from "@/lib/utils";
import { renderTemplateText } from "@/lib/certificates/template";
import { changeCertificateStatus, issueCertificate, regenerateCertificatePdf, reissueCertificate } from "@/lib/certificates/actions";

export const metadata = { title: "Certifications" };

const REASONS: Record<string, string> = {
  enrollment_not_active: "Inscription non active",
  contents_incomplete: "Leçons non terminées",
  evaluations_not_passed: "Évaluations non réussies",
  attendance_not_recorded: "Présence non saisie",
  attendance_insufficient: "Présence insuffisante (moins de 80 %)",
  pass_mark_not_reached: "Note minimale de réussite non atteinte",
  certificates_disabled: "Certification désactivée pour cette formation",
};

const RESULTS: Record<string, string> = {
  emis: "Certificat émis. Sa copie PDF est enregistrée.",
  reemis: "Certificat réémis. L’ancien certificat est révoqué et lié au nouveau.",
  statut: "Statut du certificat mis à jour.",
  pdf: "Copie PDF générée.",
};

type Search = { formation?: string; inscription?: string; resultat?: string; erreur?: string };
type Course = { id: string; title: string };
type Enrollment = {
  id: string;
  status: string;
  learner: { full_name: string; email: string } | null;
  session: { title: string; start_at: string; timezone: string } | null;
};
type Cert = { id: string; enrollment_id: string; certificate_number: string; status: "valid" | "suspended" | "revoked"; pdf_path: string | null };
type Template = { id: string; name: string; layout: string; title: string; body: string };

const SHORT_DATE = (iso: string, tz = "Africa/Abidjan") =>
  new Date(iso).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: tz });

/** Aperçu indicatif du texte du modèle (le PDF réel est généré à l'émission, avec un numéro attribué). */
function Preview({ template, learner, course, session }: { template: Template; learner: string; course: string; session: string }) {
  const text = renderTemplateText(template.body, {
    apprenant: learner, formation: course, session,
    date: SHORT_DATE(new Date().toISOString()), numero: "SP-AAAA-000000", validite: "sans limite de validité",
  });
  return (
    <div
      className={cn("rounded-xl border bg-white p-6 text-center",
        template.layout === "classic" && "border-[3px] border-double border-[#D6A43B]",
        template.layout === "modern" && "border-t-[10px] border-t-brand-dark border-line",
        template.layout === "minimal" && "border-line",
        template.layout === "professional" && "border-l-[10px] border-l-brand border-line")}
      aria-label="Aperçu du certificat"
    >
      <p className="text-xs uppercase tracking-wide text-muted">SECURIPASS</p>
      <p className="mt-3 text-lg font-extrabold text-brand-dark">{template.title}</p>
      <p className="mt-4 text-xl font-bold text-brand-dark">{learner || "Nom de l’apprenant"}</p>
      <p className="mt-3 text-sm leading-relaxed text-brand-dark">{text}</p>
      <p className="mt-6 text-[11px] text-muted">Numéro et QR code de vérification attribués à l’émission.</p>
    </div>
  );
}

async function Page({ searchParams }: { searchParams: Promise<Search> }) {
  const { formation, inscription, resultat, erreur } = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/connexion?redirect=/formateur/certifications");

  const { data: courses } = await supabase.from("courses").select("id, title").order("title").returns<Course[]>();
  const selected = (courses ?? []).find((c) => c.id === formation) ?? (courses ?? [])[0];
  if (!selected) return <EmptyState title="Aucune formation à gérer">Les certificats se délivrent par formation.</EmptyState>;

  const [{ data: enrollments }, { data: certs }, { data: templates }] = await Promise.all([
    supabase.from("enrollments")
      .select("id, status, learner:profiles!enrollments_learner_id_fkey(full_name, email), session:sessions(title, start_at, timezone)")
      .eq("course_id", selected.id).in("status", ["confirmed", "completed"]).order("enrolled_at")
      .returns<Enrollment[]>(),
    supabase.from("certificates").select("id, enrollment_id, certificate_number, status, pdf_path")
      .eq("course_id", selected.id).order("issued_at", { ascending: false })
      .returns<Cert[]>(),
    supabase.from("certificate_templates").select("id, name, layout, title, body").eq("status", "published").order("name")
      .returns<Template[]>(),
  ]);

  const rows = await Promise.all((enrollments ?? []).map(async (e) => {
    const { data } = await supabase.rpc("certificate_eligibility", { p_enrollment: e.id });
    const r = data as { eligible: boolean; reasons: string[] } | null;
    const active = (certs ?? []).find((c) => c.enrollment_id === e.id && c.status !== "revoked") ?? null;
    return { e, eligible: Boolean(r?.eligible), reasons: r?.reasons ?? [], active };
  }));

  const chosen = rows.find((r) => r.e.id === inscription) ?? null;
  const template = (templates ?? [])[0];
  const banner = resultat && RESULTS[resultat] ? RESULTS[resultat] : null;

  return (
    <>
      <div className="mb-6 flex flex-wrap items-center gap-2">
        {(courses ?? []).map((c) => (
          <Link
            key={c.id}
            href={`/formateur/certifications?formation=${c.id}`}
            aria-current={c.id === selected.id ? "page" : undefined}
            className={cn("rounded-lg border px-3 py-1.5 text-sm font-semibold",
              c.id === selected.id ? "border-brand bg-brand text-white" : "border-line bg-white text-brand-dark hover:border-brand")}
          >
            {c.title}
          </Link>
        ))}
      </div>
      {banner && <div className="mb-4"><Alert tone="success">{banner}</Alert></div>}
      {erreur && <div className="mb-4"><Alert>{erreur}</Alert></div>}

      <div className="grid gap-6 xl:grid-cols-[1fr_24rem]">
        <section aria-labelledby="inscrits" className="min-w-0">
          <h2 id="inscrits" className="mb-3 font-bold text-brand-dark">Apprenants inscrits</h2>
          {rows.length === 0 ? (
            <EmptyState title="Aucune inscription active">Les inscriptions confirmées apparaîtront ici.</EmptyState>
          ) : (
            <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-white">
              {rows.map(({ e, eligible, reasons, active }) => (
                <li key={e.id} className={cn("p-4", chosen?.e.id === e.id && "bg-brand-soft/50")}>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-semibold text-brand-dark">{e.learner?.full_name || e.learner?.email}</p>
                      <p className="text-xs text-muted">
                        {e.session ? `${e.session.title} · ${SHORT_DATE(e.session.start_at, e.session.timezone)}` : "Accès libre"}
                      </p>
                    </div>
                    {active ? (
                      <div className="flex flex-wrap items-center gap-2">
                        <StatusBadge tone={active.status === "valid" ? "success" : "warning"}>
                          {active.status === "valid" ? "Certifié" : "Suspendu"}
                        </StatusBadge>
                        <span className="text-xs text-muted">{active.certificate_number}</span>
                      </div>
                    ) : eligible ? <StatusBadge tone="info">Éligible</StatusBadge> : <StatusBadge>Non éligible</StatusBadge>}
                  </div>
                  {!active && !eligible && (
                    <p className="mt-2 text-xs text-muted">Manque : {reasons.map((r) => REASONS[r] ?? r).join(" · ")}</p>
                  )}
                  <div className="mt-3 flex flex-wrap gap-3 text-sm">
                    <Link href={`/formateur/certifications?formation=${selected.id}&inscription=${e.id}`} className="font-semibold text-brand hover:underline">
                      {active ? "Gérer le certificat" : eligible ? "Émettre" : "Détails"}
                    </Link>
                    {active && !active.pdf_path && (
                      <form action={regenerateCertificatePdf}>
                        <input type="hidden" name="certificateId" value={active.id} />
                        <input type="hidden" name="inscription" value={e.id} />
                        <button className="font-semibold text-brand hover:underline">Générer le PDF</button>
                      </form>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <aside aria-labelledby="emettre" className="space-y-4">
          <h2 id="emettre" className="font-bold text-brand-dark">{chosen?.active ? "Certificat de l’apprenant" : "Émettre un certificat"}</h2>
          {!chosen ? (
            <EmptyState title="Choisissez un apprenant">Sélectionnez un apprenant pour émettre ou gérer son certificat.</EmptyState>
          ) : !template ? (
            <Alert>Aucun modèle publié. Un responsable pédagogique doit publier un modèle.</Alert>
          ) : chosen.active ? (
            <div className="space-y-5 rounded-2xl border border-line bg-white p-5 text-sm">
              <p className="text-brand-dark">
                <span className="font-semibold">{chosen.active.certificate_number}</span> · {chosen.active.status === "valid" ? "valide" : "suspendu"}
              </p>
              <form action={changeCertificateStatus} className="space-y-2">
                <input type="hidden" name="certificateId" value={chosen.active.id} />
                <input type="hidden" name="inscription" value={chosen.e.id} />
                <label className="block text-xs font-semibold text-brand-dark" htmlFor="motif">Motif (suspension ou révocation)</label>
                <input id="motif" name="reason" minLength={3} maxLength={500} className="w-full rounded-lg border border-line px-3 py-2" />
                <div className="flex flex-wrap gap-2">
                  {chosen.active.status === "valid" ? (
                    <button name="action" value="suspend" className="rounded-lg border border-brand px-3 py-1.5 font-semibold text-brand">Suspendre</button>
                  ) : (
                    <button name="action" value="reinstate" className="rounded-lg border border-brand px-3 py-1.5 font-semibold text-brand">Lever la suspension</button>
                  )}
                  <button name="action" value="revoke" className="rounded-lg border border-danger px-3 py-1.5 font-semibold text-danger">Révoquer</button>
                </div>
              </form>
              <form action={reissueCertificate} className="space-y-2 border-t border-line pt-4">
                <input type="hidden" name="certificateId" value={chosen.active.id} />
                <input type="hidden" name="enrollmentId" value={chosen.e.id} />
                <input type="hidden" name="templateId" value={template.id} />
                <label className="block text-xs font-semibold text-brand-dark" htmlFor="motif-reemission">Réémettre : motif obligatoire</label>
                <input id="motif-reemission" name="reason" required minLength={3} maxLength={500} className="w-full rounded-lg border border-line px-3 py-2" />
                <Button variant="outline" className="w-full">Réémettre le certificat</Button>
              </form>
            </div>
          ) : (
            <form action={issueCertificate} className="space-y-4 rounded-2xl border border-line bg-white p-5 text-sm">
              <input type="hidden" name="enrollmentId" value={chosen.e.id} />
              <div>
                <label className="block text-xs font-semibold text-brand-dark" htmlFor="modele">Modèle</label>
                <select id="modele" name="templateId" defaultValue={template.id} className="mt-1 w-full rounded-lg border border-line px-3 py-2">
                  {(templates ?? []).map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-brand-dark" htmlFor="titre">Titre (vide : celui du modèle)</label>
                <input id="titre" name="title" maxLength={200} className="mt-1 w-full rounded-lg border border-line px-3 py-2" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-brand-dark" htmlFor="texte">Texte (vide : celui du modèle)</label>
                <textarea id="texte" name="body" rows={3} maxLength={2000}
                  placeholder="Variables : {{apprenant}} {{formation}} {{session}} {{date}} {{numero}} {{validite}}"
                  className="mt-1 w-full rounded-lg border border-line px-3 py-2" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-brand-dark" htmlFor="signataire">Signataire</label>
                  <input id="signataire" name="signatoryName" maxLength={120} className="mt-1 w-full rounded-lg border border-line px-3 py-2" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-brand-dark" htmlFor="fonction">Fonction</label>
                  <input id="fonction" name="signatoryRole" maxLength={120} className="mt-1 w-full rounded-lg border border-line px-3 py-2" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-brand-dark" htmlFor="validite">Durée de validité (mois, vide : sans limite)</label>
                <input id="validite" name="validityMonths" type="number" min={1} max={120} className="mt-1 w-full rounded-lg border border-line px-3 py-2" />
              </div>
              <Button variant="cta" className="w-full" disabled={!chosen.eligible}>
                {chosen.eligible ? "Générer le certificat" : "Conditions non remplies"}
              </Button>
            </form>
          )}
          {chosen && template && !chosen.active && (
            <Preview
              template={template}
              learner={chosen.e.learner?.full_name ?? ""}
              course={selected.title}
              session={chosen.e.session ? `session du ${SHORT_DATE(chosen.e.session.start_at, chosen.e.session.timezone)}` : "accès libre"}
            />
          )}
        </aside>
      </div>
    </>
  );
}

export default function CertificationsPage({ searchParams }: { searchParams: Promise<Search> }) {
  return (
    <>
      <PageHeader
        title="Certifications"
        description="Émission, suspension, révocation et réémission des certificats, uniquement lorsque les conditions sont remplies."
      />
      <Suspense fallback={<div className="h-96 animate-pulse rounded-2xl bg-white" aria-hidden />}>
        <Page searchParams={searchParams} />
      </Suspense>
    </>
  );
}
