import Image from "next/image";
import Link from "next/link";
import { BookOpen, ExternalLink, Pencil } from "lucide-react";
import { archiveCourse } from "@/lib/courses/actions";
import { COURSE_STATUS, LEVELS, MODES, type CourseStatus } from "@/lib/courses/labels";
import type { CourseListRow } from "@/lib/courses/course-list";
import { formatShortDate } from "@/lib/format";
import { cn, formatDuration } from "@/lib/utils";
import { ButtonLink } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/feedback";

/** Aperçu de la formation sélectionnée dans la liste (colonne latérale). */
export function CourseSummary({ course: c }: { course: CourseListRow }) {
  const status = COURSE_STATUS[c.status as CourseStatus];
  return (
    <aside aria-label="Aperçu de la formation" className="rounded-2xl border border-line bg-white p-5 shadow-card">
      <div className="relative aspect-video overflow-hidden rounded-xl bg-[linear-gradient(135deg,#092a66,#0639d9)]">
        {c.cover ? (
          <Image src={c.cover} alt="" fill sizes="22rem" className="object-cover" unoptimized={c.cover.startsWith("http")} />
        ) : (
          <BookOpen className="absolute inset-0 m-auto h-12 w-12 text-white/80" aria-hidden />
        )}
        <span className="absolute right-3 top-3">
          <StatusBadge tone={status.tone}>{status.label}</StatusBadge>
        </span>
      </div>

      <h2 className="mt-4 text-lg font-extrabold leading-snug text-brand-dark">{c.title}</h2>
      <p className="text-sm text-muted">{LEVELS[c.level]} · {MODES[c.mode]}</p>

      {c.status === "published" && (
        <Link href={`/formations/${c.slug}`} target="_blank" rel="noopener noreferrer"
          className="mt-4 flex items-center justify-center gap-2 rounded-lg border border-brand px-4 py-2 text-sm font-semibold text-brand hover:bg-brand-soft">
          Voir la formation <ExternalLink className="h-4 w-4" aria-hidden />
        </Link>
      )}

      <dl className="mt-5 space-y-3 text-sm">
        <Fact label="Catégorie" value={c.category ?? "—"} />
        <Fact label="Durée totale" value={formatDuration(c.durationMinutes)} />
        <Fact label="Modules" value={`${c.modules}`} />
        <Fact label="Leçons publiées" value={`${c.lessons}`} />
        <Fact label="Évaluations publiées" value={`${c.quizzes}`} />
        <Fact label="Apprenants" value={`${c.learners}`} />
        <div className="flex items-start justify-between gap-3">
          <dt className="text-muted">Progression moyenne</dt>
          <dd className="w-28 text-right font-semibold text-brand-dark">
            {c.percent} %
            <span className="mt-1 block h-1.5 overflow-hidden rounded-full bg-surface" aria-hidden>
              <span className="block h-full rounded-full bg-brand" style={{ width: `${c.percent}%` }} />
            </span>
          </dd>
        </div>
        <Fact label="Taux de réussite" value={c.success === null ? "—" : `${c.success} %`} />
        <Fact label="Dernière mise à jour" value={formatShortDate(c.updatedAt)} />
      </dl>

      <div className="mt-6 space-y-3">
        <ButtonLink href={`/formateur/formations/${c.id}`} variant="primary" className="w-full">
          <Pencil className="h-4 w-4" aria-hidden /> Modifier la formation
        </ButtonLink>
        {c.status !== "archived" && (
          <form action={archiveCourse}>
            <input type="hidden" name="courseId" value={c.id} />
            <button type="submit" className={cn("w-full rounded-lg border border-danger px-4 py-2 text-sm font-semibold text-danger hover:bg-danger/5")}>
              Archiver la formation
            </button>
          </form>
        )}
      </div>
    </aside>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <dt className="text-muted">{label}</dt>
      <dd className="text-right font-semibold text-brand-dark">{value}</dd>
    </div>
  );
}
