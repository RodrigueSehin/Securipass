import { Suspense } from "react";
import Link from "next/link";
import { Blocks, ChevronRight, CreditCard, Database, GraduationCap, Mail, Bell, Settings, ShieldCheck, Users, type LucideIcon } from "lucide-react";
import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { SettingsBranding } from "@/components/admin/settings-branding";
import { SettingsOverview } from "@/components/admin/settings-overview";
import { Alert } from "@/components/ui/feedback";
import { SETTINGS_SECTIONS } from "@/lib/admin/settings";
import { loadPlatformSettings } from "@/lib/admin/settings-queries";
import { cn } from "@/lib/utils";

export const metadata = { title: "Paramètres" };

const ICONS: Record<string, LucideIcon> = { general: Settings, users: Users, courses: GraduationCap, payments: CreditCard, notifications: Bell, emails: Mail, integrations: Blocks, security: ShieldCheck, data: Database };
const card = "rounded-2xl border border-line bg-white p-5 shadow-card";
type SP = Promise<{ resultat?: string; erreur?: string }>;

async function Content({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const settings = await loadPlatformSettings();
  return (
    <div className="space-y-6">
      {sp.resultat === "enregistre" && <Alert tone="success">Les paramètres ont été enregistrés.</Alert>}
      {sp.erreur && <Alert>{sp.erreur}</Alert>}

      <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {SETTINGS_SECTIONS.map((s) => {
          const Icon = ICONS[s.key] ?? Settings;
          const body = (
            <>
              <span className={cn("flex h-14 w-14 shrink-0 items-center justify-center rounded-xl text-white", s.tone)} aria-hidden><Icon className="h-7 w-7" /></span>
              <div className="min-w-0 flex-1"><h2 className="text-lg font-extrabold text-brand-dark">{s.title}</h2><p className="text-sm text-brand-dark">{s.text}</p>{!s.href && <p className="mt-1 text-xs font-semibold text-muted">Bientôt disponible</p>}</div>
              <ChevronRight className="h-5 w-5 shrink-0 text-brand" aria-hidden />
            </>
          );
          return (
            <li key={s.key} title={s.href ? undefined : "Bientôt disponible"}>
              {s.href ? <Link href={s.href} className={cn(card, "flex items-center gap-4 hover:border-brand")}>{body}</Link> : <div className={cn(card, "flex items-center gap-4 opacity-90")}>{body}</div>}
            </li>
          );
        })}
      </ul>

      {!settings ? <Alert>Impossible de lire les paramètres de la plateforme pour le moment.</Alert> : (
        <div className="grid items-start gap-6 xl:grid-cols-2">
          <section className={card}>
            <h2 className="mb-2 flex items-center gap-2 text-xl font-extrabold text-brand-dark"><Settings className="h-6 w-6 text-brand" aria-hidden />Aperçu de la configuration</h2>
            <SettingsOverview settings={settings} />
          </section>
          <section className={card}><SettingsBranding settings={settings} /></section>
        </div>
      )}
    </div>
  );
}

export default function SettingsPage({ searchParams }: { searchParams: SP }) {
  return (
    <div className="space-y-5">
      <AdminPageHeader crumbs={[{ label: "Paramètres" }]} icon="settings" title="Paramètres" description="Configurez et personnalisez la plateforme SECURIPASS selon les besoins de votre organisation." />
      <Suspense fallback={<div className="h-96 animate-pulse rounded-2xl bg-white" aria-hidden />}>
        <Content searchParams={searchParams} />
      </Suspense>
    </div>
  );
}
