import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { CheckCircle2, Circle, Download, ExternalLink, FileText } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { ButtonLink } from "@/components/ui/button";
import { Alert, EmptyState, PageHeader, StatusBadge } from "@/components/ui/feedback";
import { formatBytes, formatDate, formatTimeRange } from "@/lib/format";
import { formatDuration, cn } from "@/lib/utils";
import { CONTENT_TYPES } from "@/lib/courses/labels";
import { activeCourses, loadLearnerState } from "@/lib/learner/queries";
import { nextContentId } from "@/lib/learner/progress";
import { ATTENDANCE_STATUS, PROGRESS_LABEL, evaluationStatus, learnerErrorMessage } from "@/lib/learner/messages";
import { toggleContentCompleted } from "@/lib/learner/actions";
import { ReviewForm } from "@/components/learner/review-form";

export const metadata = { title: "Ma formation" };

const uuid = /^[0-9a-f-]{36}$/i;

async function Course({ id, erreur }: { id: string; erreur?: string }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`/connexion?redirect=/app/formations/${id}`);

  const state = await loadLearnerState(supabase, user.id);
  const entry = activeCourses(state).find((c) => c.course.id === id);
  if (!entry) {
    return (
      <EmptyState title="Formation introuvable dans vos inscriptions">
        Seules les formations auxquelles vous êtes inscrit sont accessibles.
        <div className="mt-4"><ButtonLink href="/app/formations" variant="outline">Retour à mes formations</ButtonLink></div>
      </EmptyState>
    );
  }

  const { course, progress, status, enrollment } = entry;
  const st = PROGRESS_LABEL[status];
  const contents = state.contents.filter((c) => c.course_id === id);
  const resumeId = nextContentId(contents, state.doneIds, id);

  type Resource = { id: string; name: string; size_bytes: number };
  const modules = new Map<string, { title: string; position: number; items: typeof contents; resources: Resource[] }>();
  for (const c of [...contents].sort((a, b) => a.module_position - b.module_position || a.position - b.position)) {
    const key = `${c.module_position}-${c.module?.title ?? ""}`;
    const m = modules.get(key) ?? { title: c.module?.title ?? "Module", position: c.module_position, items: [], resources: [] };
    m.items.push(c);
    modules.set(key, m);
  }
  // Ressources téléchargeables des modules (la RLS limite la lecture aux inscrits, au formateur et au personnel)
  const { data: resourceRows } = await supabase
    .from("module_resources")
    .select("id, name, size_bytes, module:course_modules(course_id, position, title)")
    .returns<{ id: string; name: string; size_bytes: number; module: { course_id: string; position: number; title: string } | null }[]>();
  for (const r of resourceRows ?? []) {
    if (r.module?.course_id !== id) continue;
    const key = `${r.module.position}-${r.module.title}`;
    const m = modules.get(key) ?? { title: r.module.title, position: r.module.position, items: [], resources: [] };
    m.resources.push({ id: r.id, name: r.name, size_bytes: r.size_bytes });
    modules.set(key, m);
  }

  const attendance = state.attendance.filter((a) => a.session?.course_id === id);
  const evaluations = state.evaluations.filter((e) => e.course_id === id);
  const { data: myReview } = status === "completed"
    ? await supabase.from("course_reviews").select("rating, comment").eq("course_id", id).eq("learner_id", user.id).maybeSingle<{ rating: number; comment: string | null }>()
    : { data: null };

  return (
    <>
      <PageHeader
        title={course.title}
        description={course.show_progress === false ? `${formatDuration(progress.totalMinutes)} de contenu` : `${progress.done} / ${progress.total} leçons terminées · ${progress.percent} % · ${formatDuration(progress.totalMinutes)} de contenu`}
        actions={
          resumeId ? <ButtonLink href={`#lecon-${resumeId}`} variant="cta">{status === "not_started" ? "Commencer" : "Reprendre"}</ButtonLink>
            : <StatusBadge tone={st.tone}>{st.label}</StatusBadge>
        }
      />

      {erreur && <div className="mb-4"><Alert>{learnerErrorMessage(erreur)}</Alert></div>}

      {course.show_progress !== false && (
        <div className="mb-6 h-2 w-full overflow-hidden rounded-full bg-surface" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress.percent} aria-label="Progression">
          <div className="h-full rounded-full bg-brand" style={{ width: `${progress.percent}%` }} />
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-3">
        <section className="space-y-4 xl:col-span-2" aria-labelledby="programme">
          <h2 id="programme" className="text-lg font-bold text-brand-dark">Programme</h2>
          {modules.size === 0 ? (
            <EmptyState title="Le contenu de cette formation sera bientôt disponible" />
          ) : (
            [...modules.values()].sort((a, b) => a.position - b.position).map((m) => (
              <div key={`${m.position}-${m.title}`} className="rounded-2xl border border-line bg-white">
                <h3 className="border-b border-line px-5 py-3 font-semibold text-brand-dark">{m.title}</h3>
                <ul className="divide-y divide-line">
                  {m.items.map((c) => {
                    const done = state.doneIds.has(c.id);
                    return (
                      <li key={c.id} id={`lecon-${c.id}`} className="scroll-mt-24 px-5 py-4">
                        <div className="flex items-start gap-3">
                          <form action={toggleContentCompleted}>
                            <input type="hidden" name="contentId" value={c.id} />
                            <input type="hidden" name="done" value={done ? "0" : "1"} />
                            <input type="hidden" name="returnTo" value={`/app/formations/${id}`} />
                            <button
                              type="submit"
                              aria-pressed={done}
                              aria-label={done ? `Marquer « ${c.title} » comme non terminée` : `Marquer « ${c.title} » comme terminée`}
                              className={cn("mt-0.5 shrink-0", done ? "text-success" : "text-muted hover:text-brand")}
                            >
                              {done ? <CheckCircle2 className="h-5 w-5" aria-hidden /> : <Circle className="h-5 w-5" aria-hidden />}
                            </button>
                          </form>
                          <div className="min-w-0 flex-1">
                            <p className={cn("font-medium", done ? "text-muted line-through" : "text-brand-dark")}>{c.title}</p>
                            <p className="text-xs text-muted">{CONTENT_TYPES[c.content_type]} · {formatDuration(c.duration_minutes)}</p>
                            {c.description && <p className="mt-1 text-sm text-muted">{c.description}</p>}
                            <div className="mt-2 flex flex-wrap gap-3 text-sm">
                              {c.file_path && (
                                <a href={`/app/contenus/${c.id}`} className="inline-flex items-center gap-1.5 font-semibold text-brand hover:underline">
                                  <Download className="h-4 w-4" aria-hidden />{c.content_type === "video" ? "Voir la vidéo" : c.allow_download === false ? "Consulter le document" : "Ouvrir le document"}
                                </a>
                              )}
                              {c.content_type === "quiz" && c.evaluation_id && (
                                <a href={`/app/evaluations/${c.evaluation_id}`} className="inline-flex items-center gap-1.5 font-semibold text-brand hover:underline">
                                  <ExternalLink className="h-4 w-4" aria-hidden />Passer le quiz
                                </a>
                              )}
                              {c.allow_comments && course.forum_enabled && (
                                <a href={`/app/forum/${id}`} className="inline-flex items-center gap-1.5 font-semibold text-brand hover:underline">
                                  <FileText className="h-4 w-4" aria-hidden />Discuter
                                </a>
                              )}
                              {c.external_url && (
                                <a href={c.external_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 font-semibold text-brand hover:underline">
                                  <ExternalLink className="h-4 w-4" aria-hidden />Ouvrir le lien
                                </a>
                              )}
                            </div>
                            {c.body && (
                              <details className="mt-2">
                                <summary className="inline-flex cursor-pointer items-center gap-1.5 text-sm font-semibold text-brand">
                                  <FileText className="h-4 w-4" aria-hidden />Lire le contenu
                                </summary>
                                <div className="mt-2 whitespace-pre-line text-sm text-brand-dark">{c.body}</div>
                              </details>
                            )}
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ul>
                {m.resources.length > 0 && course.allow_downloads !== false && (
                  <div className="border-t border-line bg-surface/50 px-5 py-3">
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">Ressources du module</p>
                    <ul className="space-y-1.5">
                      {m.resources.map((r) => (
                        <li key={r.id}>
                          <a href={`/app/ressources/${r.id}`} className="inline-flex items-center gap-2 text-sm font-semibold text-brand hover:underline">
                            <Download className="h-4 w-4" aria-hidden />{r.name}
                            <span className="font-normal text-muted">({formatBytes(r.size_bytes)})</span>
                          </a>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            ))
          )}
        </section>

        <aside className="space-y-6">
          <section className="rounded-2xl border border-line bg-white p-5" aria-labelledby="session">
            <h2 id="session" className="font-bold text-brand-dark">Ma session</h2>
            {enrollment.session ? (
              <>
                <p className="mt-2 font-semibold text-brand-dark">{enrollment.session.title}</p>
                <p className="text-sm text-muted">{formatTimeRange(enrollment.session.start_at, enrollment.session.end_at, enrollment.session.timezone)}</p>
                {enrollment.session.location && <p className="text-sm text-muted">{enrollment.session.location}</p>}
              </>
            ) : (
              <p className="mt-2 text-sm text-muted">Formation en accès libre : aucune session planifiée.</p>
            )}
          </section>

          <section className="rounded-2xl border border-line bg-white p-5" aria-labelledby="presences">
            <h2 id="presences" className="font-bold text-brand-dark">Mes présences</h2>
            {attendance.length === 0 ? (
              <p className="mt-2 text-sm text-muted">Aucune présence enregistrée pour cette formation.</p>
            ) : (
              <ul className="mt-3 space-y-2 text-sm">
                {attendance.map((a) => {
                  const label = ATTENDANCE_STATUS[a.status];
                  return (
                    <li key={a.session_id} className="flex items-center justify-between gap-2">
                      <span className="min-w-0 truncate text-brand-dark">{a.session?.title} <span className="text-xs text-muted">· {formatDate(a.session!.start_at, a.session!.timezone)}</span></span>
                      <StatusBadge tone={label.tone}>{label.label}</StatusBadge>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          <section className="rounded-2xl border border-line bg-white p-5" aria-labelledby="evaluations">
            <h2 id="evaluations" className="font-bold text-brand-dark">Évaluations</h2>
            {evaluations.length === 0 ? (
              <p className="mt-2 text-sm text-muted">Aucune évaluation publiée pour cette formation.</p>
            ) : (
              <ul className="mt-3 space-y-2 text-sm">
                {evaluations.map((e) => (
                  <li key={e.id}>
                    <Link href={`/app/evaluations/${e.id}`} className="font-semibold text-brand hover:underline">{e.title}</Link>
                    <span className="block text-xs text-muted">{evaluationStatus(state.attempts.filter((a) => a.evaluation_id === e.id)).label}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
          {course.forum_enabled !== false && (
            <section className="rounded-2xl border border-line bg-white p-5" aria-labelledby="forum">
              <h2 id="forum" className="font-bold text-brand-dark">Forum de questions</h2>
              <p className="mt-1 text-sm text-muted">Posez vos questions au formateur{" "}et consultez les réponses.</p>
              <Link href={`/app/forum/${id}`} className="mt-3 inline-block text-sm font-semibold text-brand hover:underline">Ouvrir le forum →</Link>
            </section>
          )}

          {status === "completed" && (
            <section className="rounded-2xl border border-line bg-white p-5" aria-labelledby="avis">
              <h2 id="avis" className="font-bold text-brand-dark">Votre avis</h2>
              <p className="mt-1 text-sm text-muted">Vous avez terminé cette formation : partagez votre expérience avec les futurs apprenants.</p>
              <ReviewForm courseId={id} rating={myReview?.rating} comment={myReview?.comment} />
            </section>
          )}
        </aside>
      </div>
    </>
  );
}

export default async function CoursePage({ params, searchParams }: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ erreur?: string }>;
}) {
  return (
    <Suspense fallback={<div className="h-96 animate-pulse rounded-2xl bg-white" aria-hidden />}>
      <Resolved params={params} searchParams={searchParams} />
    </Suspense>
  );
}

async function Resolved({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ erreur?: string }> }) {
  const [{ id }, { erreur }] = await Promise.all([params, searchParams]);
  if (!uuid.test(id)) redirect("/app/formations");
  return <Course id={id} erreur={erreur} />;
}
