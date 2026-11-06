import { Suspense } from "react";
import { notFound } from "next/navigation";
import { ArrowDown, ArrowUp, Trash2 } from "lucide-react";
import { ContentForm, ModuleForm } from "@/components/courses/programme-forms";
import { Alert, EmptyState, StatusBadge } from "@/components/ui/feedback";
import { getOwnCourse, getProgramme } from "@/lib/courses/instructor-queries";
import { deleteContent, deleteModule, moveItem } from "@/lib/courses/actions";
import { CONTENT_TYPES } from "@/lib/courses/labels";
import { formatDuration } from "@/lib/utils";

export const metadata = { title: "Programme de la formation" };

type Props = { params: Promise<{ id: string }>; searchParams: Promise<{ cree?: string }> };

function IconButton({ label, children, danger }: { label: string; children: React.ReactNode; danger?: boolean }) {
  return (
    <button aria-label={label} title={label} className={`rounded p-1.5 hover:bg-brand-soft ${danger ? "text-danger" : "text-muted hover:text-brand"}`}>{children}</button>
  );
}

function Move({ kind, id, courseId, direction }: { kind: "module" | "content"; id: string; courseId: string; direction: "up" | "down" }) {
  return (
    <form action={moveItem}>
      <input type="hidden" name="kind" value={kind} />
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="courseId" value={courseId} />
      <input type="hidden" name="direction" value={direction} />
      <IconButton label={direction === "up" ? "Monter" : "Descendre"}>{direction === "up" ? <ArrowUp className="h-4 w-4" /> : <ArrowDown className="h-4 w-4" />}</IconButton>
    </form>
  );
}

async function Programme({ params, searchParams }: Props) {
  const [{ id }, { cree }] = await Promise.all([params, searchParams]);
  const course = await getOwnCourse(id);
  if (!course) notFound();
  const modules = await getProgramme(id);

  return (
    <div className="max-w-4xl space-y-6">
      {cree && <Alert tone="success">Formation créée en brouillon. Construisez maintenant son programme.</Alert>}
      <p className="text-sm text-muted">
        Organisez la formation en modules et contenus. Seuls les contenus <strong>publiés</strong> sont accessibles aux inscrits ; les fichiers restent privés.
        {course.status === "published" && " Modifier le programme d’une formation publiée la renvoie en validation pédagogique."}
      </p>

      {modules.length === 0 && <EmptyState title="Aucun module pour le moment">Ajoutez un premier module ci-dessous.</EmptyState>}

      {modules.map((m, i) => (
        <section key={m.id} className="rounded-2xl border border-line bg-white p-5 shadow-card" aria-label={`Module ${i + 1}`}>
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase text-brand">Module {i + 1}</p>
              <h2 className="text-lg font-bold text-brand-dark">{m.title}</h2>
              {m.description && <p className="mt-1 text-sm text-muted">{m.description}</p>}
            </div>
            <div className="flex shrink-0 items-center">
              {i > 0 && <Move kind="module" id={m.id} courseId={id} direction="up" />}
              {i < modules.length - 1 && <Move kind="module" id={m.id} courseId={id} direction="down" />}
              <form action={deleteModule}>
                <input type="hidden" name="moduleId" value={m.id} /><input type="hidden" name="courseId" value={id} />
                <IconButton label="Supprimer le module et ses contenus" danger><Trash2 className="h-4 w-4" /></IconButton>
              </form>
            </div>
          </div>

          <ul className="mt-4 space-y-2">
            {m.contents.map((c, j) => (
              <li key={c.id} className="rounded-xl border border-line">
                <div className="flex items-center justify-between gap-3 px-4 py-3">
                  <div className="min-w-0">
                    <p className="truncate font-medium text-brand-dark">{c.title}</p>
                    <p className="text-xs text-muted">{CONTENT_TYPES[c.content_type]}{c.duration_minutes > 0 ? ` · ${formatDuration(c.duration_minutes)}` : ""}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <StatusBadge tone={c.status === "published" ? "success" : "neutral"}>{c.status === "published" ? "Publié" : "Brouillon"}</StatusBadge>
                    {j > 0 && <Move kind="content" id={c.id} courseId={id} direction="up" />}
                    {j < m.contents.length - 1 && <Move kind="content" id={c.id} courseId={id} direction="down" />}
                    <form action={deleteContent}>
                      <input type="hidden" name="contentId" value={c.id} /><input type="hidden" name="courseId" value={id} />
                      <IconButton label="Supprimer le contenu" danger><Trash2 className="h-4 w-4" /></IconButton>
                    </form>
                  </div>
                </div>
                <details className="border-t border-line px-4 py-3">
                  <summary className="cursor-pointer text-sm font-semibold text-brand">Modifier ce contenu</summary>
                  <div className="mt-3"><ContentForm courseId={id} moduleId={m.id} content={c} /></div>
                </details>
              </li>
            ))}
          </ul>

          <details className="mt-4 rounded-xl bg-surface px-4 py-3">
            <summary className="cursor-pointer text-sm font-semibold text-brand">+ Ajouter un contenu</summary>
            <div className="mt-3"><ContentForm courseId={id} moduleId={m.id} /></div>
          </details>
          <details className="mt-2 px-1 py-1">
            <summary className="cursor-pointer text-sm text-muted hover:text-brand">Modifier le module</summary>
            <div className="mt-3"><ModuleForm courseId={id} module={m} /></div>
          </details>
        </section>
      ))}

      <section className="rounded-2xl border border-line bg-white p-5 shadow-card">
        <h2 className="mb-3 text-lg font-bold text-brand-dark">Ajouter un module</h2>
        <ModuleForm courseId={id} />
      </section>
    </div>
  );
}

export default function ProgrammePage(props: Props) {
  return (
    <Suspense fallback={<div className="h-96 max-w-4xl animate-pulse rounded-2xl bg-white" aria-hidden />}>
      <Programme {...props} />
    </Suspense>
  );
}
