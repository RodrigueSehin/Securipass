import { StatusBadge } from "@/components/ui/feedback";
import { COURSE_STATUS, type CourseStatus } from "@/lib/courses/labels";

export function CourseStatusBadge({ status }: { status: CourseStatus }) {
  const s = COURSE_STATUS[status];
  return <StatusBadge tone={s.tone}>{s.label}</StatusBadge>;
}
