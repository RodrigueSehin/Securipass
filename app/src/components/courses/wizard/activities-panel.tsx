import Link from "next/link";
import { Copy, Pencil, Plus, Trash, X } from "lucide-react";
import { deleteActivity, deleteQuestion, duplicateActivity, saveGrade, setActivityStatus } from "@/lib/courses/evaluation-actions";
import type { Activity, GradeRow } from "@/lib/courses/evaluation-queries";
import { ACTIVITY_KINDS, formatGrade, toScale, totalWeight, weightWarning, type ActivityKind, type Rounding } from "@/lib/courses/grading";
import { Alert, EmptyState } from "@/components/ui/feedback";
import { cn } from "@/lib/utils";
import { ActivityForm, QuestionForm } from "./activity-forms";

type CourseSettings = { id: string; grading_scale: number; grade_rounding: Rounding; default_attempts: number; evaluation_types: string[] };

const KIND_STYLE: Record<ActivityKind, string> = {
  quiz: "bg-brand-soft text-brand",
  assignment: "bg-cta/10 text-cta",
  case_study: "bg-success/10 text-success",
  practical: "bg-[#f3e8ff] text-[#7c3aed]",
};

const href = (courseId: string, params: Record<string, string> = {}) => {
  const p = new URLSearchParams({ etape: "3", ...params });
  return `/formateur/formations/nouveau/${courseId}?${p.toString()}`;
};

function StatusSwitch({ activity, courseId }: { activity: Activity; courseId: string }) {
  const on = activity.status === "published";
  return (
    <form action={setActivityStatus}>
      <input type="hidden" name="evaluationId" value={activity.id} />
      <input type="hidden" name="courseId" value={courseId} />
      <input type="hidden" name="status" value={on ? "draft" : "published"} />
      <button role="switch" aria-checked={on} aria-label={`${activity.title} : ${on ? "active, désactiver" : "inactive, activer"}`} className="flex items-center gap-2 text-xs font-semibold">
        <span aria-hidden className={cn("relative h-5 w-9 rounded-full transition-colors", on ? "bg-success" : "bg-line")}>
          <span className={cn("absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all", on ? "left-4.5" : "left-0.5")} />
        </span>
        <span className={on ? "text-success" : "text-muted"}>{on ? "Active" : "Inactive"}</span>
      </button>
    </form>
  );
}

function Questions({ courseId, activity }: { courseId: string; activity: Activity }) {
  return (
    <section className="mt-5" aria-labelledby="questions">
      <h4 id="questions" className="mb-2 font-bold text-brand-dark">Questions du quiz ({activity.questions.length})</h4>
      {activity.questions.length === 0 && <p className="mb-3 text-sm text-muted">Aucune question. Ajoutez-en au moins une avec sa bonne réponse pour pouvoir activer ce quiz.</p>}
      <ol className="space-y-2">
        {activity.questions.map((q, i) => (
          <li key={q.id} className="rounded-xl border border-line bg-white">
            <details>
              <summary className="flex cursor-pointer list-none items-center gap-3 p-3 [&::-webkit-details-marker]:hidden">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-surface text-xs font-bold text-brand-dark">{i + 1}</span>
                <span className="min-w-0 flex-1 truncate text-sm font-semibold text-brand-dark">{q.prompt}</span>
                <span className="shrink-0 text-xs text-muted">{q.points} pt{q.points > 1 ? "s" : ""} · {q.options.length} propositions</span>
              </summary>
              <div className="space-y-3 border-t border-line p-3">
                <QuestionForm courseId={courseId} evaluationId={activity.id} question={q} />
                <form action={deleteQuestion}>
                  <input type="hidden" name="questionId" value={q.id} /><input type="hidden" name="evaluationId" value={activity.id} /><input type="hidden" name="courseId" value={courseId} />
                  <button className="inline-flex items-center gap-1.5 text-sm font-semibold text-danger hover:underline"><Trash className="h-4 w-4" aria-hidden /> Supprimer la question</button>
                </form>
              </div>
            </details>
          </li>
        ))}
      </ol>
      <details className="mt-3 rounded-xl bg-white p-3">
        <summary className="cursor-pointer text-sm font-semibold text-brand">+ Ajouter une question</summary>
        <div className="mt-3"><QuestionForm key={`new-${activity.questions.length}`} courseId={courseId} evaluationId={activity.id} /></div>
      </details>
    </section>
  );
}

function Grades({ courseId, activity, rows, scale, rounding }: { courseId: string; activity: Activity; rows: GradeRow[]; scale: number; rounding: Rounding }) {
  return (
    <section className="mt-5" aria-labelledby="notes">
      <h4 id="notes" className="mb-1 font-bold text-brand-dark">Notes des apprenants</h4>
      <p className="mb-3 text-sm text-muted">Cette activité est notée par le formateur : saisissez la note obtenue sur {scale}. L’apprenant est notifié. Note minimale : {formatGrade(activity.passing_score, scale, rounding)}.</p>
      {rows.length === 0 ? (
        <p className="text-sm text-muted">Aucun apprenant inscrit pour le moment.</p>
      ) : (
        <ul className="space-y-2">
          {rows.map((r) => (
            <li key={r.learnerId} className="rounded-xl border border-line bg-white p-3">
              <form action={saveGrade} className="flex flex-wrap items-end gap-3">
                <input type="hidden" name="evaluationId" value={activity.id} /><input type="hidden" name="courseId" value={courseId} /><input type="hidden" name="learnerId" value={r.learnerId} />
                <span className="min-w-0 flex-1 basis-40">
                  <span className="block truncate text-sm font-semibold text-brand-dark">{r.name}</span>
                  <span className="block text-xs text-muted">{r.scorePercent === null ? "Non noté" : `Noté : ${formatGrade(r.scorePercent, scale, rounding)}`}</span>
                </span>
                <label className="text-xs text-muted">Note /{scale}
                  <input name="score" inputMode="decimal" defaultValue={r.scorePercent === null ? "" : String(toScale(r.scorePercent, scale))} aria-label={`Note de ${r.name} sur ${scale}`}
                    className="mt-1 block w-24 rounded-lg border border-line bg-white px-3 py-2 text-sm text-brand-dark" />
                </label>
                <label className="min-w-0 flex-1 basis-48 text-xs text-muted">Commentaire (facultatif)
                  <input name="feedback" defaultValue={r.feedback ?? ""} maxLength={1000} aria-label={`Commentaire pour ${r.name}`}
                    className="mt-1 block w-full rounded-lg border border-line bg-white px-3 py-2 text-sm text-brand-dark" />
                </label>
                <button className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-dark">Enregistrer</button>
              </form>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/** Activités d'évaluation de l'étape 3 : tableau (pondération, note minimale, statut), puis édition de l'activité ouverte. */
export function ActivitiesPanel({ course, activities, selectedId, gradeRows, error, note }: {
  course: CourseSettings; activities: Activity[]; selectedId?: string; gradeRows: GradeRow[]; error?: string; note?: string;
}) {
  const selected = selectedId && selectedId !== "new" ? activities.find((a) => a.id === selectedId) ?? null : null;
  const creating = selectedId === "new";
  const total = totalWeight(activities);
  const warning = weightWarning(activities);
  const kinds = (course.evaluation_types.length ? course.evaluation_types : Object.keys(ACTIVITY_KINDS)) as ActivityKind[];

  return (
    <section aria-labelledby="activites" className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 id="activites" className="font-bold text-brand-dark">Activités d’évaluation</h3>
        <Link href={href(course.id, { activite: "new" })} className="inline-flex items-center gap-2 rounded-lg border border-brand px-4 py-2 text-sm font-semibold text-brand hover:bg-brand-soft">
          <Plus className="h-4 w-4" aria-hidden /> Ajouter une activité
        </Link>
      </div>
      {error && <Alert>{error}</Alert>}
      {note === "ok" && <Alert tone="success">Note enregistrée : l’apprenant est notifié.</Alert>}

      {activities.length === 0 ? (
        <EmptyState title="Aucune activité d’évaluation">Ajoutez un quiz, un devoir, une étude de cas ou une évaluation pratique.</EmptyState>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-line">
          <table className="w-full min-w-[40rem] text-left text-sm">
            <thead className="bg-surface text-xs text-muted">
              <tr>
                <th scope="col" className="px-3 py-2.5 font-semibold">#</th>
                <th scope="col" className="px-3 py-2.5 font-semibold">Titre de l’évaluation</th>
                <th scope="col" className="px-3 py-2.5 font-semibold">Type</th>
                <th scope="col" className="px-3 py-2.5 font-semibold">Pondération</th>
                <th scope="col" className="px-3 py-2.5 font-semibold">Note minimale</th>
                <th scope="col" className="px-3 py-2.5 font-semibold">Statut</th>
                <th scope="col" className="px-3 py-2.5"><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody>
              {activities.map((a, i) => (
                <tr key={a.id} className={cn("border-t border-line", a.id === selected?.id && "bg-brand-soft/40")}>
                  <td className="px-3 py-2.5 text-muted">{i + 1}</td>
                  <td className="px-3 py-2.5 font-semibold text-brand-dark">{a.title}</td>
                  <td className="px-3 py-2.5"><span className={cn("rounded-md px-2 py-1 text-xs font-semibold", KIND_STYLE[a.kind])}>{ACTIVITY_KINDS[a.kind]}</span></td>
                  <td className="px-3 py-2.5 text-brand-dark">{a.weight_percent} %</td>
                  <td className="px-3 py-2.5 text-brand-dark">{formatGrade(a.passing_score, course.grading_scale, course.grade_rounding)}</td>
                  <td className="px-3 py-2.5"><StatusSwitch activity={a} courseId={course.id} /></td>
                  <td className="px-3 py-2.5">
                    <div className="flex items-center justify-end gap-1.5">
                      <Link href={href(course.id, { activite: a.id })} aria-label={`Modifier ${a.title}`} className="rounded-lg border border-brand p-1.5 text-brand hover:bg-brand-soft"><Pencil className="h-4 w-4" aria-hidden /></Link>
                      <form action={duplicateActivity}>
                        <input type="hidden" name="evaluationId" value={a.id} /><input type="hidden" name="courseId" value={course.id} />
                        <button aria-label={`Dupliquer ${a.title}`} className="rounded-lg border border-line p-1.5 text-muted hover:border-brand hover:text-brand"><Copy className="h-4 w-4" aria-hidden /></button>
                      </form>
                      <details className="relative">
                        <summary aria-label={`Supprimer ${a.title}`} className="flex cursor-pointer list-none rounded-lg border border-danger/40 p-1.5 text-danger hover:bg-danger/5 [&::-webkit-details-marker]:hidden"><Trash className="h-4 w-4" aria-hidden /></summary>
                        <form action={deleteActivity} className="absolute right-0 z-10 mt-1 w-56 rounded-xl border border-line bg-white p-3 text-left shadow-card">
                          <p className="text-sm text-brand-dark">Supprimer « {a.title} », ses questions et ses notes ?</p>
                          <input type="hidden" name="evaluationId" value={a.id} /><input type="hidden" name="courseId" value={course.id} />
                          <button className="mt-2 w-full rounded-lg bg-danger px-3 py-1.5 text-sm font-semibold text-white hover:bg-danger/90">Confirmer la suppression</button>
                        </form>
                      </details>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t border-line bg-surface/60">
                <td className="px-3 py-2.5" />
                <th scope="row" className="px-3 py-2.5 text-left font-semibold text-brand-dark">Total des activités actives</th>
                <td />
                <td className={cn("px-3 py-2.5 font-bold", warning ? "text-warning" : "text-brand-dark")}>{total} %</td>
                <td colSpan={3} />
              </tr>
            </tfoot>
          </table>
        </div>
      )}
      {warning && <Alert tone="info">{warning}</Alert>}

      {(creating || selected) && (
        <div className="rounded-xl border border-brand/30 bg-brand-soft/30 p-4">
          <div className="mb-3 flex items-center justify-between">
            <h4 className="font-bold text-brand-dark">{selected ? `Modifier : ${selected.title}` : "Nouvelle activité"}</h4>
            <Link href={href(course.id)} aria-label="Fermer" className="rounded p-1 text-muted hover:bg-white"><X className="h-4 w-4" aria-hidden /></Link>
          </div>
          <ActivityForm key={selected?.id ?? "new"} courseId={course.id} scale={course.grading_scale} defaultAttempts={course.default_attempts} kinds={kinds} activity={selected ?? undefined} />
          {selected?.kind === "quiz" && <Questions courseId={course.id} activity={selected} />}
          {selected && selected.kind !== "quiz" && <Grades courseId={course.id} activity={selected} rows={gradeRows} scale={course.grading_scale} rounding={course.grade_rounding} />}
        </div>
      )}
    </section>
  );
}
