import Link from "next/link";
import { BookOpen, ChevronDown, Clock, Download, EllipsisVertical, FileText, GripVertical, Plus, Trash, X } from "lucide-react";
import { ContentTypeBadge, ContentTypeChip } from "@/components/courses/content-type";
import { ContentForm } from "@/components/courses/programme-forms";
import { EmptyState } from "@/components/ui/feedback";
import { deleteContent, deleteModule, deleteModuleResource, duplicateContent, moveItem, setContentStatus } from "@/lib/courses/actions";
import type { ProgrammeModule } from "@/lib/courses/instructor-queries";
import { formatBytes, formatMinutes } from "@/lib/format";
import { cn } from "@/lib/utils";
import { AddModuleForm, ModuleEditor, ResourceUpload, SortableList } from "./programme-client";

type Content = ProgrammeModule["contents"][number];

const moduleMinutes = (m: ProgrammeModule) => m.contents.reduce((n, c) => n + c.duration_minutes, 0);
const summary = (m: ProgrammeModule) => `${m.contents.length} leçon${m.contents.length > 1 ? "s" : ""} · ${formatMinutes(moduleMinutes(m))}`;
const href = (courseId: string, moduleId?: string, lesson?: string) => {
  const p = new URLSearchParams({ etape: "2" });
  if (moduleId) p.set("module", moduleId);
  if (lesson) p.set("lecon", lesson);
  return `/formateur/formations/nouveau/${courseId}?${p.toString()}`;
};

/** Menu « ⋮ » d'un élément : déplacer (alternative au glisser-déposer), dupliquer, supprimer. */
function ItemMenu({ children, label }: { children: React.ReactNode; label: string }) {
  return (
    <details className="relative shrink-0">
      <summary aria-label={label} className="flex cursor-pointer list-none rounded-lg p-1.5 text-muted hover:bg-surface [&::-webkit-details-marker]:hidden">
        <EllipsisVertical className="h-4 w-4" aria-hidden />
      </summary>
      <div className="absolute right-0 z-20 mt-1 w-52 rounded-xl border border-line bg-white py-1 shadow-card">{children}</div>
    </details>
  );
}

const menuItem = "flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-brand-dark hover:bg-surface";

function MoveForms({ kind, id, courseId }: { kind: "module" | "content"; id: string; courseId: string }) {
  return (
    <>
      {(["up", "down"] as const).map((direction) => (
        <form key={direction} action={moveItem}>
          <input type="hidden" name="kind" value={kind} />
          <input type="hidden" name="id" value={id} />
          <input type="hidden" name="courseId" value={courseId} />
          <input type="hidden" name="direction" value={direction} />
          <button className={menuItem}>{direction === "up" ? "Monter" : "Descendre"}</button>
        </form>
      ))}
    </>
  );
}

function ModuleList({ courseId, modules, selectedId }: { courseId: string; modules: ProgrammeModule[]; selectedId: string | null }) {
  return (
    <SortableList
      kind="module" parentId={courseId} courseId={courseId} className="mt-4 space-y-2"
      items={modules.map((m, i) => ({
        id: m.id,
        node: (
          <div className={cn("flex items-center gap-2 rounded-xl border p-2.5", m.id === selectedId ? "border-brand bg-brand-soft/50" : "border-line bg-white")}>
            <GripVertical className="h-4 w-4 shrink-0 cursor-grab text-muted" aria-hidden />
            <Link href={href(courseId, m.id)} className="flex min-w-0 flex-1 items-center gap-3" aria-current={m.id === selectedId ? "true" : undefined}>
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-surface text-sm font-bold text-brand-dark">{i + 1}</span>
              <span className="min-w-0">
                <span className="block truncate text-sm font-semibold text-brand-dark">{m.title}</span>
                <span className="block text-xs text-muted">{summary(m)}</span>
              </span>
            </Link>
            <ItemMenu label={`Actions du module ${m.title}`}>
              <Link href={href(courseId, m.id)} className={menuItem}>Modifier</Link>
              <MoveForms kind="module" id={m.id} courseId={courseId} />
              <DeleteModule courseId={courseId} moduleId={m.id} title={m.title} />
            </ItemMenu>
          </div>
        ),
      }))}
    />
  );
}

/** Suppression d'un module : demande une confirmation (le module et ses leçons sont supprimés). */
function DeleteModule({ courseId, moduleId, title, button = false }: { courseId: string; moduleId: string; title: string; button?: boolean }) {
  return (
    <details className="px-1">
      <summary className={button
        ? "flex cursor-pointer list-none items-center gap-2 rounded-lg border border-danger px-3 py-2 text-sm font-semibold text-danger hover:bg-danger/5 [&::-webkit-details-marker]:hidden"
        : "flex cursor-pointer list-none items-center gap-2 rounded-lg px-2 py-2 text-sm text-danger hover:bg-surface [&::-webkit-details-marker]:hidden"}>
        <Trash className="h-4 w-4" aria-hidden /> Supprimer le module
      </summary>
      <form action={deleteModule} className="mt-1 w-56 rounded-xl border border-line bg-white p-3 shadow-card">
        <p className="text-sm text-brand-dark">Supprimer « {title} » et toutes ses leçons ?</p>
        <input type="hidden" name="moduleId" value={moduleId} />
        <input type="hidden" name="courseId" value={courseId} />
        <button className="mt-2 w-full rounded-lg bg-danger px-3 py-1.5 text-sm font-semibold text-white hover:bg-danger/90">Confirmer la suppression</button>
      </form>
    </details>
  );
}

function StatusSwitch({ content, courseId }: { content: Content; courseId: string }) {
  const on = content.status === "published";
  return (
    <form action={setContentStatus} className="shrink-0">
      <input type="hidden" name="contentId" value={content.id} />
      <input type="hidden" name="courseId" value={courseId} />
      <input type="hidden" name="status" value={on ? "draft" : "published"} />
      <button role="switch" aria-checked={on} aria-label={`${content.title} : ${on ? "publiée, passer en brouillon" : "brouillon, publier"}`} className="flex items-center gap-2 text-xs font-semibold">
        <span aria-hidden className={cn("relative h-5 w-9 rounded-full transition-colors", on ? "bg-success" : "bg-line")}>
          <span className={cn("absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all", on ? "left-4.5" : "left-0.5")} />
        </span>
        <span className={on ? "text-success" : "text-muted"}>{on ? "Publiée" : "Brouillon"}</span>
      </button>
    </form>
  );
}

function LessonList({ courseId, module }: { courseId: string; module: ProgrammeModule }) {
  return (
    <SortableList
      kind="content" parentId={module.id} courseId={courseId} className="space-y-2"
      items={module.contents.map((c, i) => ({
        id: c.id,
        node: (
          <div className="flex flex-wrap items-center gap-3 rounded-xl border border-line bg-white p-2.5">
            <GripVertical className="h-4 w-4 shrink-0 cursor-grab text-muted" aria-hidden />
            <ContentTypeChip type={c.content_type} />
            <span className="min-w-0 flex-1 basis-40">
              <span className="block truncate text-sm font-semibold text-brand-dark"><span className="mr-2 text-muted">{i + 1}</span>{c.title}</span>
            </span>
            <ContentTypeBadge type={c.content_type} />
            <span className="flex w-16 items-center gap-1 text-xs text-muted"><Clock className="h-3.5 w-3.5" aria-hidden />{formatMinutes(c.duration_minutes)}</span>
            <StatusSwitch content={c} courseId={courseId} />
            <ItemMenu label={`Actions de la leçon ${c.title}`}>
              <Link href={href(courseId, module.id, c.id)} className={menuItem}>Modifier</Link>
              <MoveForms kind="content" id={c.id} courseId={courseId} />
              <form action={duplicateContent}>
                <input type="hidden" name="contentId" value={c.id} /><input type="hidden" name="courseId" value={courseId} />
                <button className={menuItem}>Dupliquer</button>
              </form>
              <form action={deleteContent}>
                <input type="hidden" name="contentId" value={c.id} /><input type="hidden" name="courseId" value={courseId} />
                <button className={cn(menuItem, "text-danger")}><Trash className="h-4 w-4" aria-hidden /> Supprimer</button>
              </form>
            </ItemMenu>
          </div>
        ),
      }))}
    />
  );
}

function Resources({ courseId, module }: { courseId: string; module: ProgrammeModule }) {
  return (
    <section aria-labelledby="ressources" className="rounded-2xl border border-line bg-white p-5">
      <h3 id="ressources" className="font-bold text-brand-dark">Ressources du module <span className="font-normal text-muted">(facultatif)</span></h3>
      <p className="mb-3 text-sm text-muted">Ajoutez des documents utiles, téléchargeables par les inscrits.</p>
      <div className="grid gap-4 md:grid-cols-2">
        <ResourceUpload courseId={courseId} moduleId={module.id} />
        <ul className="space-y-2">
          {module.resources.length === 0 && <li className="text-sm text-muted">Aucune ressource pour ce module.</li>}
          {module.resources.map((r) => (
            <li key={r.id} className="flex items-center gap-3 rounded-lg border border-line p-2.5">
              <FileText className="h-5 w-5 shrink-0 text-danger" aria-hidden />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold text-brand-dark">{r.name}</span>
                <span className="block text-xs text-muted">{(r.name.split(".").pop() ?? "").toUpperCase()} · {formatBytes(r.size_bytes)}</span>
              </span>
              <a href={`/app/ressources/${r.id}`} aria-label={`Télécharger ${r.name}`} className="rounded p-1.5 text-brand hover:bg-brand-soft"><Download className="h-4 w-4" aria-hidden /></a>
              <form action={deleteModuleResource}>
                <input type="hidden" name="resourceId" value={r.id} /><input type="hidden" name="courseId" value={courseId} />
                <button aria-label={`Supprimer ${r.name}`} className="rounded p-1.5 text-danger hover:bg-danger/10"><Trash className="h-4 w-4" aria-hidden /></button>
              </form>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

function ProgrammePreview({ modules, selectedId }: { modules: ProgrammeModule[]; selectedId: string | null }) {
  const total = modules.reduce((n, m) => n + moduleMinutes(m), 0);
  return (
    <div className="space-y-4">
      <section className="rounded-2xl border border-line bg-white p-5">
        <h2 className="mb-3 font-bold text-brand-dark">Aperçu du programme</h2>
        {modules.length === 0 ? (
          <p className="text-sm text-muted">Le programme apparaîtra ici dès le premier module.</p>
        ) : (
          <ul className="space-y-2">
            {modules.map((m, i) => (
              <li key={m.id}>
                <details open={m.id === selectedId} className="group rounded-xl border border-line">
                  <summary className="flex cursor-pointer list-none items-center gap-3 p-3 [&::-webkit-details-marker]:hidden">
                    <span className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold", m.id === selectedId ? "bg-brand text-white" : "bg-surface text-brand-dark")}>{i + 1}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold text-brand-dark">{m.title}</span>
                      <span className="block text-xs text-muted">{summary(m)}</span>
                    </span>
                    <ChevronDown className="h-4 w-4 text-muted transition-transform group-open:rotate-180" aria-hidden />
                  </summary>
                  {m.contents.length > 0 && (
                    <ul className="space-y-1.5 border-t border-line p-3">
                      {m.contents.map((c) => (
                        <li key={c.id} className="flex items-center gap-2 text-xs text-brand-dark">
                          <ContentTypeChip type={c.content_type} className="h-6 w-6 rounded-md [&>svg]:h-3.5 [&>svg]:w-3.5" />
                          <span className="min-w-0 flex-1 truncate">{c.title}</span>
                          <span className="shrink-0 text-muted">{formatMinutes(c.duration_minutes)}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </details>
              </li>
            ))}
          </ul>
        )}
      </section>
      <section className="flex items-center gap-4 rounded-2xl border border-line bg-white p-5">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-brand-soft text-brand"><Clock className="h-6 w-6" aria-hidden /></span>
        <div>
          <p className="text-sm font-bold text-brand-dark">Durée totale de la formation</p>
          <p className="text-sm text-muted"><strong className="text-brand-dark">{formatMinutes(total)}</strong> ({modules.length} module{modules.length > 1 ? "s" : ""})</p>
        </div>
      </section>
    </div>
  );
}

/** Étape 2 : modules à gauche, détail du module sélectionné au centre (leçons, ressources), aperçu du programme à droite. */
export function ProgrammeBuilder({ courseId, modules, moduleId, lesson }: {
  courseId: string; modules: ProgrammeModule[]; moduleId?: string; lesson?: string;
}) {
  const selected = modules.find((m) => m.id === moduleId) ?? modules[0] ?? null;
  const editing = lesson === "new" ? "new" : selected?.contents.find((c) => c.id === lesson) ?? null;

  return (
    <div className="grid gap-6 xl:grid-cols-[20rem_minmax(0,1fr)_22rem]">
      <section className="self-start rounded-2xl border border-line bg-white p-5" aria-labelledby="programme">
        <div className="flex items-start gap-3">
          <BookOpen className="mt-0.5 h-6 w-6 shrink-0 text-brand" aria-hidden />
          <div>
            <h2 id="programme" className="text-lg font-bold text-brand-dark">Programme de la formation</h2>
            <p className="text-sm text-muted">Organisez votre formation en modules et leçons.</p>
          </div>
        </div>
        <div className="mt-4"><AddModuleForm courseId={courseId} /></div>
        <ModuleList courseId={courseId} modules={modules} selectedId={selected?.id ?? null} />
        {modules.length > 1 && <p className="mt-3 text-xs text-muted">Glissez les modules pour changer leur ordre.</p>}
      </section>

      <div className="min-w-0 space-y-6">
        {!selected ? (
          <EmptyState title="Aucun module pour le moment">Ajoutez un premier module avec le bouton « Ajouter un module ».</EmptyState>
        ) : (
          <>
            <section className="rounded-2xl border border-line bg-white p-5" aria-labelledby="module">
              <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 id="module" className="text-lg font-bold text-brand-dark">Module {selected.position} : {selected.title}</h2>
                  <p className="text-sm text-muted">Définissez les informations de ce module et ajoutez ses leçons.</p>
                </div>
                <DeleteModule courseId={courseId} moduleId={selected.id} title={selected.title} button />
              </div>
              <ModuleEditor
                key={selected.id} courseId={courseId} count={modules.length}
                module={{ id: selected.id, title: selected.title, description: selected.description, position: selected.position }}
                durationLabel={formatMinutes(moduleMinutes(selected))}
              />
            </section>

            <section className="rounded-2xl border border-line bg-white p-5" aria-labelledby="lecons">
              <div className="mb-3 flex items-center justify-between gap-3">
                <h3 id="lecons" className="font-bold text-brand-dark">Leçons du module ({selected.contents.length})</h3>
                <Link href={href(courseId, selected.id, "new")} className="inline-flex items-center gap-2 rounded-lg border border-brand px-4 py-2 text-sm font-semibold text-brand hover:bg-brand-soft">
                  <Plus className="h-4 w-4" aria-hidden /> Ajouter une leçon
                </Link>
                <Link href={`/formateur/contenus/nouveau?module=${selected.id}`} className="inline-flex items-center gap-2 rounded-lg border border-line px-4 py-2 text-sm font-semibold text-brand-dark hover:bg-brand-soft">
                  Contenu pédagogique complet
                </Link>
              </div>
              {selected.contents.length === 0 && !editing && <p className="text-sm text-muted">Aucune leçon dans ce module. Ajoutez une vidéo, un document, un texte ou une activité.</p>}
              <LessonList courseId={courseId} module={selected} />
              {editing && (
                <div className="mt-4 rounded-xl border border-brand/30 bg-brand-soft/30 p-4">
                  <div className="mb-3 flex items-center justify-between">
                    <h4 className="font-semibold text-brand-dark">{editing === "new" ? "Nouvelle leçon" : `Modifier : ${editing.title}`}</h4>
                    <Link href={href(courseId, selected.id)} aria-label="Fermer" className="rounded p-1 text-muted hover:bg-white"><X className="h-4 w-4" aria-hidden /></Link>
                  </div>
                  <ContentForm key={editing === "new" ? "new" : editing.id} courseId={courseId} moduleId={selected.id} content={editing === "new" ? undefined : editing} />
                </div>
              )}
              {selected.contents.some((c) => c.status === "draft") && (
                <p className="mt-3 text-xs text-muted">Seules les leçons publiées sont visibles des inscrits.</p>
              )}
            </section>

            <Resources courseId={courseId} module={selected} />
          </>
        )}
      </div>

      <ProgrammePreview modules={modules} selectedId={selected?.id ?? null} />
    </div>
  );
}
