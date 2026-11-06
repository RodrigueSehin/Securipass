import Link from "next/link";
import { ArrowRight, ExternalLink } from "lucide-react";
import { ContentTypeBadge, ContentTypeChip, CONTENT_TYPE_META } from "@/components/courses/content-type";
import { ButtonLink } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/feedback";
import { moduleLabel, type LibraryContent } from "@/lib/courses/content-library";
import { formatShortDate } from "@/lib/format";
import { formatDuration } from "@/lib/utils";

/** Aperçu du contenu sélectionné dans la bibliothèque (colonne latérale) et contenus liés du même module. */
export function ContentSummary({ content: c, related, relatedHref }: {
  content: LibraryContent; related: LibraryContent[]; relatedHref: (id: string) => string;
}) {
  const Icon = CONTENT_TYPE_META[c.type].icon;
  return (
    <aside aria-label="Aperçu du contenu" className="rounded-2xl border border-line bg-white p-5 shadow-card">
      <div className="flex aspect-video items-center justify-center rounded-xl bg-[linear-gradient(135deg,#092a66,#0639d9)]">
        <Icon className="h-14 w-14 text-white/85" aria-hidden />
      </div>

      <h2 className="mt-4 text-lg font-extrabold leading-snug text-brand-dark">{c.title}</h2>
      {c.description && <p className="mt-1 text-sm text-muted">{c.description}</p>}

      <dl className="mt-5 space-y-3 text-sm">
        <Fact label="Type"><ContentTypeBadge type={c.type} /></Fact>
        <Fact label="Formation"><span className="text-brand-dark">{c.courseTitle}</span></Fact>
        <Fact label="Module"><span className="text-brand-dark">{moduleLabel(c)}</span></Fact>
        <Fact label="Durée"><span className="text-brand-dark">{c.durationMinutes > 0 ? formatDuration(c.durationMinutes) : "—"}</span></Fact>
        <Fact label="Statut">
          <StatusBadge tone={c.status === "published" ? "success" : "warning"}>{c.status === "published" ? "Publié" : "Brouillon"}</StatusBadge>
        </Fact>
        <Fact label="Date de création"><span className="text-brand-dark">{formatShortDate(c.createdAt)}</span></Fact>
        <Fact label="Dernière modification"><span className="text-brand-dark">{formatShortDate(c.updatedAt)}</span></Fact>
      </dl>

      <ButtonLink href={`/formateur/formations/${c.courseId}/programme`} variant="primary" className="mt-5 w-full">
        Voir dans le programme <ExternalLink className="h-4 w-4" aria-hidden />
      </ButtonLink>

      <section className="mt-6" aria-labelledby="utilisation">
        <h3 id="utilisation" className="text-sm font-bold text-brand-dark">Utilisation</h3>
        <p className="mt-2 rounded-xl bg-surface p-3 text-sm text-brand-dark">
          <span className="text-2xl font-extrabold">{c.completions}</span>{" "}
          <span className="text-muted">apprenant{c.completions > 1 ? "s" : ""} {c.completions > 1 ? "ont" : "a"} terminé ce contenu</span>
        </p>
      </section>

      {related.length > 0 && (
        <section className="mt-6" aria-labelledby="lies">
          <h3 id="lies" className="text-sm font-bold text-brand-dark">Contenus liés</h3>
          <ul className="mt-2 divide-y divide-line">
            {related.map((r) => (
              <li key={r.id}>
                <Link href={relatedHref(r.id)} className="flex items-center gap-3 py-2.5 hover:text-brand">
                  <ContentTypeChip type={r.type} className="h-9 w-12" />
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium text-brand-dark">{r.title}</span>
                    <span className="block text-xs text-muted">{moduleLabel(r)}</span>
                  </span>
                  <ArrowRight className="ml-auto h-4 w-4 shrink-0 text-muted" aria-hidden />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </aside>
  );
}

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <dt className="text-muted">{label}</dt>
      <dd className="text-right">{children}</dd>
    </div>
  );
}
