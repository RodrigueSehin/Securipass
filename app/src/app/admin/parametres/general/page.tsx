import { Suspense } from "react";
import { ClipboardList, LayoutGrid, MapPin, Palette, Settings } from "lucide-react";
import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { SettingsGeneralForm } from "@/components/admin/settings-general-form";
import { Alert } from "@/components/ui/feedback";
import { loadPlatformSettings } from "@/lib/admin/settings-queries";
import { cn } from "@/lib/utils";

export const metadata = { title: "Paramètres généraux" };

const TABS = [[Palette, "Identité visuelle"], [MapPin, "Localisation"], [LayoutGrid, "Fonctionnalités"], [ClipboardList, "Informations légales"]] as const;
type SP = Promise<{ resultat?: string; erreur?: string }>;

async function Content({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const settings = await loadPlatformSettings();
  return (
    <div className="space-y-6">
      <nav aria-label="Sections des paramètres généraux" className="flex flex-wrap gap-1 rounded-2xl border border-line bg-white p-2 shadow-card">
        <span aria-current="page" className="inline-flex items-center gap-2 rounded-lg bg-brand px-5 py-2.5 text-sm font-semibold text-white"><Settings className="h-4 w-4" aria-hidden />Général</span>
        {TABS.map(([Icon, text]) => (
          <span key={text} title="Bientôt disponible" className={cn("inline-flex cursor-not-allowed items-center gap-2 rounded-lg px-5 py-2.5 text-sm font-semibold text-brand-dark opacity-50")}><Icon className="h-4 w-4" aria-hidden />{text}</span>
        ))}
      </nav>
      {sp.resultat === "enregistre" && <Alert tone="success">Les paramètres ont été enregistrés.</Alert>}
      {sp.erreur && <Alert>{sp.erreur}</Alert>}
      {settings ? <SettingsGeneralForm settings={settings} /> : <Alert>Impossible de lire les paramètres de la plateforme pour le moment.</Alert>}
    </div>
  );
}

export default function GeneralSettingsPage({ searchParams }: { searchParams: SP }) {
  return (
    <div className="space-y-5">
      <AdminPageHeader crumbs={[{ label: "Paramètres", href: "/admin/parametres" }, { label: "Général" }]} icon="settings" title="Paramètres généraux" description="Configurez les informations de base et l’identité de la plateforme SECURIPASS." />
      <Suspense fallback={<div className="h-96 animate-pulse rounded-2xl bg-white" aria-hidden />}>
        <Content searchParams={searchParams} />
      </Suspense>
    </div>
  );
}
