import { Suspense } from "react";
import { notFound } from "next/navigation";
import { TabNav } from "@/components/ui/tabs";
import { ButtonLink } from "@/components/ui/button";
import { CourseStatusBadge } from "@/components/courses/course-status";
import { getOwnCourse } from "@/lib/courses/instructor-queries";

async function Header({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const course = await getOwnCourse(id);
  if (!course) notFound();
  const base = `/formateur/formations/${id}`;
  return (
    <>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-extrabold text-brand-dark">{course.title}</h1>
        <CourseStatusBadge status={course.status} />
        {(course.status === "draft" || course.status === "rejected") && (
          <ButtonLink href={`/formateur/formations/nouveau/${id}?etape=1`} variant="outline" className="ml-auto">Ouvrir l’assistant de création</ButtonLink>
        )}
      </div>
      <TabNav label="Sections de la formation" tabs={[
        { href: base, label: "Informations", exact: true },
        { href: `${base}/programme`, label: "Programme" },
        { href: `${base}/sessions`, label: "Sessions" },
        { href: `/app/forum/${id}`, label: "Forum" },
      ]} />
    </>
  );
}

export default function CourseLayout({ children, params }: { children: React.ReactNode; params: Promise<{ id: string }> }) {
  return (
    <>
      <Suspense fallback={<div className="mb-6 h-20 animate-pulse rounded-2xl bg-white" aria-hidden />}>
        <Header params={params} />
      </Suspense>
      {children}
    </>
  );
}
