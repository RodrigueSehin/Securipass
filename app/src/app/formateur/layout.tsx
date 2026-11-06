import { AreaLayout } from "@/components/app/area-layout";
import { INSTRUCTOR_NAV } from "@/config/navigation";

export default function InstructorLayout({ children }: { children: React.ReactNode }) {
  return <AreaLayout nav={INSTRUCTOR_NAV} roleLabel="Formateur" notifications>{children}</AreaLayout>;
}
