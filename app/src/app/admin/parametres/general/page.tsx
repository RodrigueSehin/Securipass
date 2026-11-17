import { Suspense } from "react";
import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { SettingsGeneralForm } from "@/components/admin/settings-general-form";
import { SettingsTabs } from "@/components/admin/settings-tabs";
import { Alert } from "@/components/ui/feedback";
import { loadPlatformSettings } from "@/lib/admin/settings-queries";

export const metadata = { title: "Paramètres généraux" };

type SP = Promise<{ resultat?: string; erreur?: string }>;

async function Content({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const settings = await loadPlatformSettings();
  return (
    <div className="space-y-6">
      <SettingsTabs current="general" />
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
