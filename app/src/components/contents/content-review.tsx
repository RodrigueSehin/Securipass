import Link from "next/link";
import { Check, Clock, FileText, Info, Monitor, Settings, Smartphone, Link as LinkIcon, FileSearch } from "lucide-react";
import { RichText } from "@/components/ui/rich-text";
import type { Attachment, OwnContent } from "@/lib/contents/queries";
import { displayFileName } from "@/lib/contents/wizard";
import { CONTENT_TYPES, REQUIRED_LEVELS, type ContentType } from "@/lib/courses/labels";
import { formatBytes, formatDateTime, formatMinutes } from "@/lib/format";
import { CONTENT_TYPE_META } from "@/components/courses/content-type";
import { cn } from "@/lib/utils";

const ext = (name: string) => (name.split(".").pop() ?? "").toUpperCase();

function Recap({ title, icon: Icon, step, contentId, children }: {
  title: string; icon: typeof FileText; step: number; contentId: string; children: React.ReactNode;
}) {
  return (
    <section className="py-4 first:pt-0">
      <div className="mb-2 flex items-center justify-between gap-3">
        <h4 className="flex items-center gap-2 font-bold text-brand-dark"><Icon className="h-5 w-5 text-brand" aria-hidden /> {title}</h4>
        <Link href={`/formateur/contenus/nouveau/${contentId}?etape=${step}`} className="inline-flex items-center gap-1 text-sm font-semibold text-brand hover:underline">
          <Check className="h-4 w-4" aria-hidden /> Modifier
        </Link>
      </div>
      {children}
    </section>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[9rem_minmax(0,1fr)] gap-3 border-t border-line/60 py-2 text-sm">
      <dt className="text-muted">{label}</dt>
      <dd className="min-w-0 break-words text-brand-dark">{children}</dd>
    </div>
  );
}

function Pair({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-t border-line/60 py-2 text-sm">
      <dt className="text-muted">{label}</dt>
      <dd className="text-right font-medium text-brand-dark">{value}</dd>
    </div>
  );
}

const TABS = [["apprenant", "Vue apprenant", Monitor], ["mobile", "Vue mobile", Smartphone], ["details", "Détails techniques", Info]] as const;

/** Étape 4 : aperçu (vue apprenant, mobile, détails techniques) et récapitulatif avant publication. */
export function ContentReview({ content: c, attachments, view, error }: { content: OwnContent; attachments: Attachment[]; view: string; error?: string }) {
  const type = (c.content_type in CONTENT_TYPES ? c.content_type : "document") as ContentType;
  const meta = CONTENT_TYPE_META[type];
  const file = displayFileName(c.file_path, c.file_name);
  const files = attachments.filter((a) => a.kind === "file");
  const links = attachments.filter((a) => a.kind === "link");
  const active = TABS.some(([k]) => k === view) ? view : "apprenant";
  const typeLabel = file && ["document", "case_study", "practice"].includes(type) ? `${CONTENT_TYPES[type]} (${ext(file)})` : CONTENT_TYPES[type];
  const details: [string, string][] = [
    ["Fichier principal", file || "—"],
    ["Taille", c.file_size_bytes ? formatBytes(c.file_size_bytes) : "—"],
    ["Format", c.file_mime || "—"],
    ["Lien externe", c.external_url || "—"],
    ["Fichiers complémentaires", String(files.length)],
    ["Liens complémentaires", String(links.length)],
    ["Publication", c.publish_at ? formatDateTime(c.publish_at) : "Dès la publication"],
    ["Disponible jusqu’au", c.available_until ? formatDateTime(c.available_until) : "Sans limite"],
  ];
  const text = c.body || c.description;
  const Icon = meta.icon;

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_28rem]">
      <section className="space-y-4 rounded-2xl border border-line bg-white p-6 shadow-card">
        <div>
          <h3 className="flex items-center gap-3 text-lg font-bold text-brand-dark"><FileSearch className="h-6 w-6 text-brand" aria-hidden /> Aperçu du contenu</h3>
          <p className="text-sm text-muted">Voici un aperçu de la manière dont ce contenu sera affiché aux apprenants.</p>
        </div>
        <nav aria-label="Mode d’aperçu" className="grid grid-cols-3 overflow-hidden rounded-lg border border-line bg-surface">
          {TABS.map(([key, label, TabIcon]) => (
            <Link key={key} href={`/formateur/contenus/nouveau/${c.id}?etape=4&vue=${key}`} aria-current={key === active ? "page" : undefined} replace scroll={false}
              className={cn("inline-flex items-center justify-center gap-2 px-3 py-2.5 text-sm", key === active ? "bg-brand font-semibold text-white" : "text-brand-dark hover:bg-brand-soft")}>
              <TabIcon className="h-4 w-4" aria-hidden /> {label}
            </Link>
          ))}
        </nav>

        {active === "details" ? (
          <dl className="grid gap-3 text-sm sm:grid-cols-2">
            {details.map(([k, v]) => (
              <div key={k} className="rounded-lg border border-line p-3"><dt className="text-xs text-muted">{k}</dt><dd className="break-words font-medium text-brand-dark">{v}</dd></div>
            ))}
          </dl>
        ) : (
          <div className={cn("rounded-2xl bg-surface p-4", active === "mobile" && "mx-auto max-w-xs")}>
            <div className="rounded-xl bg-white p-4">
              <div className="flex flex-wrap items-center gap-3">
                <span className={cn("rounded px-2 py-1 text-xs font-bold uppercase", meta.badge)}>{file ? ext(file) : CONTENT_TYPES[type]}</span>
                <div className="min-w-0 flex-1">
                  <p className="font-bold text-brand-dark">{c.title}</p>
                  <p className="text-sm text-muted">Module {c.module.position} : {c.module.title}</p>
                </div>
                <span className="inline-flex items-center gap-1 rounded-lg border border-line px-2.5 py-1 text-xs text-brand-dark"><Clock className="h-3.5 w-3.5" aria-hidden />{formatMinutes(c.duration_minutes ?? 0)}</span>
                <span className={cn("rounded-lg px-2.5 py-1 text-xs font-semibold", c.is_required ? "bg-success/15 text-success" : "bg-surface text-muted")}>{c.is_required ? "Obligatoire" : "Facultatif"}</span>
              </div>
              <div className="mt-4 flex min-h-64 flex-col items-center justify-center gap-3 rounded-xl border border-line bg-brand-soft/50 p-6 text-center">
                <span className={cn("flex h-16 w-16 items-center justify-center rounded-2xl", meta.chip)}><Icon className="h-8 w-8" aria-hidden /></span>
                {file ? (
                  <>
                    <p className="font-semibold text-brand-dark">{file}</p>
                    <p className="text-xs text-muted">{c.file_size_bytes ? formatBytes(c.file_size_bytes) : ""} · l’apprenant ouvre le fichier depuis la page de la formation</p>
                  </>
                ) : c.external_url ? (
                  <p className="flex items-center gap-2 break-all text-sm text-brand-dark"><LinkIcon className="h-4 w-4 shrink-0 text-brand" aria-hidden />{c.external_url}</p>
                ) : <p className="text-sm text-muted">Aucun fichier ni lien principal.</p>}
              </div>
              {text && <div className="mt-4 rounded-xl border border-line p-4"><RichText text={text} className="text-sm text-brand-dark" /></div>}
            </div>
          </div>
        )}
        {error && <p role="alert" className="rounded-lg bg-danger/10 p-3 text-sm text-danger">{error}</p>}
      </section>

      <section className="rounded-2xl border border-line bg-white p-6 shadow-card">
        <div className="mb-4 flex items-start gap-3">
          <FileText className="mt-0.5 h-6 w-6 shrink-0 text-brand" aria-hidden />
          <div>
            <h3 className="text-lg font-bold text-brand-dark">Récapitulatif du contenu</h3>
            <p className="text-sm text-muted">Vérifiez les informations saisies avant de publier.</p>
          </div>
        </div>
        <div className="divide-y divide-line">
          <Recap title="Informations générales" icon={FileText} step={1} contentId={c.id}>
            <dl>
              <Row label="Titre">{c.title}</Row>
              <Row label="Type de contenu">{typeLabel}</Row>
              <Row label="Formation">{c.module.course.title}</Row>
              <Row label="Module">Module {c.module.position} : {c.module.title}</Row>
            </dl>
          </Recap>
          <Recap title="Contenu et fichier" icon={LinkIcon} step={2} contentId={c.id}>
            <dl>
              {text && <Row label="Description"><RichText text={text} className="text-sm" /></Row>}
              <Row label="Fichier principal">
                {file ? <span>{file}{c.file_size_bytes ? <span className="block text-xs text-muted">{formatBytes(c.file_size_bytes)}</span> : null}</span> : c.external_url || "Aucun"}
              </Row>
              <Row label="Fichiers complémentaires">
                {files.length === 0 ? "Aucun" : (
                  <ul className="space-y-1">{files.map((f) => <li key={f.id}>{f.name}<span className="block text-xs text-muted">{formatBytes(f.size_bytes)}</span></li>)}</ul>
                )}
              </Row>
            </dl>
          </Recap>
          <Recap title="Paramètres pédagogiques" icon={Settings} step={3} contentId={c.id}>
            <dl className="grid gap-x-6 sm:grid-cols-2">
              <Pair label="Durée estimée" value={formatMinutes(c.duration_minutes ?? 0)} />
              <Pair label="Niveau requis" value={REQUIRED_LEVELS[(c.required_level ?? "beginner") as keyof typeof REQUIRED_LEVELS]} />
              <Pair label="Position dans le module" value={String(c.position ?? 1)} />
              <Pair label="Contenu obligatoire" value={c.is_required ?? true ? "Oui" : "Non"} />
              <Pair label="Visible pour les apprenants" value={c.is_visible ?? true ? "Oui" : "Non"} />
              <Pair label="Autoriser le téléchargement" value={c.allow_download ?? true ? "Oui" : "Non"} />
              <Pair label="Commentaires" value={c.allow_comments ?? true ? "Autorisés" : "Désactivés"} />
              <Pair label="Disponible hors ligne" value="Non" />
            </dl>
          </Recap>
        </div>
      </section>
    </div>
  );
}
