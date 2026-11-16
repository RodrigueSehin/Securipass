import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft, BookOpen, Check, Copy, Download, FileText, History, Image as ImageIcon, Info, Lock, Mail, MessageSquare, MoreHorizontal, Paperclip, Phone, RotateCcw, Trash2, User, UserCog, Zap,
} from "lucide-react";
import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { AttachFileButton } from "@/components/admin/support-attachments";
import { SupportFilesTab } from "@/components/admin/support-files-tab";
import { SupportHistory } from "@/components/admin/support-history";
import { SupportNotes } from "@/components/admin/support-notes";
import { SupportReplyForm } from "@/components/admin/support-reply-form";
import { TicketFields } from "@/components/admin/support-ticket-fields";
import { CategoryTag } from "@/components/admin/support-widgets";
import { Avatar } from "@/components/ui/avatar";
import { Alert } from "@/components/ui/feedback";
import { SUPPORT_PRIORITIES, conversationCount, conversationOf, describeEvent, filterHistory, formatFileSize, parseHistoryFilter } from "@/lib/admin/support";
import { duplicateSupportTicket, removeSupportFile, setSupportStatus } from "@/lib/admin/support-actions";
import { loadSupportDetail, loadSupportHistory, loadSupportStaff } from "@/lib/admin/support-queries";
import { cn } from "@/lib/utils";

export const metadata = { title: "Détail du ticket" };

const dayFmt = new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "short", year: "numeric", timeZone: "Africa/Abidjan" });
const timeFmt = new Intl.DateTimeFormat("fr-FR", { hour: "2-digit", minute: "2-digit", timeZone: "Africa/Abidjan" });
const when = (iso: string) => `${dayFmt.format(new Date(iso))} à ${timeFmt.format(new Date(iso))}`;
const RESULTS: Record<string, string> = {
  in_progress: "Le ticket est en cours de traitement.", waiting: "Le ticket est en attente.", new: "Le ticket est de nouveau ouvert.", resolved: "Le ticket est résolu.",
  archived: "Le ticket a été archivé.", priorite: "La priorité a été modifiée.", categorie: "La catégorie a été modifiée.", reassigne: "Le responsable a été modifié.",
  assigne: "Le ticket vous est assigné.", desassigne: "Le ticket n’est plus assigné.", "fichier-retire": "La pièce jointe a été retirée.", "note-modifiee": "La note interne a été modifiée.", "note-supprimee": "La note interne a été supprimée.", duplique: "Ticket dupliqué : voici la copie.",
};
const card = "rounded-2xl border border-line bg-white p-5 shadow-card";
const row = "grid grid-cols-[8.5rem_minmax(0,1fr)] items-center gap-3 py-1.5 text-sm";

type SP = Promise<{ resultat?: string; erreur?: string; onglet?: string; evenement?: string; fichier?: string }>;

async function Content({ id, searchParams }: { id: string; searchParams: SP }) {
  const sp = await searchParams;
  const [d, staff] = await Promise.all([loadSupportDetail(id), loadSupportStaff()]);
  if (!d) notFound();
  const tab = ["historique", "pieces-jointes", "notes"].includes(sp.onglet ?? "") ? sp.onglet : "conversation";
  const filter = parseHistoryFilter(sp.evenement);
  const events = tab === "historique" ? filterHistory((await loadSupportHistory(id)).map(describeEvent), filter) : [];
  const t = d.ticket;
  const back = `/admin/support/${t.id}`;
  const archived = t.status === "archived";
  const closed = archived || t.status === "resolved";
  const messages = conversationOf(d);
  const lastPublic = [...messages].reverse().find((m) => !m.internal);
  const notes = messages.filter((m) => m.internal).length;
  const pr = SUPPORT_PRIORITIES[t.priority];

  return (
    <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
      <div className="space-y-6">
        {sp.resultat && RESULTS[sp.resultat] && <Alert tone="success">{RESULTS[sp.resultat]}</Alert>}
        {sp.erreur && <Alert>{sp.erreur}</Alert>}

        <section className={card}>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-lg bg-brand-soft px-3 py-1.5 text-base font-extrabold text-brand">{t.reference}</span>
              <span className={cn("inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold", pr.tone)}><span className={cn("h-2 w-2 rounded-full", pr.dot)} aria-hidden />{pr.label}</span>
              <CategoryTag category={t.category} />
            </div>
            <div className="text-right text-xs text-brand-dark"><p>Créé le {when(t.created_at)}</p><p>Dernière mise à jour : {when(t.updated_at)}</p></div>
          </div>
          <h2 className="mt-3 text-2xl font-extrabold text-brand-dark">{t.subject}</h2>
          {t.description && <p className="mt-2 whitespace-pre-line text-sm text-brand-dark">{t.description}</p>}
        </section>

        <section className={card}>
          <nav aria-label="Sections du ticket" className="mb-4 flex flex-wrap gap-1 border-b border-line pb-3">
            {([["conversation", MessageSquare, `Conversation (${conversationCount(d)})`], ["historique", History, "Historique"], ["pieces-jointes", Paperclip, `Pièces jointes (${d.files.length})`], ["notes", FileText, `Notes internes (${notes})`]] as const).map(([key, Icon, text]) => (
              <Link key={key} href={key === "conversation" ? back : `${back}?onglet=${key}`} aria-current={tab === key ? "page" : undefined}
                className={cn("inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold", tab === key ? "bg-brand text-white" : "text-brand-dark hover:bg-brand-soft")}><Icon className="h-4 w-4" aria-hidden />{text}</Link>
            ))}
          </nav>

          {tab === "historique" ? <SupportHistory events={events} filter={filter} base={back} /> : tab === "notes" ? <SupportNotes ticketId={t.id} notes={messages.filter((m) => m.internal)} archived={archived} base={back} /> : tab === "pieces-jointes" ? <SupportFilesTab ticketId={t.id} files={d.files} selectedId={sp.fichier} archived={archived} base={back} /> : <>
          {messages.length === 0 ? <p className="rounded-lg bg-surface px-4 py-8 text-center text-sm text-muted">Aucun message pour le moment. Répondez à l’utilisateur ci-dessous.</p> : (
            <ol className="space-y-5">
              {messages.map((m) => {
                const solved = closed && m === lastPublic && m.is_requester;
                return (
                  <li key={m.id} className="flex gap-3">
                    <Avatar name={m.author_name} src={m.author_avatar} size={40} />
                    <div className="min-w-0 flex-1">
                      <p className="flex flex-wrap items-center gap-2 text-sm">
                        <span className="font-extrabold text-brand-dark">{m.author_name}</span>
                        {!m.is_requester && !m.internal && <span className="rounded-md bg-brand-soft px-2 py-0.5 text-xs font-semibold text-brand">Support</span>}
                        {m.internal && <span className="inline-flex items-center gap-1 rounded-md bg-warning/15 px-2 py-0.5 text-xs font-semibold text-[#a16207]"><Lock className="h-3 w-3" aria-hidden />Note interne</span>}
                        <span className="text-xs text-muted">{when(m.created_at)}</span>
                      </p>
                      <div className={cn("mt-1 flex items-start justify-between gap-3 whitespace-pre-line rounded-xl px-4 py-3 text-sm text-brand-dark", m.internal ? "bg-warning/10" : solved ? "bg-success/10" : "bg-brand-soft/60")}>
                        <span className="min-w-0 break-words">{m.body}</span>
                        {solved && <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-success text-white" aria-label="Ticket résolu"><Check className="h-4 w-4" aria-hidden /></span>}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ol>
          )}

          <div className="mt-6"><SupportReplyForm ticketId={t.id} archived={archived} /></div>
          </>}
        </section>
      </div>

      <aside className="space-y-6">
        <section id="ticket-infos" className={cn(card, "scroll-mt-4")}>
          <h2 className="mb-3 flex items-center gap-2 text-base font-extrabold text-brand-dark"><span className="flex h-7 w-7 items-center justify-center rounded-md bg-brand text-white" aria-hidden><Info className="h-4 w-4" /></span>Informations du ticket</h2>
          <TicketFields ticket={t} staff={staff} back={back} />
          <dl className="mt-2 divide-y divide-line border-t border-line pt-1">
            <div className={row}><dt className="text-brand-dark">Formation concernée</dt><dd className="min-w-0 truncate font-semibold text-brand-dark">{t.course_id ? <Link href={`/admin/formations/${t.course_id}`} className="hover:text-brand hover:underline">{t.course_title}</Link> : <span className="font-normal text-muted">—</span>}</dd></div>
            <div className={row}><dt className="text-brand-dark">Demandeur</dt><dd className="flex min-w-0 items-center gap-2 font-semibold text-brand-dark"><User className="h-4 w-4 shrink-0 text-brand" aria-hidden /><span className="truncate">{d.requester.name}</span></dd></div>
            <div className={row}><dt className="text-brand-dark">Email</dt><dd className="flex min-w-0 items-center gap-2 text-brand-dark"><Mail className="h-4 w-4 shrink-0 text-brand" aria-hidden /><a href={`mailto:${d.requester.email}`} className="truncate hover:underline">{d.requester.email}</a></dd></div>
            <div className={row}><dt className="text-brand-dark">Téléphone</dt><dd className="flex min-w-0 items-center gap-2 text-brand-dark"><Phone className="h-4 w-4 shrink-0 text-brand" aria-hidden />{d.requester.phone ? <a href={`tel:${d.requester.phone.replace(/\s/g, "")}`} className="hover:underline">{d.requester.phone}</a> : <span className="text-muted">—</span>}</dd></div>
          </dl>
        </section>

        <section className={card}>
          <h2 className="mb-3 flex items-center gap-2 text-base font-extrabold text-brand-dark"><Paperclip className="h-5 w-5 text-brand" aria-hidden />Pièces jointes ({d.files.length})</h2>
          {d.files.length === 0 ? <p className="mb-3 text-sm text-muted">Aucune pièce jointe.</p> : (
            <ul className="mb-3 space-y-2">
              {d.files.map((f) => {
                const image = f.mime?.startsWith("image/");
                const Icon = image ? ImageIcon : FileText;
                return (
                  <li key={f.id} className="flex items-center gap-3">
                    <span className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-lg", image ? "bg-brand-soft text-brand" : "bg-danger/10 text-danger")} aria-hidden><Icon className="h-5 w-5" /></span>
                    <div className="min-w-0 flex-1"><p className="truncate text-sm font-bold text-brand-dark" title={f.name}>{f.name}</p><p className="text-xs text-muted">{formatFileSize(f.size)}</p></div>
                    <a href={`/admin/support/fichiers/${f.id}`} download aria-label={`Télécharger ${f.name}`} className="rounded-lg p-2 text-brand hover:bg-brand-soft"><Download className="h-4 w-4" aria-hidden /></a>
                    <details className="relative">
                      <summary aria-label={`Actions pour ${f.name}`} className="flex h-8 w-9 cursor-pointer list-none items-center justify-center rounded-lg border border-line text-brand-dark hover:bg-brand-soft [&::-webkit-details-marker]:hidden"><MoreHorizontal className="h-4 w-4" aria-hidden /></summary>
                      <div className="absolute right-0 z-10 mt-1 w-44 rounded-lg border border-line bg-white py-1 text-sm shadow-card">
                        <form action={removeSupportFile}>
                          <input type="hidden" name="fileId" value={f.id} />
                          <input type="hidden" name="back" value={back} />
                          <button className="flex w-full items-center gap-2 px-3 py-2 text-left text-danger hover:bg-brand-soft"><Trash2 className="h-4 w-4" aria-hidden />Retirer</button>
                        </form>
                      </div>
                    </details>
                  </li>
                );
              })}
            </ul>
          )}
          <AttachFileButton ticketId={t.id} disabled={archived} variant="panel" />
        </section>

        <section className={card}>
          <h2 className="mb-3 flex items-center gap-2 text-base font-extrabold text-brand-dark"><Zap className="h-5 w-5 text-brand" aria-hidden />Actions</h2>
          <div className="space-y-2.5">
            {closed ? (
              <form action={setSupportStatus}>
                <input type="hidden" name="ticketId" value={t.id} /><input type="hidden" name="back" value={back} /><input type="hidden" name="status" value="in_progress" />
                <button className="flex w-full items-center gap-3 rounded-lg border border-line bg-brand-soft px-4 py-3 text-sm font-bold text-brand hover:bg-brand-soft/70"><RotateCcw className="h-5 w-5" aria-hidden />Rouvrir le ticket</button>
              </form>
            ) : (
              <form action={setSupportStatus}>
                <input type="hidden" name="ticketId" value={t.id} /><input type="hidden" name="back" value={back} /><input type="hidden" name="status" value="resolved" />
                <button className="flex w-full items-center gap-3 rounded-lg border border-success/40 bg-success/10 px-4 py-3 text-sm font-bold text-brand-dark hover:bg-success/20"><span className="flex h-6 w-6 items-center justify-center rounded-full bg-success text-white" aria-hidden><Check className="h-4 w-4" /></span>Marquer comme résolu</button>
              </form>
            )}
            <a href="#ticket-infos" title="Choisissez le responsable dans « Assigné à »" className="flex w-full items-center gap-3 rounded-lg border border-[#c4b5fd] bg-[#ede9fe] px-4 py-3 text-sm font-bold text-[#6d28d9] hover:bg-[#e4dcfb]"><UserCog className="h-5 w-5" aria-hidden />Réassigner</a>
            <form action={duplicateSupportTicket}>
              <input type="hidden" name="ticketId" value={t.id} /><input type="hidden" name="back" value={back} />
              <button className="flex w-full items-center gap-3 rounded-lg border border-brand/40 bg-brand-soft px-4 py-3 text-sm font-bold text-brand hover:bg-brand-soft/70"><Copy className="h-5 w-5" aria-hidden />Dupliquer</button>
            </form>
            <form action={setSupportStatus}>
              <input type="hidden" name="ticketId" value={t.id} /><input type="hidden" name="back" value={back} /><input type="hidden" name="status" value="archived" />
              <button disabled={t.status !== "resolved"} title={t.status === "resolved" ? undefined : "Seul un ticket résolu peut être archivé"}
                className="flex w-full items-center gap-3 rounded-lg border border-danger/40 bg-danger/5 px-4 py-3 text-sm font-bold text-danger hover:bg-danger/10 disabled:cursor-not-allowed disabled:opacity-50"><Trash2 className="h-5 w-5" aria-hidden />Archiver</button>
            </form>
          </div>
          <p className="mt-3 flex items-start gap-2 text-xs text-muted"><BookOpen className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />Chaque action est tracée dans le journal d’audit.</p>
        </section>
      </aside>
    </div>
  );
}

export default async function SupportTicketPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: SP }) {
  const { id } = await params;
  return (
    <div className="space-y-5">
      <AdminPageHeader crumbs={[{ label: "Support", href: "/admin/support" }, { label: "Détail du ticket" }]} icon="document" title="Détail du ticket"
        description="Consultez les échanges, traitez la demande et mettez à jour le statut du ticket."
        actions={<Link href="/admin/support" className="inline-flex items-center gap-2 rounded-lg border border-brand bg-white px-5 py-2.5 text-sm font-semibold text-brand hover:bg-brand-soft"><ArrowLeft className="h-4 w-4" aria-hidden /> Retour à la liste</Link>} />
      <Suspense fallback={<div className="h-96 animate-pulse rounded-2xl bg-white" aria-hidden />}>
        <Content id={id} searchParams={searchParams} />
      </Suspense>
    </div>
  );
}
