import Image from "next/image";
import Link from "next/link";
import { ArrowRight, BookOpen, Clock, Eye, Layers, RotateCcw, ShieldCheck, Trash, FileText, EllipsisVertical } from "lucide-react";
import { cancelEnrollment } from "@/lib/enrollments/actions";
import { LIST_STATUS_LABEL, type ListStatus } from "@/lib/learner/formations";
import { Panel } from "./dashboard-parts";
import { ProgressRing } from "./progress-ring";
import { Stars } from "@/components/ui/stars";
import { cn } from "@/lib/utils";

const BADGE: Record<ListStatus, string> = {
  in_progress: "bg-brand text-white",
  completed: "bg-success text-white",
  waiting: "bg-cta text-white",
  abandoned: "bg-danger text-white",
};

const BAR: Record<ListStatus, string> = {
  in_progress: "bg-brand",
  completed: "bg-success",
  waiting: "bg-brand",
  abandoned: "bg-brand",
};

export type FormationRow = {
  id: string;
  enrollmentId: string;
  title: string;
  summary: string;
  cover: string | null;
  status: ListStatus;
  percent: number;
  modules: number;
  doneHours: string;
  totalHours: string;
  certifying: boolean;
  /** Libellé et valeur de la date mise en avant (fin prévue, terminée le, début prévu, dernière activité). */
  dateLabel: string | null;
  dateValue: string | null;
  openHref: string;
  certificateHref: string | null;
  /** Désinscription possible (inscription active ou en attente). */
  cancellable: boolean;
  /** La formation affiche la progression aux apprenants. */
  showProgress: boolean;
};

function Action({ row }: { row: FormationRow }) {
  const base = "flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold";
  const outline = `${base} border border-brand bg-white text-brand hover:bg-brand-soft`;
  if (row.status === "completed") {
    return row.certificateHref
      ? <Link href={row.certificateHref} className={outline}><FileText className="h-4 w-4" aria-hidden /> Voir le certificat</Link>
      : <Link href={row.openHref} className={outline}><BookOpen className="h-4 w-4" aria-hidden /> Revoir la formation</Link>;
  }
  if (row.status === "waiting") return <Link href="/app/inscriptions" className={outline}><Eye className="h-4 w-4" aria-hidden /> Voir les détails</Link>;
  if (row.status === "abandoned") return <Link href={row.openHref} className={outline}><RotateCcw className="h-4 w-4" aria-hidden /> Reprendre la formation</Link>;
  return (
    <Link href={row.openHref} className={`${base} bg-cta text-white hover:bg-cta-dark`}>
      {row.percent === 0 ? "Commencer la formation" : "Continuer la formation"} <ArrowRight className="h-4 w-4" aria-hidden />
    </Link>
  );
}

export function FormationItem({ row }: { row: FormationRow }) {
  return (
    <li className="grid gap-4 border-b border-line p-4 last:border-b-0 md:grid-cols-[13rem_minmax(0,1fr)_14rem]">
      <div className="relative h-36 overflow-hidden rounded-xl bg-[linear-gradient(135deg,#092a66,#0639d9)] md:h-full md:min-h-32">
        {row.cover ? (
          <Image src={row.cover} alt="" fill sizes="(min-width: 768px) 13rem, 100vw" className="object-cover" unoptimized={row.cover.startsWith("http")} />
        ) : (
          <BookOpen className="absolute inset-0 m-auto h-10 w-10 text-white/80" aria-hidden />
        )}
        <span className={cn("absolute left-2 top-2 rounded-full px-3 py-1 text-xs font-bold", BADGE[row.status])}>{LIST_STATUS_LABEL[row.status]}</span>
      </div>

      <div className="min-w-0">
        <h2 className="text-lg font-bold text-brand-dark">{row.title}</h2>
        <p className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted">
          <span className="flex items-center gap-1"><Layers className="h-3.5 w-3.5 text-brand" aria-hidden />{row.modules} module{row.modules > 1 ? "s" : ""}</span>
          <span className="flex items-center gap-1"><Clock className="h-3.5 w-3.5 text-brand" aria-hidden />{row.status === "waiting" ? "-" : `${row.doneHours}/${row.totalHours} heures`}</span>
          {row.certifying && <span className="flex items-center gap-1"><ShieldCheck className="h-3.5 w-3.5 text-brand" aria-hidden />Certifiante</span>}
        </p>
        {row.summary && <p className="mt-2 line-clamp-2 text-sm text-muted">{row.summary}</p>}
        {row.showProgress && (
          <div className="mt-3 flex items-center gap-3">
            <div className="h-2 flex-1 overflow-hidden rounded-full bg-surface" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={row.percent} aria-label={`Progression de ${row.title}`}>
              <div className={cn("h-full rounded-full", BAR[row.status])} style={{ width: `${row.percent}%` }} />
            </div>
            <span className="w-10 text-right text-xs font-bold text-brand-dark">{row.percent}%</span>
          </div>
        )}
      </div>

      <div className="flex flex-col gap-3">
        <div className="flex items-start justify-between gap-2">
          {row.dateLabel && row.dateValue ? (
            <div className="rounded-lg bg-surface/70 px-3 py-2">
              <p className="text-xs text-muted">{row.dateLabel}</p>
              <p className="text-sm font-bold text-brand-dark">{row.dateValue}</p>
            </div>
          ) : <span />}
          <details className="relative">
            <summary aria-label={`Autres actions pour ${row.title}`} className="flex cursor-pointer list-none rounded-lg p-1.5 text-muted hover:bg-surface [&::-webkit-details-marker]:hidden">
              <EllipsisVertical className="h-5 w-5" aria-hidden />
            </summary>
            <div className="absolute right-0 z-10 mt-1 w-52 rounded-xl border border-line bg-white py-1 shadow-card">
              <Link href={row.openHref} className="flex items-center gap-2 px-3 py-2 text-sm text-brand-dark hover:bg-surface"><BookOpen className="h-4 w-4" aria-hidden /> Ouvrir la formation</Link>
              {row.cancellable && (
                <form action={cancelEnrollment}>
                  <input type="hidden" name="enrollmentId" value={row.enrollmentId} />
                  <input type="hidden" name="returnTo" value="/app/formations" />
                  <button className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-danger hover:bg-surface"><Trash className="h-4 w-4" aria-hidden /> Annuler mon inscription</button>
                </form>
              )}
            </div>
          </details>
        </div>
        <Action row={row} />
      </div>
    </li>
  );
}

export function GlobalJourney({ percent, counts, doneHours, totalHours }: {
  percent: number; counts: { running: number; completed: number; waiting: number; abandoned: number }; doneHours: string; totalHours: string;
}) {
  const stats: [number, string][] = [
    [counts.running, "Formations en cours"],
    [counts.completed, counts.completed > 1 ? "Formations terminées" : "Formation terminée"],
    [counts.waiting, "En attente"],
    [counts.abandoned, counts.abandoned > 1 ? "Abandonnées" : "Abandonnée"],
  ];
  return (
    <Panel title="Mon parcours global">
      <div className="flex items-center gap-4">
        <ProgressRing percent={percent} label="Progression globale" size="h-28 w-28 shrink-0" />
        <ul className="space-y-1.5 text-sm">
          {stats.map(([n, l]) => (
            <li key={l} className="flex items-baseline gap-2"><span className="text-lg font-extrabold text-brand">{n}</span><span className="text-muted">{l}</span></li>
          ))}
        </ul>
      </div>
      <p className="mt-4 text-sm text-brand-dark"><strong>{doneHours} / {totalHours}</strong> heures réalisées</p>
      <div className="mt-2 flex items-center gap-3">
        <div className="h-2 flex-1 overflow-hidden rounded-full bg-surface" aria-hidden><div className="h-full rounded-full bg-brand" style={{ width: `${percent}%` }} /></div>
        <span className="text-sm font-bold text-brand-dark">{percent}%</span>
      </div>
    </Panel>
  );
}

const COMPETENCY_STYLE = ["bg-[#7c3aed]", "bg-success", "bg-danger", "bg-warning"];

export function Competencies({ items }: { items: { name: string; percent: number; level: string }[] }) {
  return (
    <Panel title="Mes compétences">
      {items.length === 0 ? (
        <p className="text-sm text-muted">Les compétences visées par vos formations apparaîtront ici.</p>
      ) : (
        <ul className="space-y-4">
          {items.map((c, i) => (
            <li key={c.name} className="flex items-center gap-3">
              <span className={cn("flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-white", COMPETENCY_STYLE[i % COMPETENCY_STYLE.length])}>
                <ShieldCheck className="h-5 w-5" aria-hidden />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold text-brand-dark">{c.name}</p>
                <p className="text-xs text-muted">Niveau {c.level.toLowerCase()}</p>
                <div className="mt-1 flex items-center gap-2">
                  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface" aria-hidden><div className="h-full rounded-full bg-brand" style={{ width: `${c.percent}%` }} /></div>
                  <span className="w-9 text-right text-xs font-bold text-brand-dark">{c.percent}%</span>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

export type Recommendation = {
  id: string; title: string; slug: string; cover: string | null; durationLabel: string; rating: { average: number; total: number } | null;
};

export function Recommended({ items }: { items: Recommendation[] }) {
  return (
    <Panel title="Formations recommandées" action={{ href: "/app/catalogue", label: "Voir tout" }}>
      {items.length === 0 ? (
        <p className="text-sm text-muted">Aucune autre formation à vous proposer pour le moment.</p>
      ) : (
        <ul className="space-y-4">
          {items.map((r) => (
            <li key={r.id} className="flex items-center gap-3">
              <span className="relative h-16 w-20 shrink-0 overflow-hidden rounded-lg bg-[linear-gradient(135deg,#092a66,#0639d9)]">
                {r.cover ? <Image src={r.cover} alt="" fill sizes="80px" className="object-cover" unoptimized={r.cover.startsWith("http")} /> : <BookOpen className="absolute inset-0 m-auto h-6 w-6 text-white/80" aria-hidden />}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold leading-snug text-brand-dark">{r.title}</p>
                {r.rating && (
                  <p className="mt-0.5 flex items-center gap-1.5 text-xs text-muted">
                    <Stars value={r.rating.average} />
                    <span>{r.rating.average.toLocaleString("fr-FR")} ({r.rating.total})</span>
                  </p>
                )}
                <p className="text-xs text-muted">{r.durationLabel}</p>
              </div>
              <Link href={`/formations/${r.slug}`} className="shrink-0 rounded-lg border border-brand px-3 py-1.5 text-xs font-semibold text-brand hover:bg-brand-soft">Découvrir</Link>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}
