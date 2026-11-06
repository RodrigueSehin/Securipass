import { Suspense } from "react";
import { notFound } from "next/navigation";
import { QuestionEditor, type EditorQuestion } from "@/components/admin/question-editor";
import { createClient } from "@/lib/supabase/server";
import { AdminPageHeader } from "@/components/admin/admin-page-header";

export const metadata = { title: "Ajouter des questions" };

type Ev = { id: string; title: string; kind: string; planned_questions: number | null };
type Q = { id: string; position: number; prompt: string; kind: string; options: unknown[]; points: number };

async function Content({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ erreur?: string }> }) {
  const { id } = await params;
  const { erreur } = await searchParams;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const supabase = await createClient();
  const [ev, questions, cats] = await Promise.all([
    supabase.from("evaluations").select("id, title, kind, planned_questions").eq("id", id).maybeSingle<Ev>(),
    supabase.from("evaluation_questions").select("id, position, prompt, kind, options, points").eq("evaluation_id", id).order("position").returns<Q[]>(),
    supabase.from("categories").select("name").eq("status", "active").order("name").returns<{ name: string }[]>(),
  ]);
  if (!ev.data || ev.data.kind !== "quiz") notFound();
  const list: EditorQuestion[] = (questions.data ?? []).map((q) => ({ id: q.id, position: q.position, prompt: q.prompt, kind: q.kind, optionCount: q.options.length, points: q.points }));
  return <QuestionEditor evaluation={{ id: ev.data.id, title: ev.data.title, planned: ev.data.planned_questions }} questions={list} categories={(cats.data ?? []).map((c) => c.name)} error={erreur} />;
}

export default function QuestionsPage(props: { params: Promise<{ id: string }>; searchParams: Promise<{ erreur?: string }> }) {
  return (
    <div className="space-y-5">
      <AdminPageHeader crumbs={[{ label: "Évaluations", href: "/admin/evaluations" }, { label: "Ajouter des questions" }]} icon="evaluation" title="Ajouter des questions" description="Créez et configurez les questions de votre évaluation. Publiez-la ensuite depuis la liste." />
      <Suspense fallback={<div className="h-96 animate-pulse rounded-2xl bg-white" aria-hidden />}>
        <Content {...props} />
      </Suspense>
    </div>
  );
}
