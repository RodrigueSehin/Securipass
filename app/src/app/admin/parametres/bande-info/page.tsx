import { Suspense } from "react";
import { ArrowDown, ArrowUp, Link2, Megaphone, Plus, Save, Trash2 } from "lucide-react";
import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { SettingsTabs } from "@/components/admin/settings-tabs";
import { Alert } from "@/components/ui/feedback";
import { ANNOUNCEMENT_LIMIT, ANNOUNCEMENT_MAX } from "@/lib/admin/announcements";
import { deleteAnnouncement, moveAnnouncement, saveAnnouncement } from "@/lib/admin/announcements-actions";
import { loadAnnouncements } from "@/lib/admin/announcements-queries";
import { cn } from "@/lib/utils";

export const metadata = { title: "Bande d’info" };

const RESULTS: Record<string, string> = { ajoute: "Le message a été ajouté.", modifie: "Le message a été modifié.", supprime: "Le message a été supprimé.", deplace: "L’ordre a été modifié." };
const card = "rounded-2xl border border-line bg-white p-5 shadow-card";
const input = "w-full rounded-lg border border-line bg-white px-3 py-2.5 text-sm text-brand-dark outline-none focus:border-brand focus:ring-2 focus:ring-brand/20";
const iconBtn = "flex h-9 w-9 items-center justify-center rounded-lg border border-line text-brand-dark hover:bg-brand-soft disabled:cursor-not-allowed disabled:opacity-40";
type SP = Promise<{ resultat?: string; erreur?: string }>;

async function Content({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const items = await loadAnnouncements();
  const full = (items?.length ?? 0) >= ANNOUNCEMENT_LIMIT;
  return (
    <div className="space-y-6">
      <SettingsTabs current="bande-info" />
      {sp.resultat && RESULTS[sp.resultat] && <Alert tone="success">{RESULTS[sp.resultat]}</Alert>}
      {sp.erreur && <Alert>{sp.erreur}</Alert>}

      <section className={card}>
        <h2 className="flex items-center gap-3 text-xl font-extrabold text-brand-dark"><Megaphone className="h-6 w-6 text-brand" aria-hidden />Bande d’information</h2>
        <p className="mb-4 mt-1 text-sm text-muted">Les messages actifs défilent en haut de la page d’accueil, dans l’ordre ci-dessous. La bande disparaît s’il n’y a aucun message actif.</p>
        <form action={saveAnnouncement} className="grid gap-3 md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_auto_auto] md:items-end">
          <div><label htmlFor="new-message" className="mb-1 block text-sm font-bold text-brand-dark">Nouveau message</label><input id="new-message" name="message" required minLength={3} maxLength={ANNOUNCEMENT_MAX} disabled={full} placeholder="Ex. : Nouvelle session SST le 5 décembre" className={input} /></div>
          <div><label htmlFor="new-link" className="mb-1 block text-sm font-bold text-brand-dark">Lien (optionnel)</label><input id="new-link" name="link" maxLength={300} disabled={full} placeholder="/formations ou https://…" className={input} /></div>
          <label className="flex items-center gap-2 pb-2.5 text-sm font-semibold text-brand-dark"><input type="checkbox" name="active" defaultChecked className="h-4 w-4 rounded border-line" />Actif</label>
          <button disabled={full} className="inline-flex items-center justify-center gap-2 rounded-lg bg-brand px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-dark disabled:cursor-not-allowed disabled:opacity-50"><Plus className="h-4 w-4" aria-hidden />Ajouter</button>
        </form>
        {full && <p className="mt-2 text-xs text-danger">Limite de {ANNOUNCEMENT_LIMIT} messages atteinte : supprimez-en un pour en ajouter.</p>}
      </section>

      <section className={card}>
        <h2 className="mb-3 text-lg font-extrabold text-brand-dark">Messages{items ? ` (${items.length})` : ""}</h2>
        {!items ? <Alert>Impossible de lire les messages pour le moment.</Alert> : items.length === 0 ? <p className="rounded-lg bg-surface px-4 py-8 text-center text-sm text-muted">Aucun message. Ajoutez-en un ci-dessus.</p> : (
          <ol className="space-y-3">
            {items.map((a, i) => (
              <li key={a.id} className={cn("rounded-xl border border-line p-3", !a.active && "bg-surface")}>
                <form action={saveAnnouncement} className="grid gap-3 md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_auto_auto] md:items-center">
                  <input type="hidden" name="id" value={a.id} />
                  <input name="message" defaultValue={a.message} required minLength={3} maxLength={ANNOUNCEMENT_MAX} aria-label={`Message ${i + 1}`} className={input} />
                  <div className="relative"><Link2 className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-brand" aria-hidden /><input name="link" defaultValue={a.link_url ?? ""} maxLength={300} placeholder="Aucun lien" aria-label={`Lien du message ${i + 1}`} className={cn(input, "pl-9")} /></div>
                  <label className="flex items-center gap-2 text-sm font-semibold text-brand-dark"><input type="checkbox" name="active" defaultChecked={a.active} className="h-4 w-4 rounded border-line" />Actif</label>
                  <button className="inline-flex items-center justify-center gap-2 rounded-lg border border-brand bg-white px-4 py-2.5 text-sm font-semibold text-brand hover:bg-brand-soft"><Save className="h-4 w-4" aria-hidden />Enregistrer</button>
                </form>
                <div className="mt-2 flex items-center justify-end gap-2">
                  <form action={moveAnnouncement}><input type="hidden" name="id" value={a.id} /><input type="hidden" name="dir" value="up" /><button disabled={i === 0} aria-label="Monter" className={iconBtn}><ArrowUp className="h-4 w-4" aria-hidden /></button></form>
                  <form action={moveAnnouncement}><input type="hidden" name="id" value={a.id} /><input type="hidden" name="dir" value="down" /><button disabled={i === items.length - 1} aria-label="Descendre" className={iconBtn}><ArrowDown className="h-4 w-4" aria-hidden /></button></form>
                  <form action={deleteAnnouncement}><input type="hidden" name="id" value={a.id} /><button aria-label="Supprimer le message" className={cn(iconBtn, "border-danger/40 text-danger hover:bg-danger/10")}><Trash2 className="h-4 w-4" aria-hidden /></button></form>
                </div>
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}

export default function AnnouncementsPage({ searchParams }: { searchParams: SP }) {
  return (
    <div className="space-y-5">
      <AdminPageHeader crumbs={[{ label: "Paramètres", href: "/admin/parametres" }, { label: "Bande d’info" }]} icon="settings" title="Bande d’info" description="Gérez les messages qui défilent en haut de la page d’accueil." />
      <Suspense fallback={<div className="h-96 animate-pulse rounded-2xl bg-white" aria-hidden />}>
        <Content searchParams={searchParams} />
      </Suspense>
    </div>
  );
}
