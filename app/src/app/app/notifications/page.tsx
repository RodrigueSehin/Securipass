import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Bell, Check, Search } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { EmptyState, PageHeader } from "@/components/ui/feedback";
import { formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import { markAllNotificationsRead } from "@/lib/learner/actions";
import { markNotificationRead } from "@/lib/notifications/actions";
import { CATEGORIES, countByCategory, type Category, categoryOf } from "@/lib/notifications/categories";
import { groupByDay } from "@/lib/notifications/groups";

export const metadata = { title: "Notifications" };

type Search_ = { tab?: string; q?: string };
type Row = { id: string; kind: string; title: string; body: string | null; link: string | null; created_at: string; read_at: string | null };

const TABS = [
  { key: "toutes", label: "Toutes" },
  { key: "non_lues", label: "Non lues" },
  { key: "formations", label: "Formations" },
  { key: "evaluations", label: "Évaluations" },
  { key: "certificats", label: "Certificats" },
  { key: "messages", label: "Messages" },
] as const;
type TabKey = (typeof TABS)[number]["key"];

const ICON_TONE: Record<Category, string> = {
  formations: "bg-brand text-white",
  evaluations: "bg-[#7c3aed] text-white",
  certificats: "bg-success text-white",
  messages: "bg-cta text-white",
};

async function Page({ searchParams }: { searchParams: Promise<Search_> }) {
  const sp = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/connexion?redirect=/app/notifications");

  const { data } = await supabase
    .from("notifications")
    .select("id, kind, title, body, link, created_at, read_at")
    .order("created_at", { ascending: false })
    .limit(200)
    .returns<Row[]>();
  const all = data ?? [];

  const tab: TabKey = TABS.some((t) => t.key === sp.tab) ? (sp.tab as TabKey) : "toutes";
  const q = (sp.q ?? "").trim().toLowerCase().slice(0, 80);
  const shown = all
    .filter((n) => {
      if (tab === "non_lues") return !n.read_at;
      if (tab === "toutes") return true;
      return categoryOf(n.kind) === tab;
    })
    .filter((n) => !q || `${n.title} ${n.body ?? ""}`.toLowerCase().includes(q));
  const groups = groupByDay(shown);
  const byCat = countByCategory(all);
  const unread = all.filter((n) => !n.read_at).length;
  const tabHref = (key: string) => (key === "toutes" ? "/app/notifications" : `/app/notifications?tab=${key}`);
  const count = (key: TabKey) => key === "toutes" ? all.length : key === "non_lues" ? unread : byCat[key as Category];

  return (
    <div className="grid gap-6 xl:grid-cols-[1fr_18rem]">
      <div className="min-w-0 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <nav aria-label="Filtrer les notifications" className="flex flex-wrap gap-2">
            {TABS.map((t) => (
              <Link key={t.key} href={tabHref(t.key)} aria-current={t.key === tab ? "page" : undefined}
                className={cn("rounded-lg border px-3 py-1.5 text-sm font-semibold",
                  t.key === tab ? "border-brand-dark bg-brand-dark text-white" : "border-line bg-white text-brand-dark hover:border-brand")}>
                {t.label} ({count(t.key)})
              </Link>
            ))}
          </nav>
          {unread > 0 && (
            <form action={markAllNotificationsRead}>
              <Button variant="primary"><Check className="h-4 w-4" aria-hidden />Tout marquer comme lu</Button>
            </form>
          )}
        </div>

        <form role="search" action="/app/notifications" className="relative max-w-md">
          {tab !== "toutes" && <input type="hidden" name="tab" value={tab} />}
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-brand" aria-hidden />
          <input name="q" type="search" defaultValue={sp.q ?? ""} placeholder="Rechercher une notification…" aria-label="Rechercher une notification"
            className="w-full rounded-xl border border-line bg-white py-2.5 pl-9 pr-3 text-sm outline-none focus:border-brand" />
        </form>

        {shown.length === 0 ? (
          <EmptyState title={all.length === 0 ? "Aucune notification" : "Aucune notification dans ce filtre"}>
            Vous serez prévenu ici des inscriptions, changements de session, évaluations, certificats et messages.
          </EmptyState>
        ) : (
          groups.map((g) => (
            <section key={g.label} aria-label={g.label}>
              <h2 className="mb-2 text-sm font-bold text-brand-dark">{g.label}</h2>
              <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-white">
                {g.items.map((n) => {
                  const cat = categoryOf(n.kind);
                  const body = (
                    <>
                      <span className="flex items-start justify-between gap-3">
                        <span className={cn("text-sm", n.read_at ? "text-brand-dark" : "font-semibold text-brand-dark")}>{n.title}</span>
                        <time className="shrink-0 text-xs text-muted" dateTime={n.created_at}>{formatDateTime(n.created_at)}</time>
                      </span>
                      {n.body && <span className="mt-0.5 block text-sm text-muted">{n.body}</span>}
                    </>
                  );
                  return (
                    <li key={n.id} className={cn("flex items-start gap-4 px-5 py-4", !n.read_at && "bg-brand-soft/40")}>
                      <span className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-full", cat ? ICON_TONE[cat] : "bg-surface text-muted")} aria-hidden>
                        <Bell className="h-4 w-4" />
                      </span>
                      <div className="min-w-0 flex-1">
                        {n.link ? <Link href={n.link} className="block hover:underline">{body}</Link> : <div>{body}</div>}
                        {cat && <span className="mt-1 inline-block text-[11px] font-semibold uppercase tracking-wide text-muted">{CATEGORIES[cat]}</span>}
                      </div>
                      {!n.read_at && (
                        <form action={markNotificationRead} className="shrink-0">
                          <input type="hidden" name="notificationId" value={n.id} />
                          <input type="hidden" name="returnTo" value={tabHref(tab)} />
                          <button className="whitespace-nowrap text-xs font-semibold text-brand hover:underline">Marquer comme lu</button>
                        </form>
                      )}
                    </li>
                  );
                })}
              </ul>
            </section>
          ))
        )}
      </div>

      <aside aria-label="Résumé des notifications" className="space-y-4">
        <section className="rounded-2xl border border-line bg-white p-5">
          <h2 className="mb-3 font-bold text-brand-dark">Notifications en chiffres</h2>
          <dl className="grid grid-cols-2 gap-3 text-sm">
            <div><dt className="text-muted">Total</dt><dd className="text-2xl font-extrabold text-brand-dark">{all.length}</dd></div>
            <div><dt className="text-muted">Non lues</dt><dd className="text-2xl font-extrabold text-cta">{unread}</dd></div>
            {(Object.keys(CATEGORIES) as Category[]).map((c) => (
              <div key={c}><dt className="text-muted">{CATEGORIES[c]}</dt><dd className="text-lg font-bold text-brand-dark">{byCat[c]}</dd></div>
            ))}
          </dl>
        </section>
        <section className="rounded-2xl border border-line bg-white p-5 text-sm">
          <h2 className="mb-2 font-bold text-brand-dark">Réception par e-mail</h2>
          <p className="text-muted">Les notifications apparaissent ici. L’envoi par e-mail n’est pas encore activé : votre préférence est enregistrée dans votre profil.</p>
          <Link href="/app/profil?onglet=preferences" className="mt-3 inline-block font-semibold text-brand hover:underline">Gérer mes préférences</Link>
        </section>
      </aside>
    </div>
  );
}

export default function NotificationsPage({ searchParams }: { searchParams: Promise<Search_> }) {
  return (
    <>
      <PageHeader title="Notifications" description="Restez informé des formations, évaluations, certificats et messages." />
      <Suspense fallback={<div className="h-48 animate-pulse rounded-2xl bg-white" aria-hidden />}>
        <Page searchParams={searchParams} />
      </Suspense>
    </>
  );
}
