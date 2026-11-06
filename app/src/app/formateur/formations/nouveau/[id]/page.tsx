import { Suspense } from "react";
import { notFound, redirect } from "next/navigation";
import { CourseStatusBadge } from "@/components/courses/course-status";
import { ProgrammeBuilder } from "@/components/courses/wizard/programme-builder";
import { ReviewContent } from "@/components/courses/wizard/review-content";
import { SubmitForReview } from "@/components/courses/wizard/review-step";
import { ActivitiesPanel } from "@/components/courses/wizard/activities-panel";
import { EvaluationStep } from "@/components/courses/wizard/evaluation-step";
import { SettingsAside } from "@/components/courses/wizard/settings-aside";
import { SettingsStep } from "@/components/courses/wizard/settings-step";
import { StepForm } from "@/components/courses/wizard/step-form";
import { WizardFrame } from "@/components/courses/wizard/wizard-frame";
import { getAccessCode, getFormLookups, getOwnCourse, getProgramme } from "@/lib/courses/instructor-queries";
import { listActivities, listGradeRows } from "@/lib/courses/evaluation-queries";
import { courseToValues, parseStep } from "@/lib/courses/wizard";

export const metadata = { title: "Créer une formation" };

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ etape?: string; module?: string; lecon?: string; activite?: string; erreur?: string; note?: string }>;
};

async function Wizard({ params, searchParams }: Props) {
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const course = await getOwnCourse(id);
  if (!course) notFound();
  // L'assistant ne sert qu'à construire une formation en brouillon (ou refusée) ; les autres se modifient depuis leur fiche.
  if (course.status !== "draft" && course.status !== "rejected") redirect(`/formateur/formations/${id}`);

  const step = parseStep(sp.etape);

  if (step === 2) {
    const modules = await getProgramme(id);
    return (
      <WizardFrame courseId={id} step={2} hasForm={false}>
        <ProgrammeBuilder courseId={id} modules={modules} moduleId={sp.module} lesson={sp.lecon} />
      </WizardFrame>
    );
  }

  const lookups = await getFormLookups(id);

  if (step === 3) {
    const activities = await listActivities(id);
    const open = activities.find((a) => a.id === sp.activite);
    const gradeRows = open && open.kind !== "quiz" ? await listGradeRows(id, open.id) : [];
    return (
      <WizardFrame courseId={id} step={3} hasForm>
        <EvaluationStep
          courseId={id}
          initialValues={courseToValues(course)}
          templates={lookups.certificateTemplates}
          activitiesSlot={
            <ActivitiesPanel course={course} activities={activities} selectedId={sp.activite} gradeRows={gradeRows} error={sp.erreur} note={sp.note} />
          }
        />
      </WizardFrame>
    );
  }

  if (step === 4) {
    const [modules, activities, accessCode] = await Promise.all([
      getProgramme(id), listActivities(id), course.enrollment_mode === "code" ? getAccessCode(id) : Promise.resolve(""),
    ]);
    return (
      <WizardFrame courseId={id} step={4} hasForm>
        <SettingsStep
          courseId={id}
          initialValues={courseToValues(course, accessCode)}
          otherCourses={lookups.otherCourses}
          aside={
            <SettingsAside
              course={course}
              categoryName={lookups.categories.find((c) => c.id === course.category_id)?.name ?? null}
              modules={modules.length}
              lessons={modules.reduce((n, m) => n + m.contents.length, 0)}
              activities={activities.filter((a) => a.status === "published").length}
            />
          }
        />
      </WizardFrame>
    );
  }

  if (step === 5) {
    const [modules, activities] = await Promise.all([getProgramme(id), listActivities(id)]);
    return (
      <WizardFrame courseId={id} step={5} hasForm={false} lastAction={<SubmitForReview courseId={id} />}>
        <ReviewContent
          course={course}
          modules={modules}
          activities={activities}
          parentTitle={lookups.otherCourses.find((c) => c.id === course.parent_course_id)?.title ?? null}
          prerequisiteTitle={lookups.otherCourses.find((c) => c.id === course.prerequisite_course_id)?.title ?? null}
          categoryName={lookups.categories.find((c) => c.id === course.category_id)?.name ?? null}
          templateName={lookups.certificateTemplates.find((t) => t.id === course.certificate_template_id)?.name ?? null}
        />
        {course.status === "rejected" && <span className="sr-only"><CourseStatusBadge status={course.status} /></span>}
      </WizardFrame>
    );
  }

  const accessCode = course.enrollment_mode === "code" ? await getAccessCode(id) : "";
  return (
    <WizardFrame courseId={id} step={step} hasForm>
      <StepForm step={1} courseId={id} initialValues={courseToValues(course, accessCode)} lookups={lookups} />
    </WizardFrame>
  );
}

export default function WizardPage(props: Props) {
  return (
    <Suspense fallback={<div className="h-96 animate-pulse rounded-2xl bg-white" aria-hidden />}>
      <Wizard {...props} />
    </Suspense>
  );
}
