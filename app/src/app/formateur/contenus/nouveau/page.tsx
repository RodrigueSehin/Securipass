import { Suspense } from "react";
import { ContentForm } from "@/components/contents/content-form";
import { ContentFrame } from "@/components/contents/content-frame";
import { loadContentLookups } from "@/lib/contents/queries";
import { contentToValues } from "@/lib/contents/wizard";

export const metadata = { title: "Ajouter un contenu pédagogique" };

type SP = Promise<{ module?: string }>;

async function FirstStep({ searchParams }: { searchParams: SP }) {
  const [{ module }, lookups] = await Promise.all([searchParams, loadContentLookups()]);
  const preset = lookups.modules.find((m) => m.id === module);
  const values = { ...contentToValues({ module_id: preset?.id }), durationMinutes: "" };
  return (
    <ContentFrame step={1}>
      <ContentForm step={1} initialValues={values} lookups={lookups} initialCourseId={preset?.courseId} />
    </ContentFrame>
  );
}

export default function NewContentPage({ searchParams }: { searchParams: SP }) {
  return (
    <Suspense fallback={<div className="h-96 animate-pulse rounded-2xl bg-white" aria-hidden />}>
      <FirstStep searchParams={searchParams} />
    </Suspense>
  );
}
