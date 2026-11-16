import Link from "next/link";
import { Archive, CalendarDays, Check, Copy, History, MessageSquare, Paperclip, Pencil, Plus, RefreshCw, RotateCcw, Tag, User, type LucideIcon } from "lucide-react";
import { HistoryFilterSelect } from "@/components/admin/support-history-filter";
import { Avatar } from "@/components/ui/avatar";
import { HISTORY_FILTERS, type HistoryEntry, type HistoryFilter, type HistoryIcon } from "@/lib/admin/support";
import { cn } from "@/lib/utils";

const ICONS: Record<HistoryIcon, LucideIcon> = {
  plus: Plus, copy: Copy, check: Check, chat: MessageSquare, note: Pencil, refresh: RefreshCw, user: User, tag: Tag, paperclip: Paperclip, archive: Archive, reopen: RotateCcw,
};
const TONES: Record<HistoryEntry["tone"], string> = {
  success: "bg-success text-white", brand: "bg-brand text-white", purple: "bg-[#7c3aed] text-white", orange: "bg-cta text-white", muted: "bg-[#8b97aa] text-white",
};
const BADGE: Record<HistoryEntry["actorBadge"], string> = { Support: "bg-brand-soft text-brand", Demandeur: "bg-[#ede9fe] text-[#6d28d9]", Système: "bg-surface text-muted" };
const dayFmt = new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "short", year: "numeric", timeZone: "Africa/Abidjan" });
const timeFmt = new Intl.DateTimeFormat("fr-FR", { hour: "2-digit", minute: "2-digit", timeZone: "Africa/Abidjan" });
const when = (iso: string) => `${dayFmt.format(new Date(iso))} à ${timeFmt.format(new Date(iso))}`;

/** Historique du ticket : toutes les actions tracées, de la plus récente à la plus ancienne, avec filtre par type d'événement. */
export function SupportHistory({ events, filter, base }: { events: HistoryEntry[]; filter: HistoryFilter; base: string }) {
  return (
    <div>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <History className="mt-1 h-6 w-6 text-brand" aria-hidden />
          <div><h3 className="text-lg font-extrabold text-brand-dark">Historique du ticket</h3><p className="text-sm text-muted">Toutes les actions et modifications effectuées sur ce ticket.</p></div>
        </div>
        <HistoryFilterSelect value={filter} />
      </div>
      {events.length === 0 ? (
        <p className="rounded-lg bg-surface px-4 py-8 text-center text-sm text-muted">
          Aucun événement{filter !== "all" ? ` de type « ${HISTORY_FILTERS[filter]} »` : ""}. {filter !== "all" && <Link href={`${base}?onglet=historique`} className="font-semibold text-brand hover:underline">Tout afficher</Link>}
        </p>
      ) : (
        <ol className="space-y-2">
          {events.map((e) => {
            const Icon = ICONS[e.icon];
            return (
              <li key={e.id} className="flex items-center gap-3">
                <span className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-full", TONES[e.tone])} aria-hidden><Icon className="h-4 w-4" /></span>
                <div className={cn("grid min-w-0 flex-1 gap-x-4 gap-y-1 rounded-xl px-4 py-3 md:grid-cols-[minmax(0,1fr)_auto_auto] md:items-center", e.highlight ? "bg-success/10" : "bg-surface")}>
                  <div className="min-w-0"><p className="text-sm font-extrabold text-brand-dark">{e.title}</p>{e.detail && <p className="break-words text-sm text-brand-dark">{e.detail}</p>}</div>
                  <p className="flex items-center gap-2 text-sm"><Avatar name={e.actorName} src={e.actorAvatar} size={26} /><span className="font-bold text-brand-dark">{e.actorName}</span><span className={cn("rounded-md px-2 py-0.5 text-xs font-semibold", BADGE[e.actorBadge])}>{e.actorBadge}</span></p>
                  <p className="flex items-center gap-2 whitespace-nowrap text-xs text-brand-dark"><CalendarDays className="h-4 w-4 text-brand" aria-hidden />{when(e.at)}</p>
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
