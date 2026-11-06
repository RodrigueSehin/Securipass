import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Download, GraduationCap, LifeBuoy, Paperclip, Search, Send } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Button, ButtonLink } from "@/components/ui/button";
import { Alert, EmptyState, PageHeader } from "@/components/ui/feedback";
import { formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import { ALLOWED_ATTACHMENTS, MAX_BODY_CHARS } from "@/lib/messaging/rules";
import { sendMessage, setConversationArchived, startCourseConversation, startSupportConversation } from "@/lib/messaging/actions";

export const metadata = { title: "Messages" };

const TABS = [
  { key: "toutes", label: "Toutes" },
  { key: "non_lues", label: "Non lues" },
  { key: "archivees", label: "Archivées" },
] as const;
type TabKey = (typeof TABS)[number]["key"];

type Search_ = { c?: string; tab?: string; q?: string; nouveau?: string; erreur?: string; resultat?: string };

type Conversation = {
  id: string;
  kind: "course" | "support";
  course_id: string | null;
  archived_by_learner: boolean;
  last_message_at: string | null;
  created_at: string;
  course: { title: string } | null;
};
type Message = {
  id: string;
  conversation_id: string;
  sender_id: string;
  body: string;
  attachment_name: string | null;
  attachment_path: string | null;
  created_at: string;
};

const RESULTS: Record<string, string> = {
  archivee: "Conversation archivée.",
  restauree: "Conversation restaurée.",
};

function titleOf(c: Conversation) {
  return c.kind === "support" ? "Équipe SECURIPASS" : c.course?.title ?? "Formation";
}

async function Page({ searchParams }: { searchParams: Promise<Search_> }) {
  const sp = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/connexion?redirect=/app/messages");

  const tab: TabKey = TABS.some((t) => t.key === sp.tab) ? (sp.tab as TabKey) : "toutes";
  const search = (sp.q ?? "").trim().toLowerCase().slice(0, 80);

  const { data: conversations } = await supabase
    .from("conversations")
    .select("id, kind, course_id, archived_by_learner, last_message_at, created_at, course:courses(title)")
    .eq("learner_id", user.id)
    .returns<Conversation[]>();
  const convs = conversations ?? [];
  const ids = convs.map((c) => c.id);

  const [{ data: messages }, { data: reads }] = await Promise.all([
    ids.length
      ? supabase.from("messages").select("id, conversation_id, sender_id, body, attachment_name, attachment_path, created_at")
          .in("conversation_id", ids).order("created_at", { ascending: false }).limit(1000).returns<Message[]>()
      : Promise.resolve({ data: [] as Message[] }),
    supabase.from("conversation_reads").select("conversation_id, read_at").eq("profile_id", user.id)
      .returns<{ conversation_id: string; read_at: string }[]>(),
  ]);
  const readAt = new Map((reads ?? []).map((r) => [r.conversation_id, r.read_at]));
  const byConv = new Map<string, Message[]>();
  for (const m of messages ?? []) byConv.set(m.conversation_id, [...(byConv.get(m.conversation_id) ?? []), m]);
  const unreadOf = (id: string) => (byConv.get(id) ?? []).filter((m) =>
    m.sender_id !== user.id && (!readAt.get(id) || new Date(m.created_at) > new Date(readAt.get(id)!))).length;

  const sorted = [...convs].sort((a, b) =>
    new Date(b.last_message_at ?? b.created_at).getTime() - new Date(a.last_message_at ?? a.created_at).getTime());
  const counts = {
    toutes: sorted.filter((c) => !c.archived_by_learner).length,
    non_lues: sorted.filter((c) => !c.archived_by_learner && unreadOf(c.id) > 0).length,
    archivees: sorted.filter((c) => c.archived_by_learner).length,
  };
  const listed = sorted.filter((c) => {
    if (tab === "archivees") return c.archived_by_learner;
    if (c.archived_by_learner) return false;
    return tab === "toutes" || unreadOf(c.id) > 0;
  }).filter((c) => !search || titleOf(c).toLowerCase().includes(search));

  const selected = sorted.find((c) => c.id === sp.c) ?? null;
  const isNewPanel = sp.nouveau === "1";
  const threadMessages = selected ? [...(byConv.get(selected.id) ?? [])].reverse() : [];
  if (selected) await supabase.rpc("mark_conversation_read", { p_conversation: selected.id });
  const instructor = selected?.kind === "course"
    ? (await supabase.rpc("conversation_instructor_name", { p_conversation: selected.id })).data as string | null
    : null;
  const files = threadMessages.filter((m) => m.attachment_path);

  const { data: enrolled } = isNewPanel
    ? await supabase.from("enrollments").select("course:courses(id, title)").eq("learner_id", user.id)
        .in("status", ["confirmed", "completed"]).returns<{ course: { id: string; title: string } | null }[]>()
    : { data: null };
  const courses = (enrolled ?? []).flatMap((e) => (e.course ? [e.course] : []));

  const link = (params: Record<string, string>) => `/app/messages?${new URLSearchParams(params).toString()}`;
  const notice = sp.resultat && RESULTS[sp.resultat] ? RESULTS[sp.resultat] : null;

  return (
    <div className="grid gap-4 xl:grid-cols-[20rem_1fr_18rem]">
      {/* Liste des conversations */}
      <section aria-label="Conversations" className="flex min-h-[32rem] flex-col rounded-2xl border border-line bg-white">
        <form action="/app/messages" className="border-b border-line p-4">
          {tab !== "toutes" && <input type="hidden" name="tab" value={tab} />}
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-brand" aria-hidden />
            <input name="q" type="search" defaultValue={sp.q ?? ""} placeholder="Rechercher une conversation…" aria-label="Rechercher une conversation"
              className="w-full rounded-xl border border-line bg-surface py-2.5 pl-9 pr-3 text-sm outline-none focus:border-brand" />
          </div>
        </form>
        <div className="flex gap-1.5 px-4 pb-3">
          {TABS.map((t) => (
            <Link key={t.key} href={link({ tab: t.key })} aria-current={t.key === tab ? "page" : undefined}
              className={cn("rounded-lg border px-3 py-1.5 text-xs font-semibold",
                t.key === tab ? "border-brand-dark bg-brand-dark text-white" : "border-line bg-white text-brand-dark hover:border-brand")}>
              {t.label} ({counts[t.key]})
            </Link>
          ))}
        </div>
        <ul className="flex-1 divide-y divide-line overflow-y-auto">
          {listed.length === 0 && <li className="p-4 text-sm text-muted">Aucune conversation dans cette liste.</li>}
          {listed.map((c) => {
            const last = (byConv.get(c.id) ?? [])[0];
            const unread = unreadOf(c.id);
            return (
              <li key={c.id}>
                <Link href={link({ c: c.id, tab })} aria-current={selected?.id === c.id ? "true" : undefined}
                  className={cn("flex gap-3 p-4 hover:bg-brand-soft/50", selected?.id === c.id && "bg-brand-soft")}>
                  <span className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-white",
                    c.kind === "support" ? "bg-cta" : "bg-brand")} aria-hidden>
                    {c.kind === "support" ? <LifeBuoy className="h-5 w-5" /> : <GraduationCap className="h-5 w-5" />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center justify-between gap-2">
                      <span className={cn("truncate text-sm", unread ? "font-bold text-brand-dark" : "font-semibold text-brand-dark")}>{titleOf(c)}</span>
                      {unread > 0 && <span className="rounded-full bg-brand px-2 py-0.5 text-[11px] font-bold text-white">{unread}</span>}
                    </span>
                    <span className="block truncate text-xs text-muted">{last ? (last.sender_id === user.id ? "Vous : " : "") + (last.body || last.attachment_name) : "Aucun message"}</span>
                    <span className="block text-[11px] text-muted">{formatDateTime(c.last_message_at ?? c.created_at)}</span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
        <div className="border-t border-line p-4">
          <Link href={link({ nouveau: "1" })} className="block rounded-lg bg-brand px-4 py-2.5 text-center text-sm font-semibold text-white hover:bg-brand-dark">
            Nouveau message
          </Link>
        </div>
      </section>

      {/* Fil de discussion ou nouveau message */}
      <section aria-label="Fil de discussion" className="flex min-h-[32rem] min-w-0 flex-col rounded-2xl border border-line bg-white">
        {notice && <div className="p-4 pb-0"><Alert tone="success">{notice}</Alert></div>}
        {sp.erreur && <div className="p-4 pb-0"><Alert>{sp.erreur}</Alert></div>}
        {isNewPanel ? (
          <div className="space-y-5 p-6">
            <h2 className="font-bold text-brand-dark">Nouveau message</h2>
            <p className="text-sm text-muted">Écrivez au formateur d’une formation que vous suivez, ou à l’équipe SECURIPASS.</p>
            <div className="grid gap-3 sm:grid-cols-2">
              {courses.map((c) => (
                <form key={c.id} action={startCourseConversation}>
                  <input type="hidden" name="courseId" value={c.id} />
                  <button className="flex w-full items-center gap-3 rounded-xl border border-line p-4 text-left hover:border-brand">
                    <GraduationCap className="h-5 w-5 text-brand" aria-hidden />
                    <span className="text-sm font-semibold text-brand-dark">Formateur · {c.title}</span>
                  </button>
                </form>
              ))}
              <form action={startSupportConversation}>
                <button className="flex w-full items-center gap-3 rounded-xl border border-line p-4 text-left hover:border-brand">
                  <LifeBuoy className="h-5 w-5 text-cta" aria-hidden />
                  <span className="text-sm font-semibold text-brand-dark">Équipe SECURIPASS (support)</span>
                </button>
              </form>
            </div>
            {courses.length === 0 && <p className="text-sm text-muted">Vous ne suivez encore aucune formation : le support reste disponible.</p>}
          </div>
        ) : !selected ? (
          <EmptyState title="Sélectionnez une conversation">Vos échanges avec les formateurs et le support apparaissent ici.</EmptyState>
        ) : (
          <>
            <header className="flex flex-wrap items-center justify-between gap-3 border-b border-line p-4">
              <div className="min-w-0">
                <h2 className="truncate font-bold text-brand-dark">{selected.kind === "support" ? "Équipe SECURIPASS" : instructor ? `Formateur · ${instructor}` : titleOf(selected)}</h2>
                <p className="truncate text-xs text-muted">{selected.kind === "support" ? "Support apprenant" : titleOf(selected)}</p>
              </div>
              <form action={setConversationArchived}>
                <input type="hidden" name="conversationId" value={selected.id} />
                <input type="hidden" name="archived" value={selected.archived_by_learner ? "0" : "1"} />
                <Button variant="outline">{selected.archived_by_learner ? "Restaurer" : "Archiver"}</Button>
              </form>
            </header>

            <ol className="flex-1 space-y-4 overflow-y-auto p-4">
              {threadMessages.length === 0 && <li className="text-sm text-muted">Aucun message pour le moment. Écrivez le premier.</li>}
              {threadMessages.map((m) => {
                const mine = m.sender_id === user.id;
                return (
                  <li key={m.id} className={cn("flex", mine ? "justify-end" : "justify-start")}>
                    <div className={cn("max-w-[80%] rounded-2xl px-4 py-3 text-sm", mine ? "bg-brand-soft text-brand-dark" : "border border-line bg-white text-brand-dark")}>
                      {m.body && <p className="whitespace-pre-line">{m.body}</p>}
                      {m.attachment_path && (
                        <a href={`/app/messages/fichiers/${m.id}`} className="mt-2 flex items-center gap-2 rounded-lg bg-white p-2 font-semibold text-brand hover:underline">
                          <Paperclip className="h-4 w-4" aria-hidden />{m.attachment_name}<Download className="ml-auto h-4 w-4" aria-hidden />
                        </a>
                      )}
                      <time className="mt-1 block text-right text-[11px] text-muted" dateTime={m.created_at}>{formatDateTime(m.created_at)}</time>
                    </div>
                  </li>
                );
              })}
            </ol>

            <form action={sendMessage} className="flex items-end gap-2 border-t border-line p-4">
              <input type="hidden" name="conversationId" value={selected.id} />
              <label className="flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-lg border border-line text-brand hover:bg-brand-soft" title="Joindre un fichier">
                <Paperclip className="h-5 w-5" aria-hidden />
                <span className="sr-only">Joindre un fichier (PDF, Word, PowerPoint, JPEG, PNG ; 10 Mo maximum)</span>
                <input type="file" name="file" accept={Object.keys(ALLOWED_ATTACHMENTS).join(",")} className="sr-only" />
              </label>
              <label className="sr-only" htmlFor="message-body">Écrire un message</label>
              <textarea id="message-body" name="body" rows={2} maxLength={MAX_BODY_CHARS} placeholder="Écrire un message…"
                className="min-h-11 flex-1 resize-y rounded-lg border border-line px-3 py-2 text-sm outline-none focus:border-brand" />
              <button className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-brand text-white hover:bg-brand-dark">
                <Send className="h-5 w-5" aria-hidden /><span className="sr-only">Envoyer</span>
              </button>
            </form>
          </>
        )}
      </section>

      {/* Contact, fichiers partagés, liens utiles */}
      <aside aria-label="Informations sur la conversation" className="space-y-4">
        {selected && (
          <>
            <section className="rounded-2xl border border-line bg-white p-5">
              <h2 className="mb-2 font-bold text-brand-dark">Contact</h2>
              <p className="font-semibold text-brand-dark">{selected.kind === "support" ? "Équipe SECURIPASS" : instructor ?? "Formateur"}</p>
              <p className="text-sm text-muted">{selected.kind === "support" ? "Support apprenant" : "Formateur de la formation"}</p>
              {selected.kind === "course" && selected.course_id && (
                <p className="mt-1 text-xs text-muted">{titleOf(selected)}</p>
              )}
            </section>

            <section className="rounded-2xl border border-line bg-white p-5">
              <h2 className="mb-2 font-bold text-brand-dark">Fichiers partagés</h2>
              {files.length === 0 ? <p className="text-sm text-muted">Aucun fichier dans cette conversation.</p> : (
                <ul className="space-y-2 text-sm">
                  {files.map((m) => (
                    <li key={m.id}>
                      <a href={`/app/messages/fichiers/${m.id}`} className="flex items-center gap-2 font-medium text-brand hover:underline">
                        <Paperclip className="h-4 w-4 shrink-0" aria-hidden /><span className="truncate">{m.attachment_name}</span>
                      </a>
                      <span className="block text-xs text-muted">{formatDateTime(m.created_at)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            {selected.kind === "course" && selected.course_id && (
              <section className="rounded-2xl border border-line bg-white p-5">
                <h2 className="mb-3 font-bold text-brand-dark">Liens utiles</h2>
                <div className="space-y-2">
                  <ButtonLink href={`/app/formations/${selected.course_id}`} variant="outline" className="w-full">Accéder au cours</ButtonLink>
                  <ButtonLink href="/app/inscriptions" variant="ghost" className="w-full">Voir mes sessions</ButtonLink>
                </div>
              </section>
            )}
          </>
        )}
      </aside>
    </div>
  );
}

export default function MessagesPage({ searchParams }: { searchParams: Promise<Search_> }) {
  return (
    <>
      <PageHeader title="Messages" description="Échangez avec vos formateurs et l’équipe SECURIPASS." />
      <Suspense fallback={<div className="h-96 animate-pulse rounded-2xl bg-white" aria-hidden />}>
        <Page searchParams={searchParams} />
      </Suspense>
    </>
  );
}
