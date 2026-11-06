import { CreateCompanyForm } from "@/components/admin/create-company-form";
import { AdminPageHeader } from "@/components/admin/admin-page-header";

export const metadata = { title: "Ajouter une entreprise" };

export default function NewCompanyPage() {
  return (
    <div className="space-y-5">
      <AdminPageHeader crumbs={[{ label: "Entreprises", href: "/admin/entreprises" }, { label: "Ajouter une entreprise" }]} icon="building" title="Ajouter une entreprise" description="Enregistrez une nouvelle entreprise cliente, partenaire ou employeur." />
      <CreateCompanyForm />
    </div>
  );
}
