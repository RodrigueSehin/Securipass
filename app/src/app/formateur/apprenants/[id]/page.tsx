import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Check, Circle } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { PageHeader } from "@/components/ui/feedback";
import { formatDateTime } from "@/lib/format";
import { LEARNER_STATUS } from "@/lib/learners/overview";
import { loadLearnerOverview } from "@/lib/learners/queries";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";

export const metadata = { title: "Fiche apprenant" };

const currentTime = () => Date.now();

async function Detail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const data = await loadLearnerOverview(currentTime());
  const row = data.rows.find((r) => r.id === id);
  if (!row) notFound();

  const supabase = await createClient();
  const [contents, done] = await Promise.all([
    supabase.from("learning_contents").select("id, title, position, module:course_modules!inner(title, position, course_id)").eq("status", "published").eq("module.course_id", row.courseId)
      .returns<{ id: string; title: string; position: number; module: { title: string; position: number } }[]>(),
    supabase.from("content_completions").select("content_id, completed_at").eq("learner_id", row.learnerId).returns<{ content_id: string; completed_at: string }[]>(),
  ]);
  const doneAt = new Map((done.data ?? []).map((d) => [d.content_id, d.completed_at]));
  const list = [...(contents.data ?? [])].sort((a, b) => a.module.position - b.module.position || a.position - b.position);
  const st = LEARNER_STATUS[row.status];

  return (
    <div className="max-w-3xl space-y-6">
      <section className="flex flex-wrap items-center gap-4 rounded-2xl border border-line bg-white p-5 shadow-card">
        <Avatar name={row.name} src={row.avatar} size={64} />
        <div className="min-w-0 flex-1">
          <h2 className="text-xl font-extrabold text-brand-dark">{row.name}</h2>
          <a href={`mailto:${row.email}`} className="text-sm text-brand hover:underline">{row.email}</a>
        </div>
        <span className={cn("rounded-md px-2.5 py-1 text-xs font-semibold", st.tone)}>{st.label}</span>
      </section>
      <section className="rounded-2xl border border-line bg-white p-5 shadow-card">
        <dl className="grid gap-3 text-sm sm:grid-cols-2">
          <div><dt className="text-muted">Formation</dt><dd className="font-semibold text-brand-dark">{row.course}</dd></div>
          <div><dt className="text-muted">Session</dt><dd className="font-semibold text-brand-dark">{row.sessionTitle ?? "Sans session"}</dd></div>
          <div><dt className="text-muted">Inscrit le</dt><dd className="text-brand-dark">{formatDateTime(row.enrolledAt)}</dd></div>
          <div><dt className="text-muted">Dernière activité</dt><dd className="text-brand-dark">{row.lastActivity ? formatDateTime(row.lastActivity) : "Aucune"}</dd></div>
          <div className="sm:col-span-2">
            <dt className="text-muted">Progression</dt>
            <dd className="mt-1 flex items-center gap-3">
              <span className="h-2 flex-1 overflow-hidden rounded-full bg-surface"><span className="block h-full rounded-full bg-brand" style={{ width: `${row.percent}%` }} /></span>
              <span className="font-semibold text-brand-dark">{row.percent}%</span>
            </dd>
          </div>
        </dl>
      </section>
      <section className="rounded-2xl border border-line bg-white p-5 shadow-card">
        <h3 className="mb-3 text-lg font-bold text-brand-dark">Contenus</h3>
        {list.length === 0 ? <p className="text-sm text-muted">Aucun contenu publié.</p> : (
          <ul className="divide-y divide-line">
            {list.map((c) => (
              <li key={c.id} className="flex items-center gap-3 py-2 text-sm">
                {doneAt.has(c.id) ? <Check className="h-4 w-4 text-success" aria-label="Terminé" /> : <Circle className="h-4 w-4 text-muted" aria-label="Non terminé" />}
                <span className="flex-1 text-brand-dark">Module {c.module.position} · {c.title}</span>
                {doneAt.has(c.id) && <span className="text-xs text-muted">{formatDateTime(doneAt.get(c.id)!)}</span>}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

export default function LearnerPage(props: { params: Promise<{ id: string }> }) {
  return (
    <>
      <PageHeader title="Fiche apprenant" />
      <Link href="/formateur/apprenants" className="-mt-3 mb-4 inline-block text-sm text-brand hover:underline">← Mes apprenants</Link>
      <Suspense fallback={<div className="h-64 max-w-3xl animate-pulse rounded-2xl bg-white" aria-hidden />}>
        <Detail params={props.params} />
      </Suspense>
    </>
  );
}
