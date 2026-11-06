import { Suspense } from "react";
import Link from "next/link";
import { BarChart3, CalendarDays, CheckCircle2, ChevronLeft, ChevronRight, Clock, Download, Pencil, Plus, UserX, Users, XCircle } from "lucide-react";
import { AttendanceToolbar } from "@/components/admin/attendance-toolbar";
import { StatCard } from "@/components/admin/dashboard-widgets";
import { UsersPageSize } from "@/components/admin/users-toolbar";
import { Avatar } from "@/components/ui/avatar";
import { ButtonLink } from "@/components/ui/button";
import { Alert, EmptyState } from "@/components/ui/feedback";
import { ATTENDANCE_STATUS_UI, attendanceComment, attendanceRate, formatRate, parseAttendanceFilters, type AttendanceOptions, type AttendanceView } from "@/lib/admin/attendance";
import { loadAttendanceByCourse, loadAttendanceBySession, loadAttendanceList, loadAttendanceOptions, loadAttendanceStats } from "@/lib/admin/attendance-queries";
import { formatDayRange } from "@/lib/admin/sessions";
import { PAGE_SIZES, pageWindow } from "@/lib/admin/users";
import { cn } from "@/lib/utils";
import { AdminPageHeader } from "@/components/admin/admin-page-header";

export const metadata = { title: "Présences" };

const nf = new Intl.NumberFormat("fr-FR");
const RESULTS: Record<string, string> = { enregistre: "Les présences ont été enregistrées." };

type SP = Promise<{ vue?: string; formation?: string; session?: string; date?: string; page?: string; par?: string; resultat?: string }>;

/** Session affichée dans la liste : celle choisie, sinon la première qui contient la date, sinon la dernière commencée. */
function pickSession(opts: AttendanceOptions, course: string, session: string, date: string): string {
  if (session) return session;
  const pool = opts.sessions.filter((s) => !course || s.course_id === course);
  const byDate = date ? pool.find((s) => Date.parse(s.start_at) < Date.parse(`${date}T23:59:59Z`) && Date.parse(s.end_at) >= Date.parse(`${date}T00:00:00Z`)) : undefined;
  return (byDate ?? pool.find((s) => Date.parse(s.start_at) <= Date.now()) ?? pool[0])?.id ?? "";
}

async function Content({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const filters = parseAttendanceFilters(sp);
  const size = PAGE_SIZES.includes(Number(sp.par)) ? Number(sp.par) : PAGE_SIZES[0];
  const requested = Math.max(1, Math.floor(Number(sp.page)) || 1);
  const options = await loadAttendanceOptions();
  const sessionId = filters.view === "liste" ? pickSession(options, filters.course, filters.session, filters.date) : filters.session;

  const [stats, list, bySession, byCourse] = await Promise.all([
    loadAttendanceStats(filters.course, sessionId, filters.date),
    filters.view === "liste" && sessionId ? loadAttendanceList(sessionId, size, (requested - 1) * size) : null,
    filters.view === "seances" ? loadAttendanceBySession(filters.course, filters.date, size, (requested - 1) * size) : null,
    filters.view === "formations" ? loadAttendanceByCourse(size, (requested - 1) * size) : null,
  ]);
  const data = list ?? bySession ?? byCourse;
  if (stats === null || data?.failed) return <Alert>Impossible de charger les présences. Vérifiez que la migration 44 est appliquée, puis réessayez.</Alert>;

  const total = data?.total ?? 0;
  const pages = Math.max(1, Math.ceil(total / size));
  const page = Math.min(requested, pages);
  const from = total === 0 ? 0 : (page - 1) * size + 1;
  const to = Math.min(total, page * size);
  const rate = attendanceRate(stats.present, stats.enrolled);
  const absentRate = attendanceRate(stats.absent, stats.enrolled);

  const href = (over: Record<string, string | number | undefined>) => {
    const u = new URLSearchParams();
    const cur: Record<string, string | number | undefined> = {
      vue: filters.view === "liste" ? undefined : filters.view, formation: filters.course, session: filters.session, date: filters.date, par: size === PAGE_SIZES[0] ? undefined : size, ...over,
    };
    for (const [k, v] of Object.entries(cur)) if (v !== undefined && v !== "" && v !== 1) u.set(k, String(v));
    return `/admin/presences${u.size ? `?${u}` : ""}`;
  };
  const tabs: [AttendanceView, string][] = [["liste", "Liste des présences"], ["seances", "Synthèse par séance"], ["formations", "Synthèse par formation"]];
  const head = list?.session;
  const th = "px-3 py-3 font-semibold";

  return (
    <div className="space-y-6">
      <AdminPageHeader crumbs={[{ label: "Présences" }]} icon="calendar-check" title="Gestion des présences" description="Suivez et gérez la présence des apprenants par session et par formation."
        actions={<>
          <div className="flex flex-wrap gap-2">
          {head && <a href={`/admin/presences/export?session=${head.session_id}`} className="inline-flex items-center gap-2 rounded-lg border border-brand bg-white px-5 py-2.5 text-sm font-semibold text-brand hover:bg-brand-soft"><Download className="h-4 w-4" aria-hidden /> Exporter</a>}
          {sessionId && <ButtonLink href={`/admin/presences/enregistrer?session=${sessionId}`}><Plus className="h-4 w-4" aria-hidden /> Enregistrer les présences</ButtonLink>}
          </div>
        </>}
      />
      {sp.resultat && RESULTS[sp.resultat] && <Alert tone="success">{RESULTS[sp.resultat]}</Alert>}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard icon={Users} tone="blue" label="Apprenants inscrits" value={nf.format(stats.enrolled)} note="" />
        <StatCard icon={CheckCircle2} tone="green" label="Présents" value={nf.format(stats.present)} note={rate === null ? "" : formatRate(rate)} />
        <StatCard icon={UserX} tone="orange" label="Absents" value={nf.format(stats.absent)} note={absentRate === null ? "" : formatRate(absentRate)} />
        <StatCard icon={BarChart3} tone="purple" label="Taux de présence" value={formatRate(rate).replace(" %", " %")} note={stats.enrolled === 0 ? "" : `${nf.format(stats.present)} sur ${nf.format(stats.enrolled)} inscrits`} />
      </div>

      <section className="rounded-2xl border border-line bg-white p-5 shadow-card">
        <AttendanceToolbar values={{ ...filters, session: filters.view === "liste" ? filters.session : "" }} options={options} hidden={filters.view === "liste" ? {} : { vue: filters.view }} />
        <nav aria-label="Vue des présences" className="mt-5 flex flex-wrap gap-1 border-b border-line">
          {tabs.map(([key, label]) => (
            <Link key={key} href={href({ vue: key === "liste" ? undefined : key, page: 1 })} aria-current={filters.view === key ? "page" : undefined}
              className={cn("-mb-px border-b-2 px-4 py-2.5 text-sm font-semibold", filters.view === key ? "border-brand text-brand" : "border-transparent text-brand-dark hover:text-brand")}>{label}</Link>
          ))}
        </nav>

        {filters.view === "liste" && head && (
          <div className="mt-4 flex flex-wrap items-center justify-between gap-4 rounded-xl border border-line bg-brand-soft/40 p-4">
            <div className="flex items-center gap-3">
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-white text-brand"><CalendarDays className="h-6 w-6" aria-hidden /></span>
              <div><p className="text-lg font-extrabold text-brand-dark">{head.course_title}</p><p className="text-sm text-brand-dark/80">{head.title} | {formatDayRange(head.start_at, head.end_at, head.timezone)}</p></div>
            </div>
            <dl className="flex flex-wrap gap-6 text-center text-xs text-muted">
              {([["Inscrits", stats.enrolled], ["Présents", stats.present], ["Absents", stats.absent]] as const).map(([l, v]) => <div key={l}><dd className="text-lg font-extrabold text-brand-dark">{nf.format(v)}</dd><dt>{l}</dt></div>)}
              <div><dd className="text-lg font-extrabold text-brand-dark">{formatRate(rate)}</dd><dt>Taux de présence</dt></div>
            </dl>
          </div>
        )}

        {filters.view === "liste" && !sessionId ? (
          <div className="mt-4"><EmptyState title="Aucune session à afficher"><span className="text-sm text-muted">Créez une session pour suivre ses présences.</span></EmptyState></div>
        ) : total === 0 ? (
          <div className="mt-4"><EmptyState title="Aucun résultat"><Link href="/admin/presences" className="font-semibold text-brand hover:underline">Réinitialiser les filtres</Link></EmptyState></div>
        ) : (
          <div className="mt-4 overflow-x-auto rounded-xl border border-line">
            {list && (
              <table className="w-full min-w-[56rem] text-left text-sm">
                <thead className="bg-surface text-xs text-brand-dark"><tr>
                  <th scope="col" className={th}>#</th><th scope="col" className={th}>Apprenant</th><th scope="col" className={th}>Matricule</th><th scope="col" className={th}>Entreprise</th>
                  <th scope="col" className={th}>Statut de présence</th><th scope="col" className={th}>Heure d’arrivée</th><th scope="col" className={th}>Heure de départ</th><th scope="col" className={th}>Commentaires</th><th scope="col" className={th}>Actions</th>
                </tr></thead>
                <tbody>
                  {list.rows.map((r, i) => {
                    const st = r.status ? ATTENDANCE_STATUS_UI[r.status] : null;
                    const comment = attendanceComment(r);
                    return (
                      <tr key={r.learner_id} className="border-t border-line">
                        <td className="px-3 py-3 text-muted">{(page - 1) * size + i + 1}</td>
                        <td className="px-3 py-3"><div className="flex items-center gap-3"><Avatar name={r.full_name} src={r.avatar_url} size={40} /><div><p className="font-bold text-brand-dark">{r.full_name}</p><p className="text-xs text-muted">Apprenant</p></div></div></td>
                        <td className="px-3 py-3 text-brand-dark">{r.learner_code ?? "—"}</td>
                        <td className="px-3 py-3 text-brand-dark">{r.organization ?? <span className="text-muted">Particulier</span>}</td>
                        <td className="px-3 py-3">{st ? <span className={cn("inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold", st.tone)}>{r.status === "present" || r.status === "late" ? <CheckCircle2 className="h-4 w-4" aria-hidden /> : <XCircle className="h-4 w-4" aria-hidden />}{st.label}</span> : <span className="inline-flex items-center gap-1.5 text-xs text-muted"><Clock className="h-4 w-4" aria-hidden />Non saisi</span>}</td>
                        <td className="px-3 py-3 text-brand-dark">{r.check_in ?? "–"}</td>
                        <td className="px-3 py-3 text-brand-dark">{r.check_out ?? "–"}</td>
                        <td className="px-3 py-3">{comment ? <span className="rounded-md bg-brand-soft px-2.5 py-1 text-xs text-brand-dark">{comment}</span> : <span className="text-muted">–</span>}</td>
                        <td className="px-3 py-3"><Link href={`/admin/presences/enregistrer?session=${sessionId}#l-${r.learner_id}`} aria-label={`Modifier la présence de ${r.full_name}`} className="inline-flex rounded-lg p-2 text-brand hover:bg-brand-soft"><Pencil className="h-4 w-4" aria-hidden /></Link></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
            {(bySession || byCourse) && (
              <table className="w-full min-w-[44rem] text-left text-sm">
                <thead className="bg-surface text-xs text-brand-dark"><tr>
                  <th scope="col" className={th}>{bySession ? "Session" : "Formation"}</th>{bySession && <th scope="col" className={th}>Formation</th>}
                  <th scope="col" className={th}>{bySession ? "Dates" : "Sessions"}</th><th scope="col" className={th}>Inscrits</th><th scope="col" className={th}>Présents</th><th scope="col" className={th}>Absents</th><th scope="col" className={th}>Taux de présence</th>
                </tr></thead>
                <tbody>
                  {(bySession ?? byCourse)!.rows.map((r) => {
                    const rt = attendanceRate(r.present, r.enrolled);
                    return (
                      <tr key={r.id} className="border-t border-line">
                        <td className="px-3 py-3 font-bold text-brand-dark">{bySession ? <Link href={`/admin/presences?session=${r.id}`} className="hover:text-brand hover:underline">{r.title}</Link> : r.title}</td>
                        {bySession && <td className="px-3 py-3 text-brand-dark">{r.course_title}</td>}
                        <td className="whitespace-nowrap px-3 py-3 text-brand-dark">{bySession && r.start_at && r.end_at && r.timezone ? formatDayRange(r.start_at, r.end_at, r.timezone) : r.sessions}</td>
                        <td className="px-3 py-3">{nf.format(r.enrolled)}</td><td className="px-3 py-3 text-success">{nf.format(r.present)}</td><td className="px-3 py-3 text-danger">{nf.format(r.absent)}</td>
                        <td className="px-3 py-3 font-semibold text-brand-dark">{formatRate(rt)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        )}

        {total > 0 && (
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm text-brand-dark">
            <p>Affichage de {nf.format(from)} à {nf.format(to)} sur {nf.format(total)} {filters.view === "liste" ? "apprenant" : filters.view === "seances" ? "séance" : "formation"}{total > 1 ? "s" : ""}</p>
            <nav aria-label="Pagination" className="flex items-center gap-1">
              {page > 1 ? <Link href={href({ page: page - 1 })} aria-label="Page précédente" className="rounded-lg border border-line p-2 hover:bg-brand-soft"><ChevronLeft className="h-4 w-4" aria-hidden /></Link>
                : <span aria-hidden className="rounded-lg border border-line p-2 opacity-40"><ChevronLeft className="h-4 w-4" /></span>}
              {pageWindow(page, pages).map((n, i) => n === "…"
                ? <span key={`e${i}`} className="px-1 text-muted">…</span>
                : <Link key={n} href={href({ page: n })} aria-current={n === page ? "page" : undefined} className={cn("min-w-9 rounded-lg border px-2.5 py-2 text-center font-semibold", n === page ? "border-brand bg-brand text-white" : "border-line hover:bg-brand-soft")}>{n}</Link>)}
              {page < pages ? <Link href={href({ page: page + 1 })} aria-label="Page suivante" className="rounded-lg border border-line p-2 hover:bg-brand-soft"><ChevronRight className="h-4 w-4" aria-hidden /></Link>
                : <span aria-hidden className="rounded-lg border border-line p-2 opacity-40"><ChevronRight className="h-4 w-4" /></span>}
            </nav>
            <UsersPageSize value={size} options={PAGE_SIZES} hrefs={Object.fromEntries(PAGE_SIZES.map((n) => [n, href({ par: n === PAGE_SIZES[0] ? undefined : n, page: 1 })]))} />
          </div>
        )}
      </section>
    </div>
  );
}

export default function AttendancePage({ searchParams }: { searchParams: SP }) {
  return (
    <Suspense fallback={<div className="h-96 animate-pulse rounded-2xl bg-white" aria-hidden />}>
      <Content searchParams={searchParams} />
    </Suspense>
  );
}
