import Image from "next/image";
import Link from "next/link";
import { BookOpen, Check, ExternalLink } from "lucide-react";
import type { OwnCourse } from "@/lib/courses/instructor-queries";
import { LANGUAGE_REQUIREMENTS, LEVELS, MODES } from "@/lib/courses/labels";
import { formatDateTime, formatMinutes } from "@/lib/format";
import { cn, formatFcfa } from "@/lib/utils";

const PUBLICATION = { draft: "Brouillon", publish: "Publiée après validation", scheduled: "Planifiée" } as const;

/** Colonne de droite de l'étape 4 : aperçu des informations enregistrées et liste de contrôle avant publication. */
export function SettingsAside({ course, categoryName, modules, lessons, activities }: {
  course: OwnCourse; categoryName: string | null; modules: number; lessons: number; activities: number;
}) {
  const facts: [string, string][] = [
    ["Catégorie", categoryName ?? "—"],
    ["Niveau", LEVELS[course.level as keyof typeof LEVELS] ?? "—"],
    ["Format", MODES[course.delivery_mode as keyof typeof MODES] ?? "—"],
    ["Durée totale", formatMinutes(course.duration_minutes ?? 0)],
    ["Prix", (course.price_amount ?? 0) === 0 ? "Gratuite" : formatFcfa(course.price_amount ?? 0)],
    ["Places par session", course.default_capacity ? String(course.default_capacity) : "—"],
    ["Langue principale", course.language === "en" ? "Anglais" : "Français"],
    ["Langue requise", course.language_requirement ? LANGUAGE_REQUIREMENTS[course.language_requirement as keyof typeof LANGUAGE_REQUIREMENTS] : "Aucune"],
    ["Publication", PUBLICATION[course.publication_mode]],
  ];
  if (course.publication_mode === "scheduled" && course.publish_at) facts.push(["Date de publication", formatDateTime(course.publish_at)]);

  const checks: [string, boolean][] = [
    ["Informations générales complétées", Boolean(course.category_id && (course.description ?? "").trim().length >= 50 && (course.duration_minutes ?? 0) > 0)],
    [`Programme défini (${modules} module${modules > 1 ? "s" : ""}, ${lessons} leçon${lessons > 1 ? "s" : ""})`, modules > 0 && lessons > 0],
    [`Évaluation configurée (${activities} activité${activities > 1 ? "s" : ""})`, !course.evaluation_enabled || activities > 0],
    ["Paramètres définis", true],
    ["Aperçu et soumission", false],
  ];

  return (
    <aside className="space-y-6 self-start" aria-label="Aperçu et liste de contrôle">
      <section className="rounded-2xl border border-line bg-white p-5 shadow-card">
        <h2 className="mb-3 text-lg font-bold text-brand-dark">Aperçu de la formation</h2>
        <div className="relative aspect-video overflow-hidden rounded-xl bg-[linear-gradient(135deg,#092a66,#0639d9)]">
          {course.cover_url
            ? <Image src={course.cover_url} alt="" fill sizes="20rem" className="object-cover" unoptimized={course.cover_url.startsWith("http")} />
            : <BookOpen className="absolute inset-0 m-auto h-10 w-10 text-white/80" aria-hidden />}
          <span className="absolute left-2 top-2 rounded-md bg-white px-2 py-0.5 text-xs font-bold text-brand">Aperçu</span>
        </div>
        <h3 className="mt-3 font-extrabold text-brand-dark">{course.title}</h3>
        <p className="text-sm text-muted">{course.certificate_enabled && course.certificate_template_id ? "Formation certifiante" : "Formation"}</p>
        <dl className="mt-3 space-y-2 text-sm">
          {facts.map(([k, v]) => (
            <div key={k} className="flex justify-between gap-3"><dt className="text-muted">{k}</dt><dd className="text-right font-semibold text-brand-dark">{v}</dd></div>
          ))}
        </dl>
        <Link href={`/formateur/formations/nouveau/${course.id}?etape=5`} className="mt-4 flex items-center justify-center gap-2 rounded-lg border border-brand px-4 py-2 text-sm font-semibold text-brand hover:bg-brand-soft">
          Voir tous les détails <ExternalLink className="h-4 w-4" aria-hidden />
        </Link>
        <p className="mt-2 text-xs text-muted">Reflète les informations enregistrées : enregistrez cette étape pour mettre l’aperçu à jour.</p>
      </section>

      <section className="rounded-2xl border border-line bg-white p-5 shadow-card">
        <h2 className="mb-3 text-lg font-bold text-brand-dark">Checklist de publication</h2>
        <ul className="space-y-3 text-sm">
          {checks.map(([label, ok]) => (
            <li key={label} className="flex items-center gap-3">
              <span className={cn("flex h-5 w-5 shrink-0 items-center justify-center rounded-full", ok ? "bg-success text-white" : "bg-surface text-muted")}>{ok && <Check className="h-3 w-3" aria-hidden />}</span>
              <span className={ok ? "text-brand-dark" : "text-muted"}>{label}</span>
            </li>
          ))}
        </ul>
      </section>
    </aside>
  );
}
