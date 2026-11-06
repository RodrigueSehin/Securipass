import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { BookOpen, CheckCircle2, Clock, Trophy } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { categoryUi } from "@/content/categories";
import {
  ActivityList, CalendarList, CertificateList, CourseCard, DeadlineList, Hero, Journey, Panel, StatTile,
  type ActivityItem, type CalendarItem, type CertificateItem, type Deadline,
} from "@/components/learner/dashboard-parts";
import { activeCourses, evaluationsTodo, loadLearnerState, upcomingSessions } from "@/lib/learner/queries";
import { certificateDisplayStatus } from "@/lib/certificates/status";
import { formatShortDate, formatTimeRange } from "@/lib/format";
import { publicImage } from "@/lib/images";

export const metadata = { title: "Accueil" };

const DAY = 86_400_000;

function dueLabel(iso: string, now: number) {
  const d = Math.ceil((new Date(iso).getTime() - now) / DAY);
  if (d <= 0) return "Aujourd’hui";
  if (d === 1) return "Demain";
  return d < 60 ? `Dans ${d} jours` : `Dans ${Math.round(d / 30)} mois`;
}

/** « 14h00 » dans le fuseau donné. */
const timeLabel = (iso: string, tz: string) =>
  new Intl.DateTimeFormat("fr-FR", { hour: "2-digit", minute: "2-digit", timeZone: tz }).format(new Date(iso)).replace(":", "h");

/** Heures avec une décimale au plus : 24, 7,5. */
const hours = (minutes: number) => String(Number((minutes / 60).toFixed(1))).replace(".", ",");

type CertRow = {
  id: string; issued_at: string; valid_until: string | null; status: "valid" | "suspended" | "revoked";
  content: { course_title?: string } | null;
};

async function Dashboard() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/connexion");

  const [state, profileRes, notificationsRes, certsRes] = await Promise.all([
    loadLearnerState(supabase, user.id),
    supabase.from("profiles").select("full_name").eq("id", user.id).maybeSingle<{ full_name: string }>(),
    supabase.from("notifications").select("id, kind, title, body, created_at").order("created_at", { ascending: false }).limit(5)
      .returns<{ id: string; kind: string; title: string; body: string | null; created_at: string }[]>(),
    supabase.from("certificates").select("id, issued_at, valid_until, status, content").order("issued_at", { ascending: false })
      .returns<CertRow[]>(),
  ]);
  const now = state.now;
  const name = profileRes.data?.full_name || user.email || "";

  const courses = activeCourses(state);
  const inProgress = courses.filter((c) => c.status !== "completed");
  const completed = courses.filter((c) => c.status === "completed");
  const waiting = state.enrollments.filter((e) => e.status === "waitlisted" || e.status === "pending_payment" || e.status === "pending_approval").length;
  const certs = (certsRes.data ?? []).filter((c) => c.status !== "revoked");
  const certStatus = (c: CertRow) => certificateDisplayStatus(c, now);

  const totalContents = courses.reduce((n, c) => n + c.progress.total, 0);
  const doneContents = courses.reduce((n, c) => n + c.progress.done, 0);
  const globalPercent = totalContents === 0 ? 0 : Math.round((doneContents / totalContents) * 100);

  const deadlines: (Deadline & { at: number })[] = [
    ...evaluationsTodo(state, now).filter((ev) => ev.due_at).map((ev) => ({
      key: `ev-${ev.id}`, kind: "evaluation" as const, at: new Date(ev.due_at!).getTime(),
      title: `Évaluation - ${ev.course?.title ?? ev.title}`,
      subtitle: `${formatShortDate(ev.due_at!)} · ${timeLabel(ev.due_at!, "Africa/Abidjan")}`,
      href: "/app/evaluations", chip: dueLabel(ev.due_at!, now),
    })),
    ...upcomingSessions(state, now, 3).map((e) => ({
      key: `s-${e.id}`, kind: "session" as const, at: new Date(e.session!.start_at).getTime(),
      title: `Début de formation - ${e.course?.title ?? e.session!.title}`,
      subtitle: `${formatShortDate(e.session!.start_at, e.session!.timezone)} · ${timeLabel(e.session!.start_at, e.session!.timezone)}`,
      href: "/app/inscriptions", chip: dueLabel(e.session!.start_at, now),
    })),
    ...certs.filter((c) => c.valid_until && new Date(c.valid_until).getTime() > now && certStatus(c).valid).slice(0, 2).map((c) => ({
      key: `c-${c.id}`, kind: "certificate" as const, at: new Date(c.valid_until!).getTime(),
      title: `Renouvellement de certificat - ${c.content?.course_title ?? "Formation"}`,
      subtitle: formatShortDate(c.valid_until!), href: "/app/certificats", chip: dueLabel(c.valid_until!, now),
    })),
  ].sort((a, b) => a.at - b.at).slice(0, 4);

  const calendar: CalendarItem[] = upcomingSessions(state, now, 3).map((e) => {
    const s = e.session!;
    const month = new Date(s.start_at).toLocaleDateString("fr-FR", { month: "short", timeZone: s.timezone });
    return {
      id: e.id,
      day: new Date(s.start_at).toLocaleDateString("fr-FR", { day: "2-digit", timeZone: s.timezone }),
      month: month.charAt(0).toUpperCase() + month.slice(1),
      title: s.title, time: formatTimeRange(s.start_at, s.end_at, s.timezone).replace(/:/g, "h"), place: s.location,
    };
  });

  const certificates: CertificateItem[] = certs.slice(0, 2).map((c) => ({
    id: c.id, title: c.content?.course_title ?? "Formation", issued: formatShortDate(c.issued_at),
    statusLabel: certStatus(c).label, tone: certStatus(c).tone,
    detailHref: "/app/certificats", pdfHref: `/app/certificats/${c.id}/pdf`,
  }));

  const activity: ActivityItem[] = (notificationsRes.data ?? []).map((n) => ({
    id: n.id, kind: n.kind, title: n.title, body: n.body, at: n.created_at,
  }));

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_20rem]">
      <div className="min-w-0 space-y-6">
        <Hero name={name} image={publicImage("home/hero")} />

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatTile icon={BookOpen} tone="bg-brand" value={inProgress.length} label="Formations en cours" href="/app/formations" linkLabel="Voir mes formations" />
          <StatTile icon={CheckCircle2} tone="bg-success" value={completed.length} label={completed.length > 1 ? "Formations terminées" : "Formation terminée"} href="/app/certificats" linkLabel="Voir mes certificats" />
          <StatTile icon={Clock} tone="bg-cta" value={waiting} label="Inscriptions en attente" href="/app/inscriptions" linkLabel="Voir mes inscriptions" />
          <StatTile icon={Trophy} tone="bg-[#7c3aed]" value={certs.length} label={certs.length > 1 ? "Certificats obtenus" : "Certificat obtenu"} href="/app/certificats" linkLabel="Voir tous mes certificats" />
        </div>

        <Panel title="Mes formations en cours" action={{ href: "/app/formations", label: "Voir toutes mes formations" }}>
          {inProgress.length === 0 ? (
            <p className="text-sm text-muted">Aucune formation en cours. <Link href="/formations" className="font-semibold text-brand hover:underline">Parcourir le catalogue</Link></p>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {inProgress.slice(0, 3).map(({ course, progress }) => {
                const ui = categoryUi(course.category?.slug, course.category?.name);
                const modules = new Set(state.contents.filter((c) => c.course_id === course.id).map((c) => c.module_position)).size;
                return (
                  <CourseCard
                    key={course.id} title={course.title} href={`/app/formations/${course.id}`}
                    cover={course.cover_url ?? (ui.image ? publicImage(`home/${ui.image}`) : null)}
                    percent={progress.percent} modules={modules} showProgress={course.show_progress !== false}
                    doneHours={hours(progress.doneMinutes)} totalHours={hours(progress.totalMinutes)}
                  />
                );
              })}
            </div>
          )}
        </Panel>

        <div className="grid gap-6 lg:grid-cols-2">
          <Panel title="Mes prochaines échéances" action={{ href: "/app/evaluations", label: "Voir toutes" }}>
            <DeadlineList items={deadlines} />
          </Panel>
          <Panel title="Mes certificats récents" action={{ href: "/app/certificats", label: "Voir tous" }}>
            <CertificateList items={certificates} />
          </Panel>
        </div>
      </div>

      <aside className="space-y-6">
        <Journey percent={globalPercent} running={inProgress.length} completed={completed.length} certificates={certs.length} />
        <Panel title="Mon calendrier" action={{ href: "/app/inscriptions", label: "Voir tout" }}>
          <CalendarList items={calendar} />
        </Panel>
        <Panel title="Dernières activités" action={{ href: "/app/notifications", label: "Voir tout" }}>
          <ActivityList items={activity} now={now} />
        </Panel>
      </aside>
    </div>
  );
}

export default function LearnerHome() {
  return (
    <Suspense fallback={<div className="h-96 animate-pulse rounded-2xl bg-white" aria-hidden />}>
      <Dashboard />
    </Suspense>
  );
}
