import { AreaLayout } from "@/components/app/area-layout";
import { LEARNER_NAV } from "@/config/navigation";

export default function LearnerLayout({ children }: { children: React.ReactNode }) {
  return <AreaLayout nav={LEARNER_NAV} roleLabel="Apprenant" notifications messagesHref="/app/messages" search={{ action: "/app/catalogue" }}>{children}</AreaLayout>;
}
