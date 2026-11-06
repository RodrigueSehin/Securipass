import { AreaLayout } from "@/components/app/area-layout";
import { COMPANY_NAV } from "@/config/navigation";

export default function CompanyLayout({ children }: { children: React.ReactNode }) {
  return <AreaLayout nav={COMPANY_NAV} roleLabel="Entreprise">{children}</AreaLayout>;
}
