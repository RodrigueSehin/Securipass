import { ListChecks, Minus, Plus } from "lucide-react";
import { CONTENT_TYPES } from "@/lib/courses/labels";
import { formatShortDuration, moduleMeta, pluralize, programmeStats } from "@/lib/courses/detail";
import type { PublicCourse } from "@/lib/courses/types";

/** Programme déroulant (aucun JavaScript : éléments <details>). Seuls les titres des leçons sont publics. */
export function Programme({ modules }: { modules: PublicCourse["modules"] }) {
  const s = programmeStats(modules);
  return (
    <section id="programme" className="scroll-mt-36">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <h2 className="flex items-center gap-2.5 text-2xl font-extrabold text-brand-dark"><ListChecks className="h-6 w-6 text-cta" aria-hidden />Programme de la formation</h2>
        {s.modules > 0 && <p className="text-sm text-muted">{pluralize(s.modules, "module", "modules")} • {pluralize(s.lessons, "leçon", "leçons")}</p>}
      </div>
      {modules.length === 0 ? (
        <p className="mt-4 rounded-xl border border-dashed border-line p-5 text-sm text-muted">Le programme détaillé sera publié prochainement.</p>
      ) : (
        <ol className="mt-4 space-y-2.5">
          {modules.map((m, i) => {
            const meta = moduleMeta(m.contents);
            const dur = formatShortDuration(meta.minutes);
            return (
              <li key={m.id}>
                <details className="group rounded-xl border border-line bg-white open:shadow-card">
                  <summary className="flex cursor-pointer list-none items-center gap-3 px-4 py-3.5 [&::-webkit-details-marker]:hidden">
                    <span className="font-bold text-brand-dark">Module {i + 1} : {m.title}</span>
                    <span className="ml-auto flex shrink-0 items-center gap-3 text-xs text-muted">
                      {meta.lessons > 0 && <span>{pluralize(meta.lessons, "leçon", "leçons")}{dur ? ` • ${dur}` : ""}</span>}
                      <Plus className="h-4 w-4 text-brand-dark group-open:hidden" aria-hidden />
                      <Minus className="hidden h-4 w-4 text-brand-dark group-open:block" aria-hidden />
                    </span>
                  </summary>
                  <div className="border-t border-line px-4 py-3 text-sm text-muted">
                    {m.description && <p className="mb-2">{m.description}</p>}
                    {m.contents.length === 0 ? <p>Contenu à venir.</p> : (
                      <ul className="space-y-1.5">
                        {m.contents.map((l, j) => (
                          <li key={j} className="flex justify-between gap-3">
                            <span className="text-brand-dark">{l.title} <span className="text-xs text-muted">({CONTENT_TYPES[l.type]})</span></span>
                            {l.duration_minutes > 0 && <span className="shrink-0 text-xs">{formatShortDuration(l.duration_minutes)}</span>}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </details>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
