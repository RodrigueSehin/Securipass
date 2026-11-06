import { Suspense } from "react";
import { redirect } from "next/navigation";
import { Download, ExternalLink } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { EmptyState, PageHeader } from "@/components/ui/feedback";
import { CONTENT_TYPES } from "@/lib/courses/labels";
import { activeCourses, loadLearnerState } from "@/lib/learner/queries";

export const metadata = { title: "Supports" };

async function List() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/connexion?redirect=/app/supports");

  const state = await loadLearnerState(supabase, user.id);
  const courses = activeCourses(state);
  const groups = courses
    .map(({ course }) => ({
      course,
      items: state.contents
        .filter((c) => c.course_id === course.id && (c.file_path || c.external_url))
        .sort((a, b) => a.module_position - b.module_position || a.position - b.position),
    }))
    .filter((g) => g.items.length > 0);

  if (groups.length === 0) {
    return <EmptyState title="Aucun support pour le moment">Les documents et liens de vos formations apparaîtront ici.</EmptyState>;
  }

  return (
    <div className="space-y-6">
      {groups.map((g) => (
        <section key={g.course.id} className="rounded-2xl border border-line bg-white p-5">
          <h2 className="font-bold text-brand-dark">{g.course.title}</h2>
          <ul className="mt-3 divide-y divide-line">
            {g.items.map((c) => (
              <li key={c.id} className="flex items-center justify-between gap-3 py-3">
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium text-brand-dark">{c.title}</span>
                  <span className="text-xs text-muted">{CONTENT_TYPES[c.content_type]}</span>
                </span>
                {c.file_path ? (
                  <a href={`/app/contenus/${c.id}`} className="inline-flex shrink-0 items-center gap-1.5 text-sm font-semibold text-brand hover:underline">
                    <Download className="h-4 w-4" aria-hidden />Télécharger
                  </a>
                ) : (
                  <a href={c.external_url!} target="_blank" rel="noopener noreferrer" className="inline-flex shrink-0 items-center gap-1.5 text-sm font-semibold text-brand hover:underline">
                    <ExternalLink className="h-4 w-4" aria-hidden />Ouvrir
                  </a>
                )}
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

export default function SupportsPage() {
  return (
    <>
      <PageHeader title="Supports" description="Documents téléchargeables et liens de vos formations." />
      <Suspense fallback={<div className="h-48 animate-pulse rounded-2xl bg-white" aria-hidden />}>
        <List />
      </Suspense>
    </>
  );
}
