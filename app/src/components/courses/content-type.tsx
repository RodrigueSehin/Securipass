import { CircleHelp, FileSearch, FileText, Link as LinkIcon, Play, Presentation, Type, Wrench, type LucideIcon } from "lucide-react";
import { CONTENT_TYPES, type ContentType } from "@/lib/courses/labels";
import { cn } from "@/lib/utils";

/** Icône et couleur de chaque type de contenu (libellés dans CONTENT_TYPES). */
export const CONTENT_TYPE_META: Record<ContentType, { icon: LucideIcon; badge: string; chip: string }> = {
  document: { icon: FileText, badge: "bg-danger/10 text-danger", chip: "bg-danger/10 text-danger" },
  quiz: { icon: CircleHelp, badge: "bg-[#f3e8ff] text-[#7c3aed]", chip: "bg-[#f3e8ff] text-[#7c3aed]" },
  case_study: { icon: FileSearch, badge: "bg-success/10 text-success", chip: "bg-success/10 text-success" },
  video: { icon: Play, badge: "bg-brand-soft text-brand", chip: "bg-brand-soft text-brand" },
  pdf: { icon: FileText, badge: "bg-danger/10 text-danger", chip: "bg-danger/10 text-danger" },
  presentation: { icon: Presentation, badge: "bg-[#f3e8ff] text-[#7c3aed]", chip: "bg-[#f3e8ff] text-[#7c3aed]" },
  link: { icon: LinkIcon, badge: "bg-success/10 text-success", chip: "bg-success/10 text-success" },
  text: { icon: Type, badge: "bg-surface text-muted", chip: "bg-surface text-muted" },
  practice: { icon: Wrench, badge: "bg-warning/15 text-[#a16207]", chip: "bg-warning/15 text-[#a16207]" },
};

export function ContentTypeBadge({ type }: { type: ContentType }) {
  const meta = CONTENT_TYPE_META[type];
  const Icon = meta.icon;
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-semibold", meta.badge)}>
      <Icon className="h-3.5 w-3.5" aria-hidden />
      {CONTENT_TYPES[type]}
    </span>
  );
}

/** Pastille d'icône, sans texte, pour la vignette d'un contenu. */
export function ContentTypeChip({ type, className }: { type: ContentType; className?: string }) {
  const meta = CONTENT_TYPE_META[type];
  const Icon = meta.icon;
  return (
    <span className={cn("flex h-10 w-14 shrink-0 items-center justify-center rounded-lg", meta.chip, className)} aria-hidden>
      <Icon className="h-5 w-5" />
    </span>
  );
}
