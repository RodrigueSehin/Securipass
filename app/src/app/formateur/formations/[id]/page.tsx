import { Suspense } from "react";
import { notFound } from "next/navigation";
import { CourseForm } from "@/components/courses/course-form";
import { StatusPanel } from "@/components/courses/status-panel";
import { Alert } from "@/components/ui/feedback";
import { getFormLookups, getOwnCourse } from "@/lib/courses/instructor-queries";

export const metadata = { title: "Modifier la formation" };

type Props = { params: Promise<{ id: string }>; searchParams: Promise<{ resultat?: string }> };

async function EditCourse({ params, searchParams }: Props) {
  const [{ id }, { resultat }] = await Promise.all([params, searchParams]);
  const course = await getOwnCourse(id);
  if (!course) notFound();
  const { categories, otherCourses } = await getFormLookups(id);
  return (
    <div className="max-w-4xl">
      {resultat === "copie" && <div className="mb-4"><Alert tone="success">Copie créée en brouillon. Adaptez le titre et les informations.</Alert></div>}
      <StatusPanel courseId={course.id} status={course.status} rejectionReason={course.rejection_reason} slug={course.slug} />
      <CourseForm defaults={course} categories={categories} otherCourses={otherCourses} />
    </div>
  );
}

export default function EditCoursePage(props: Props) {
  return (
    <Suspense fallback={<div className="h-96 max-w-4xl animate-pulse rounded-2xl bg-white" aria-hidden />}>
      <EditCourse {...props} />
    </Suspense>
  );
}
