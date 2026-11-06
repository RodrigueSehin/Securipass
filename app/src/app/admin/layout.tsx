import { AreaLayout } from "@/components/app/area-layout";
import { ADMIN_NAV } from "@/config/navigation";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <AreaLayout nav={ADMIN_NAV} roleLabel="Administration">{children}</AreaLayout>;
}
