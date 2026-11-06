import { Suspense } from "react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { MessageCircleQuestion, Trash } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { AskForm, ReplyForm } from "@/components/forum/forum-forms";
import { EmptyState, PageHeader, StatusBadge } from "@/components/ui/feedback";
import { deleteForumItem } from "@/lib/forum/actions";
import { loadForum, type ForumData } from "@/lib/forum/queries";
import { formatDateTime } from "@/lib/format";

export const metadata = { title: "Forum de la formation" };

function Delete({ courseId, kind, id, label }: { courseId: string; kind: "thread" | "post"; id: string; label: string }) {
  return (
    <form action={deleteForumItem}>
      <input type="hidden" name="courseId" value={courseId} /><input type="hidden" name="kind" value={kind} /><input type="hidden" name="id" value={id} />
      <button aria-label={label} title={label} className="rounded p-1.5 text-danger hover:bg-danger/10"><Trash className="h-4 w-4" aria-hidden /></button>
    </form>
  );
}

function Threads({ data }: { data: ForumData }) {
  const { course, threads, authors, moderator, userId } = data;
  const name = (id: string) => authors.get(id)?.name ?? "Participant";
  const isTrainer = (id: string) => authors.get(id)?.instructor ?? false;
  const owner = course.instructor_id === userId;

  if (threads.length === 0) return <EmptyState title="Aucune question pour le moment">Soyez le premier à poser une question sur cette formation.</EmptyState>;
  return (
    <ul className="space-y-3">
      {threads.map((t) => {
        const canReply = owner || moderator || course.allow_discussions || t.author_id === userId;
        return (
          <li key={t.id} className="rounded-2xl border border-line bg-white">
            <details>
              <summary className="flex cursor-pointer list-none items-start gap-3 p-4 [&::-webkit-details-marker]:hidden">
                <MessageCircleQuestion className="mt-0.5 h-5 w-5 shrink-0 text-brand" aria-hidden />
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold text-brand-dark">{t.title}</span>
                  <span className="block text-xs text-muted">{name(t.author_id)} · {formatDateTime(t.created_at)}</span>
                </span>
                <StatusBadge tone={t.posts.length > 1 ? "success" : "neutral"}>{t.posts.length > 1 ? `${t.posts.length - 1} réponse${t.posts.length > 2 ? "s" : ""}` : "Sans réponse"}</StatusBadge>
              </summary>
              <div className="space-y-4 border-t border-line p-4">
                <ol className="space-y-3">
                  {t.posts.map((p) => (
                    <li key={p.id} className="flex gap-3">
                      <div className="min-w-0 flex-1 rounded-xl bg-surface p-3">
                        <p className="mb-1 flex flex-wrap items-center gap-2 text-xs text-muted">
                          <span className="font-semibold text-brand-dark">{name(p.author_id)}</span>
                          {isTrainer(p.author_id) && <StatusBadge tone="info">Formateur</StatusBadge>}
                          <span>{formatDateTime(p.created_at)}</span>
                        </p>
                        <p className="whitespace-pre-line text-sm text-brand-dark">{p.body}</p>
                      </div>
                      {moderator && p.id !== t.posts[0]?.id && <Delete courseId={course.id} kind="post" id={p.id} label="Supprimer la réponse" />}
                    </li>
                  ))}
                </ol>
                {canReply
                  ? <ReplyForm courseId={course.id} threadId={t.id} />
                  : <p className="text-sm text-muted">Les discussions entre apprenants sont désactivées : seul le formateur répond aux questions des autres participants.</p>}
                {moderator && (
                  <div className="flex items-center gap-2 border-t border-line pt-3 text-xs text-muted">
                    <Delete courseId={course.id} kind="thread" id={t.id} label="Supprimer la question et ses réponses" /> Supprimer la question et ses réponses
                  </div>
                )}
              </div>
            </details>
          </li>
        );
      })}
    </ul>
  );
}

async function Forum({ params }: { params: Promise<{ courseId: string }> }) {
  const { courseId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`/connexion?redirect=/app/forum/${courseId}`);
  const data = await loadForum(courseId);
  if (!data) notFound();
  const { course, userId } = data;
  const owner = course.instructor_id === userId;
  const back = owner ? `/formateur/formations/${course.id}` : `/app/formations/${course.id}`;

  if (!course.forum_enabled && !owner && !data.moderator) {
    return (
      <EmptyState title="Le forum de cette formation est désactivé">
        <Link href={back} className="font-semibold text-brand hover:underline">Retour à la formation</Link>
      </EmptyState>
    );
  }

  return (
    <>
      <PageHeader title="Forum de questions" description={`${course.title} · posez vos questions au formateur${course.allow_discussions ? " et échangez avec les autres participants" : ""}.`}
        actions={<Link href={back} className="text-sm font-semibold text-brand hover:underline">← Retour à la formation</Link>} />
      {!course.forum_enabled && <p className="mb-4 rounded-lg bg-warning/15 p-3 text-sm text-brand-dark">Le forum est désactivé pour les apprenants (réglage de l’étape 4).</p>}
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <section aria-label="Questions"><Threads data={data} /></section>
        {course.forum_enabled && (
          <aside className="self-start rounded-2xl border border-line bg-white p-5 shadow-card">
            <h2 className="mb-3 font-bold text-brand-dark">Poser une question</h2>
            <AskForm courseId={course.id} />
          </aside>
        )}
      </div>
    </>
  );
}

export default function ForumPage({ params }: { params: Promise<{ courseId: string }> }) {
  return (
    <Suspense fallback={<div className="h-96 animate-pulse rounded-2xl bg-white" aria-hidden />}>
      <Forum params={params} />
    </Suspense>
  );
}
