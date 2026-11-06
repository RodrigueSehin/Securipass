import { Suspense } from "react";
import { notFound } from "next/navigation";
import { Check } from "lucide-react";
import { ContentForm } from "@/components/contents/content-form";
import { ContentFrame } from "@/components/contents/content-frame";
import { ContentReview } from "@/components/contents/content-review";
import { publishContent } from "@/lib/contents/actions";
import { getOwnContent, listAttachments, loadContentLookups } from "@/lib/contents/queries";
import { contentToValues, parseContentStep } from "@/lib/contents/wizard";

export const metadata = { title: "Ajouter un contenu pédagogique" };

type Props = { params: Promise<{ id: string }>; searchParams: Promise<{ etape?: string; vue?: string; erreur?: string }> };

async function Wizard({ params, searchParams }: Props) {
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const content = await getOwnContent(id);
  if (!content) notFound();
  const step = parseContentStep(sp.etape);

  if (step === 4) {
    const attachments = await listAttachments(id);
    const publish = (
      <form action={publishContent}>
        <input type="hidden" name="contentId" value={id} />
        <button className="inline-flex items-center justify-center gap-2 rounded-lg bg-brand px-6 py-2.5 text-sm font-semibold text-white hover:bg-brand-dark">
          <Check className="h-4 w-4" aria-hidden /> {content.status === "published" ? "Enregistrer et republier" : "Publier le contenu"}
        </button>
      </form>
    );
    return (
      <ContentFrame contentId={id} step={4} hasForm={false} lastAction={publish}>
        <ContentReview content={content} attachments={attachments} view={sp.vue ?? ""} error={sp.erreur} />
      </ContentFrame>
    );
  }

  const [lookups, attachments] = await Promise.all([loadContentLookups(), step === 1 ? Promise.resolve([]) : listAttachments(id)]);
  return (
    <ContentFrame contentId={id} step={step}>
      <ContentForm step={step as 1 | 2 | 3} contentId={id} initialValues={contentToValues(content)} lookups={lookups}
        attachments={attachments} initialCourseId={content.module.course.id} />
    </ContentFrame>
  );
}

export default function ContentWizardPage(props: Props) {
  return (
    <Suspense fallback={<div className="h-96 animate-pulse rounded-2xl bg-white" aria-hidden />}>
      <Wizard {...props} />
    </Suspense>
  );
}
