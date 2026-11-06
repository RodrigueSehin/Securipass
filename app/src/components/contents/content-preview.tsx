import { Clock, FileText, Link as LinkIcon, Play } from "lucide-react";
import { ContentTypeChip } from "@/components/courses/content-type";
import { RichText } from "@/components/ui/rich-text";
import { CONTENT_TYPES, REQUIRED_LEVELS, type ContentType } from "@/lib/courses/labels";
import { formatBytes, formatMinutes } from "@/lib/format";
import { displayFileName } from "@/lib/contents/wizard";

export type PreviewData = {
  type: string; title: string; description?: string; durationMinutes?: number; level?: string; required?: boolean;
  courseTitle?: string; moduleTitle?: string; filePath?: string; fileName?: string; fileSize?: number | null; externalUrl?: string;
};

const known = (t: string): t is ContentType => t in CONTENT_TYPES;

/** Aperçu « vue apprenant » d'un contenu : vignette, titre, durée, niveau et média principal. */
export function ContentPreview({ data, heading = "Aperçu du contenu" }: { data: PreviewData; heading?: string }) {
  const type: ContentType = known(data.type) ? data.type : "document";
  const file = displayFileName(data.filePath, data.fileName);
  const media = file || data.externalUrl;
  return (
    <section aria-label={heading} className="rounded-2xl border border-line bg-white p-5 shadow-card">
      <h3 className="mb-3 text-base font-bold text-brand-dark">{heading}</h3>
      <div className="overflow-hidden rounded-xl border border-line">
        <div className="flex h-36 items-center justify-center bg-brand-soft">
          {type === "video" ? <Play className="h-12 w-12 text-brand" aria-hidden /> : <ContentTypeChip type={type} className="h-16 w-20" />}
        </div>
        <div className="space-y-2 p-4">
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="rounded-md bg-brand-soft px-2 py-1 font-semibold text-brand">{CONTENT_TYPES[type]}</span>
            {data.required !== undefined && (
              <span className={data.required ? "rounded-md bg-danger/10 px-2 py-1 font-semibold text-danger" : "rounded-md bg-surface px-2 py-1 font-semibold text-muted"}>
                {data.required ? "Obligatoire" : "Facultatif"}
              </span>
            )}
          </div>
          <p className="text-base font-bold text-brand-dark">{data.title || "Titre du contenu"}</p>
          {data.description && <RichText text={data.description} className="line-clamp-4 text-sm text-muted" />}
          <p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted">
            {data.durationMinutes ? <span className="inline-flex items-center gap-1"><Clock className="h-3.5 w-3.5" aria-hidden />{formatMinutes(data.durationMinutes)}</span> : null}
            {data.level && <span>Niveau : {REQUIRED_LEVELS[data.level as keyof typeof REQUIRED_LEVELS] ?? data.level}</span>}
          </p>
          {(data.courseTitle || data.moduleTitle) && (
            <p className="text-xs text-muted">{[data.courseTitle, data.moduleTitle].filter(Boolean).join(" › ")}</p>
          )}
          {media && (
            <p className="flex items-center gap-2 rounded-lg border border-line p-2 text-xs text-brand-dark">
              {file ? <FileText className="h-4 w-4 shrink-0 text-danger" aria-hidden /> : <LinkIcon className="h-4 w-4 shrink-0 text-brand" aria-hidden />}
              <span className="min-w-0 flex-1 truncate">{file || data.externalUrl}</span>
              {file && data.fileSize ? <span className="shrink-0 text-muted">{formatBytes(data.fileSize)}</span> : null}
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
