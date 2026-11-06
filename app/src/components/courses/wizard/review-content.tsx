import { Check, Clock, GraduationCap } from "lucide-react";
import { CourseStatusBadge } from "@/components/courses/course-status";
import { StatusPanel } from "@/components/courses/status-panel";
import { RichText } from "@/components/ui/rich-text";
import type { Activity } from "@/lib/courses/evaluation-queries";
import type { OwnCourse, ProgrammeModule } from "@/lib/courses/instructor-queries";
import { summarize } from "@/lib/courses/detail";
import { ACTIVITY_KINDS, formatGrade } from "@/lib/courses/grading";
import { LANGUAGE_REQUIREMENTS, LEVELS, MODES } from "@/lib/courses/labels";
import { AUDIENCE_LABELS, CERTIFICATE_DISPLAY, PAYMENT_METHOD_LABELS } from "@/lib/courses/schemas";
import { courseToValues } from "@/lib/courses/wizard";
import { formatDateTime, formatMinutes } from "@/lib/format";
import { cn, formatFcfa } from "@/lib/utils";
import { PreviewShell, type PreviewTab } from "./preview-shell";
import { PublicationPanel } from "./publication-panel";

const ENROLLMENT_LABEL = { free: "Inscription libre", approval: "Sur validation du formateur", code: "Par code d’accès" } as const;
const PUBLICATION_LABEL = { draft: "Brouillon (non soumise)", publish: "Dès la validation", scheduled: "Planifiée" } as const;
const DISPLAY_LABELS: Record<(typeof CERTIFICATE_DISPLAY)[number], string> = {
  holder_name: "Nom et prénom de l’apprenant", course_title: "Intitulé de la formation", issue_date: "Date de délivrance", qr: "QR code de vérification",
  trainer_signature: "Signature du formateur", issuer_signature: "Signature de l’organisme", number: "Numéro de certificat",
};

const lines = (text: string | null | undefined) => (text ?? "").split("\n").map((t) => t.trim()).filter(Boolean);

function Panel({ title, children, className }: { title: string; children: React.ReactNode; className?: string }) {
  return (
    <section className={cn("rounded-2xl border border-line bg-white p-5 shadow-card", className)}>
      <h2 className="mb-4 text-lg font-bold text-brand-dark">{title}</h2>
      {children}
    </section>
  );
}

function Chips({ items }: { items: string[] }) {
  return items.length === 0 ? <p className="text-sm text-muted">Non renseigné.</p> : (
    <ul className="flex flex-wrap gap-2">{items.map((t) => <li key={t} className="rounded-md bg-brand-soft px-2.5 py-1 text-xs font-semibold text-brand">{t}</li>)}</ul>
  );
}

function Heading({ children }: { children: React.ReactNode }) {
  return <h3 className="mb-2 font-bold text-brand-dark">{children}</h3>;
}

/** Étape 5 : aperçu fidèle de la fiche (onglets, vue mobile, détails techniques), paramètres de publication et liste de contrôle. */
export function ReviewContent({ course, modules, activities, categoryName, templateName, parentTitle, prerequisiteTitle }: {
  course: OwnCourse; modules: ProgrammeModule[]; activities: Activity[]; categoryName: string | null; templateName: string | null;
  parentTitle: string | null; prerequisiteTitle: string | null;
}) {
  const lessons = modules.reduce((n, m) => n + m.contents.length, 0);
  const published = modules.reduce((n, m) => n + m.contents.filter((c) => c.status === "published").length, 0);
  const programmeMinutes = modules.reduce((n, m) => n + m.contents.reduce((k, c) => k + c.duration_minutes, 0), 0);
  const activeActivities = activities.filter((a) => a.status === "published");
  const price = course.price_amount ?? 0;
  const level = LEVELS[course.level as keyof typeof LEVELS] ?? "—";
  const priceLabel = price === 0 ? "Gratuite" : formatFcfa(price);
  const certifying = course.certificate_enabled && Boolean(course.certificate_template_id);

  const facts: [string, string][] = [
    ["Catégorie", categoryName ?? "—"],
    ["Code de la formation", course.course_code ?? "—"],
    ["Niveau", level],
    ["Format", MODES[course.delivery_mode as keyof typeof MODES] ?? "—"],
    ["Langue", course.language === "en" ? "Anglais" : "Français"],
    ["Places par session", course.default_capacity ? String(course.default_capacity) : "—"],
    ["Prix", priceLabel],
  ];

  const checks: [string, boolean][] = [
    ["Informations générales complétées", Boolean(course.category_id && (course.description ?? "").trim().length >= 50 && (course.duration_minutes ?? 0) > 0)],
    [`Programme défini (${modules.length} module${modules.length > 1 ? "s" : ""}, ${lessons} leçon${lessons > 1 ? "s" : ""})`, modules.length > 0 && published > 0],
    [`Évaluation configurée (${activeActivities.length} activité${activeActivities.length > 1 ? "s" : ""})`, !course.evaluation_enabled || activeActivities.length > 0],
    ["Paramètres définis", true],
    ["Visuel et description ajoutés", Boolean(course.cover_url && (course.description ?? "").trim())],
    ["Prix et modalités de paiement configurés", price === 0 || (course.payment_methods ?? []).length > 0],
  ];

  const panels: Record<PreviewTab, React.ReactNode> = {
    presentation: (
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_16rem]">
        <div className="space-y-5">
          <div><Heading>Description de la formation</Heading><RichText text={course.description} /></div>
          {(course.objectives ?? []).length > 0 && (
            <div>
              <Heading>Objectifs de la formation</Heading>
              <ul className="space-y-1.5 text-sm text-brand-dark">{(course.objectives ?? []).map((o) => <li key={o} className="flex items-start gap-2"><Check className="mt-0.5 h-4 w-4 shrink-0 text-success" aria-hidden />{o}</li>)}</ul>
            </div>
          )}
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl bg-brand-soft p-3 text-sm"><p className="font-bold text-brand-dark">Public cible</p><p className="text-muted">{lines(course.target_audience).join(", ") || "—"}</p></div>
            <div className="rounded-xl bg-success/10 p-3 text-sm"><p className="font-bold text-brand-dark">Niveau requis</p><p className="text-muted">{level}</p><p className="text-xs text-muted">{lines(course.prerequisites).join(", ") || "Aucun prérequis particulier"}</p></div>
            <div className="rounded-xl bg-cta/10 p-3 text-sm"><p className="font-bold text-brand-dark">Durée totale</p><p className="text-muted">{formatMinutes(course.duration_minutes ?? 0)}</p></div>
          </div>
        </div>
        <aside aria-label="Informations clés" className="self-start rounded-xl border border-line p-4">
          <h3 className="mb-3 font-bold text-brand-dark">Informations clés</h3>
          <dl className="space-y-2.5 text-sm">{facts.map(([k, v]) => <div key={k}><dt className="text-xs text-muted">{k}</dt><dd className="font-semibold text-brand-dark">{v}</dd></div>)}</dl>
        </aside>
      </div>
    ),
    programme: modules.length === 0 ? <p className="text-sm text-muted">Aucun module : revenez à l’étape 2 pour construire le programme.</p> : (
      <div className="space-y-3">
        <ol className="space-y-2">
          {modules.map((m, i) => (
            <li key={m.id} className="rounded-xl border border-line p-3">
              <p className="flex items-center gap-3 text-sm"><span className="flex h-7 w-7 items-center justify-center rounded-full bg-surface text-xs font-bold text-brand-dark">{i + 1}</span>
                <span className="min-w-0 flex-1 font-semibold text-brand-dark">{m.title}</span>
                <span className="text-xs text-muted">{m.contents.length} leçon{m.contents.length > 1 ? "s" : ""} · {formatMinutes(m.contents.reduce((n, c) => n + c.duration_minutes, 0))}</span></p>
              {m.contents.length > 0 && <ul className="mt-2 space-y-1 pl-10 text-xs text-muted">{m.contents.map((c) => <li key={c.id}>{c.title}{c.status === "draft" ? " (brouillon : invisible des apprenants)" : ""}</li>)}</ul>}
            </li>
          ))}
        </ol>
        <p className="text-sm text-muted">Durée totale du programme : <strong className="text-brand-dark">{formatMinutes(programmeMinutes)}</strong></p>
      </div>
    ),
    objectifs: (
      <div className="space-y-4">
        <div><Heading>Objectifs pédagogiques</Heading>
          {(course.objectives ?? []).length === 0 ? <p className="text-sm text-muted">Non renseigné.</p> : <ul className="space-y-1.5 text-sm text-brand-dark">{(course.objectives ?? []).map((o) => <li key={o} className="flex items-start gap-2"><Check className="mt-0.5 h-4 w-4 shrink-0 text-success" aria-hidden />{o}</li>)}</ul>}
        </div>
        <div><Heading>Compétences visées</Heading><Chips items={course.competencies ?? []} /></div>
      </div>
    ),
    public: (
      <div className="space-y-4">
        <div><Heading>Public cible</Heading><Chips items={lines(course.target_audience)} /></div>
        <div><Heading>Publics visés</Heading><Chips items={(course.audience_types ?? []).map((a) => AUDIENCE_LABELS[a as keyof typeof AUDIENCE_LABELS] ?? a)} /></div>
      </div>
    ),
    prerequis: (
      <div className="space-y-4">
        <div><Heading>Prérequis</Heading><Chips items={lines(course.prerequisites)} /></div>
        {prerequisiteTitle && <p className="text-sm text-brand-dark">Formation à avoir terminée : <strong>{prerequisiteTitle}</strong></p>}
        {course.language_requirement && <p className="text-sm text-brand-dark">Niveau de langue requis : <strong>{LANGUAGE_REQUIREMENTS[course.language_requirement as keyof typeof LANGUAGE_REQUIREMENTS]}</strong></p>}
      </div>
    ),
    evaluation: !course.evaluation_enabled ? <p className="text-sm text-muted">Cette formation ne comporte pas d’évaluation notée.</p> : (
      <div className="space-y-3">
        <p className="text-sm text-brand-dark">Note minimale de réussite : <strong>{course.pass_mark_percent} %</strong> · notation sur {course.grading_scale}</p>
        {activities.length === 0 ? <p className="text-sm text-muted">Aucune activité d’évaluation pour le moment.</p> : (
          <ul className="space-y-2 text-sm">
            {activities.map((a) => (
              <li key={a.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-line p-3">
                <span className="font-semibold text-brand-dark">{a.title} <span className="font-normal text-muted">· {ACTIVITY_KINDS[a.kind]}</span></span>
                <span className="text-xs text-muted">{a.weight_percent > 0 ? `${a.weight_percent} % · ` : ""}min. {formatGrade(a.passing_score, course.grading_scale, course.grade_rounding)} · {a.status === "published" ? "active" : "inactive"}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    ),
    certification: !course.certificate_enabled ? <p className="text-sm text-muted">Aucun certificat n’est délivré pour cette formation.</p> : (
      <div className="space-y-3 text-sm text-brand-dark">
        <p>Modèle : <strong>{templateName ?? "aucun modèle choisi"}</strong></p>
        {course.certificate_title && <p>Nom du certificat : <strong>{course.certificate_title}</strong></p>}
        {course.certificate_description && <p className="whitespace-pre-line text-muted">{course.certificate_description}</p>}
        <p className="text-muted">{course.certificate_conditions}</p>
        <div><Heading>Informations imprimées</Heading><Chips items={(course.certificate_display ?? []).map((d) => DISPLAY_LABELS[d as keyof typeof DISPLAY_LABELS] ?? d)} /></div>
        <p className="text-xs text-muted">{course.auto_certificate ? "Délivré automatiquement dès que l’apprenant est éligible." : "Délivré par le formateur aux apprenants éligibles."}</p>
      </div>
    ),
    avis: <p className="text-sm text-muted">Aucun avis pour le moment : les apprenants peuvent noter la formation une fois qu’ils l’ont terminée.</p>,
  };

  const technical = (
    <section className="rounded-2xl border border-line bg-white p-5">
      <h3 className="mb-3 font-bold text-brand-dark">Détails techniques</h3>
      <dl className="grid gap-x-8 gap-y-3 text-sm sm:grid-cols-2">
        {([
          ["Identifiant", course.id],
          ["Adresse publique", `/formations/${course.slug}`],
          ["Statut", course.status],
          ["Publication", PUBLICATION_LABEL[course.publication_mode] + (course.publication_mode === "scheduled" && course.publish_at ? ` le ${formatDateTime(course.publish_at)}` : "")],
          ["Inscription", ENROLLMENT_LABEL[course.enrollment_mode] ?? "—"],
          ["Inscriptions", course.registrations_open ? "Ouvertes" : "Fermées"],
          ["Mise en avant", course.featured ? "Oui" : "Non"],
          ["Modules / leçons", `${modules.length} / ${lessons} (${published} publiées)`],
          ["Activités d’évaluation", `${activities.length} (${activeActivities.length} actives)`],
          ["Paiement", price === 0 ? "Sans objet" : (course.payment_methods ?? []).map((m) => PAYMENT_METHOD_LABELS[m as keyof typeof PAYMENT_METHOD_LABELS] ?? m).join(", ") || "Aucun moyen indiqué"],
          ["Formation parent", parentTitle ?? "Aucune"],
          ["Certificat automatique", course.auto_certificate ? "Oui" : "Non"],
          ["Forum / téléchargements / progression", `${course.forum_enabled ? "forum" : "sans forum"} · ${course.allow_downloads ? "téléchargements" : "sans téléchargement"} · ${course.show_progress ? "progression visible" : "progression masquée"}`],
        ] as [string, string][]).map(([k, v]) => <div key={k}><dt className="text-xs text-muted">{k}</dt><dd className="break-words font-semibold text-brand-dark">{v}</dd></div>)}
      </dl>
    </section>
  );

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
      <Panel title="Aperçu de la formation">
        <p className="-mt-2 mb-4 text-sm text-muted">Voici un aperçu de la façon dont votre formation sera affichée aux apprenants.</p>
        <PreviewShell
          hero={{
            title: course.title, summary: course.subtitle || summarize(course.description), cover: course.cover_url ?? null, certifying,
            facts: [formatMinutes(course.duration_minutes ?? 0), level, course.default_capacity ? `${course.default_capacity} places par session` : MODES[course.delivery_mode as keyof typeof MODES]].filter(Boolean) as string[],
          }}
          panels={panels}
          technical={technical}
        />
      </Panel>

      <div className="space-y-6 self-start">
        <Panel title="Paramètres de publication">
          <p className="mb-3 flex items-center gap-2 text-sm text-brand-dark"><Clock className="h-4 w-4 text-brand" aria-hidden />Statut actuel : <CourseStatusBadge status={course.status} /></p>
          <PublicationPanel courseId={course.id} initialValues={courseToValues(course)} />
          <div className="mt-4 border-t border-line pt-4"><StatusPanel courseId={course.id} status={course.status} rejectionReason={course.rejection_reason} slug={course.slug} /></div>
        </Panel>
        <Panel title="Checklist avant publication">
          <ul className="space-y-3 text-sm">
            {checks.map(([label, ok]) => (
              <li key={label} className="flex items-center gap-3">
                <span className={cn("flex h-5 w-5 shrink-0 items-center justify-center rounded-full", ok ? "bg-success text-white" : "bg-surface text-muted")}>{ok && <Check className="h-3 w-3" aria-hidden />}</span>
                <span className={ok ? "text-brand-dark" : "text-muted"}>{label}</span>
              </li>
            ))}
          </ul>
          <p className="mt-4 flex items-start gap-2 rounded-lg bg-brand-soft p-3 text-xs text-brand-dark">
            <GraduationCap className="mt-0.5 h-4 w-4 shrink-0 text-brand" aria-hidden />
            En publiant cette formation, elle sera visible dans le catalogue et les apprenants pourront s’y inscrire, après validation pédagogique.
          </p>
        </Panel>
      </div>
    </div>
  );
}
