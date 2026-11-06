import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CourseStatusBadge } from "@/components/courses/course-status";
import { ReviewForm } from "@/components/courses/review-form";
import { StatusBadge } from "@/components/ui/feedback";
import { RichText } from "@/components/ui/rich-text";
import { createClient } from "@/lib/supabase/server";
import { ADMIN_COURSE_DETAIL_SELECT } from "@/lib/selects";
import { getProgramme } from "@/lib/courses/instructor-queries";
import { CONTENT_TYPES, LEVELS, MODES, type CourseStatus } from "@/lib/courses/labels";
import { formatDateTime } from "@/lib/format";
import { formatDuration, formatFcfa } from "@/lib/utils";

export const metadata = { title: "Revue d’une formation" };

type Course = {
  id: string; title: string; slug: string; status: CourseStatus; description: string | null; objectives: string[];
  target_audience: string | null; prerequisites: string | null; competencies: string[]; level: keyof typeof LEVELS;
  delivery_mode: keyof typeof MODES; duration_minutes: number; price_amount: number; evaluation_modalities: string | null;
  certificate_conditions: string | null; certificate_validity_months: number | null; cancellation_policy: string | null;
  publication_mode: "draft" | "publish" | "scheduled"; publish_at: string | null;
  rejection_reason: string | null; instructor: { full_name: string; email: string } | null; category: { name: string } | null;
};

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  if (!children) return null;
  return <div className="py-2"><dt className="text-xs font-semibold uppercase text-muted">{label}</dt><dd className="mt-0.5 whitespace-pre-line text-sm text-brand-dark">{children}</dd></div>;
}

async function Review({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const supabase = await createClient();
  const { data: c } = await supabase
    .from("courses")
    .select(ADMIN_COURSE_DETAIL_SELECT)
    .eq("id", id)
    .maybeSingle<Course>();
  if (!c) notFound();
  const [modules, history] = await Promise.all([
    getProgramme(id),
    supabase.from("audit_logs").select("id, occurred_at, metadata").eq("entity_type", "course").eq("entity_id", id).order("occurred_at", { ascending: false }).limit(20),
  ]);

  return (
    <div className="grid max-w-6xl gap-6 lg:grid-cols-[1fr_22rem]">
      <div className="space-y-6">
        <Link href="/admin/formations" className="text-sm text-brand hover:underline">← Toutes les formations</Link>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-extrabold text-brand-dark">{c.title}</h1>
          <CourseStatusBadge status={c.status} />
        </div>
        <dl className="divide-y divide-line rounded-2xl border border-line bg-white px-5 shadow-card">
          <Row label="Formateur">{c.instructor ? `${c.instructor.full_name} (${c.instructor.email})` : null}</Row>
          <Row label="Catégorie">{c.category?.name}</Row>
          <Row label="Format · niveau · durée · prix">{`${MODES[c.delivery_mode]} · ${LEVELS[c.level]} · ${formatDuration(c.duration_minutes)} · ${c.price_amount === 0 ? "Gratuit" : formatFcfa(c.price_amount)}`}</Row>
          <Row label="Description"><RichText text={c.description} /></Row>
          <Row label="Publication">{c.publication_mode === "scheduled" && c.publish_at ? `Planifiée le ${formatDateTime(c.publish_at)} (invisible avant cette date, même validée)` : c.publication_mode === "draft" ? "Brouillon (le formateur ne souhaite pas encore publier)" : "Dès la validation"}</Row>
          <Row label="Objectifs">{c.objectives.map((o) => `• ${o}`).join("\n")}</Row>
          <Row label="Compétences visées">{c.competencies.map((o) => `• ${o}`).join("\n")}</Row>
          <Row label="Public cible">{c.target_audience}</Row>
          <Row label="Prérequis">{c.prerequisites}</Row>
          <Row label="Modalités d’évaluation">{c.evaluation_modalities}</Row>
          <Row label="Conditions du certificat">{c.certificate_conditions}</Row>
          <Row label="Validité du certificat">{c.certificate_validity_months ? `${c.certificate_validity_months} mois` : null}</Row>
          <Row label="Conditions d’annulation">{c.cancellation_policy}</Row>
          <Row label="Motif de refus précédent">{c.rejection_reason}</Row>
        </dl>

        <section>
          <h2 className="mb-2 text-lg font-bold text-brand-dark">Programme ({modules.length} module{modules.length > 1 ? "s" : ""})</h2>
          {modules.length === 0 ? <p className="text-sm text-muted">Aucun module.</p> : (
            <ol className="space-y-3">
              {modules.map((m, i) => (
                <li key={m.id} className="rounded-xl border border-line bg-white p-4">
                  <p className="font-semibold text-brand-dark">Module {i + 1} — {m.title}</p>
                  <ul className="mt-2 space-y-1 text-sm">
                    {m.contents.map((l) => (
                      <li key={l.id} className="flex items-center justify-between gap-3 border-t border-line pt-1.5">
                        <span>{l.title} <span className="text-xs text-muted">({CONTENT_TYPES[l.content_type]})</span></span>
                        <StatusBadge tone={l.status === "published" ? "success" : "neutral"}>{l.status === "published" ? "Publié" : "Brouillon"}</StatusBadge>
                      </li>
                    ))}
                    {m.contents.length === 0 && <li className="text-muted">Aucun contenu.</li>}
                  </ul>
                </li>
              ))}
            </ol>
          )}
        </section>
      </div>

      <aside className="space-y-6 lg:self-start">
        <ReviewForm courseId={c.id} status={c.status} />
        {c.status === "published" && <Link href={`/formations/${c.slug}`} className="block rounded-xl border border-line bg-white p-3 text-center text-sm font-semibold text-brand hover:bg-brand-soft">Voir la fiche publique</Link>}
        {history.data && history.data.length > 0 && (
          <section className="rounded-2xl border border-line bg-white p-5 shadow-card">
            <h2 className="mb-2 text-sm font-bold text-brand-dark">Historique</h2>
            <ul className="space-y-2 text-xs text-muted">
              {history.data.map((h) => {
                const m = h.metadata as { from?: string; to?: string; reason?: string };
                return <li key={h.id}>{formatDateTime(h.occurred_at)} : {m.from} → {m.to}{m.reason ? ` (${m.reason})` : ""}</li>;
              })}
            </ul>
          </section>
        )}
      </aside>
    </div>
  );
}

export default function AdminReviewPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={<div className="h-96 max-w-6xl animate-pulse rounded-2xl bg-white" aria-hidden />}>
      <Review params={params} />
    </Suspense>
  );
}
