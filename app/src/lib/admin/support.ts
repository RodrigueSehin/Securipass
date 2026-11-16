import { z } from "zod";

/** Support : libellés, filtres, délais et formulaire de création (pur : testé unitairement). */

export const SUPPORT_CATEGORIES = {
  formations: "Formations", paiements: "Paiements", certifications: "Certifications", sessions: "Sessions", compte: "Compte",
  documents: "Documents", technique: "Technique", utilisateurs: "Utilisateurs", evaluations: "Évaluations", autres: "Autres",
} as const;
export type SupportCategory = keyof typeof SUPPORT_CATEGORIES;
export const SUPPORT_CATEGORY_KEYS = Object.keys(SUPPORT_CATEGORIES) as [SupportCategory, ...SupportCategory[]];

export const SUPPORT_PRIORITIES = {
  high: { label: "Haute", tone: "bg-danger/10 text-danger", dot: "bg-danger" },
  medium: { label: "Moyenne", tone: "bg-warning/15 text-[#a16207]", dot: "bg-cta" },
  low: { label: "Basse", tone: "bg-brand-soft text-brand", dot: "bg-brand" },
} as const;
export type SupportPriority = keyof typeof SUPPORT_PRIORITIES;
export const SUPPORT_PRIORITY_KEYS = Object.keys(SUPPORT_PRIORITIES) as [SupportPriority, ...SupportPriority[]];

export const SUPPORT_STATUS = {
  new: { label: "Nouveau", tone: "bg-brand-soft text-brand" },
  in_progress: { label: "En cours", tone: "bg-warning/15 text-[#a16207]" },
  waiting: { label: "En attente", tone: "bg-danger/10 text-danger" },
  resolved: { label: "Résolu", tone: "bg-success/15 text-success" },
  archived: { label: "Archivé", tone: "bg-surface text-muted" },
} as const;
export type SupportStatus = keyof typeof SUPPORT_STATUS;

export const SUPPORT_TABS = { all: "Tous les tickets", mine: "Mes tickets", unassigned: "Non assignés", resolved: "Résolus", archived: "Archivés" } as const;
export type SupportTab = keyof typeof SUPPORT_TABS;

export const SUPPORT_PAGE_SIZES = [10, 20, 50, 100];

/** Délai de résolution visé selon la priorité (heures) : le même barème que la base. */
export const SLA_HOURS: Record<SupportPriority, number> = { high: 8, medium: 24, low: 72 };

export type SupportFilters = { tab: SupportTab; q: string; category: SupportCategory | ""; status: SupportStatus | ""; priority: SupportPriority | "" };

/** Valeurs de filtre acceptées (paramètres d'URL) : tout le reste est ignoré. */
export function parseSupportFilters(sp: { onglet?: string; q?: string; categorie?: string; statut?: string; priorite?: string }): SupportFilters {
  return {
    tab: sp.onglet && Object.hasOwn(SUPPORT_TABS, sp.onglet) ? (sp.onglet as SupportTab) : "all",
    q: sp.q?.trim().slice(0, 100) ?? "",
    category: sp.categorie && Object.hasOwn(SUPPORT_CATEGORIES, sp.categorie) ? (sp.categorie as SupportCategory) : "",
    status: sp.statut && Object.hasOwn(SUPPORT_STATUS, sp.statut) ? (sp.statut as SupportStatus) : "",
    priority: sp.priorite && Object.hasOwn(SUPPORT_PRIORITIES, sp.priorite) ? (sp.priorite as SupportPriority) : "",
  };
}

/** Durée affichée : « 6h 24min », « 45min », « 2j 5h » ; « — » sans donnée. */
export function formatDelay(seconds: number | null | undefined): string {
  if (seconds === null || seconds === undefined || !Number.isFinite(seconds)) return "—";
  const min = Math.round(seconds / 60);
  if (min < 1) return "< 1min";
  if (min < 60) return `${min}min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h}h ${String(min % 60).padStart(2, "0")}min`;
  return `${Math.floor(h / 24)}j ${h % 24}h`;
}

/** Part de chaque catégorie : les cinq premières, puis « Autres » (le reste, y compris la catégorie « autres »). */
export function categoryShares(categories: { category: string; count: number }[], total: number): { key: string; label: string; count: number; percent: number }[] {
  if (total <= 0) return [];
  const sorted = [...categories].filter((c) => c.category !== "autres").sort((a, b) => b.count - a.count);
  const top = sorted.slice(0, 5);
  const others = total - top.reduce((n, c) => n + c.count, 0);
  const items = [...top.map((c) => ({ key: c.category, label: SUPPORT_CATEGORIES[c.category as SupportCategory] ?? c.category, count: c.count })), ...(others > 0 ? [{ key: "autres", label: "Autres", count: others }] : [])];
  return items.map((i) => ({ ...i, percent: Math.round((i.count / total) * 100) }));
}

export const SUBJECT_MAX = 200;
export const DESCRIPTION_MAX = 4000;

export const createTicketSchema = z.object({
  requesterId: z.string().uuid("Choisissez le demandeur"),
  category: z.enum(SUPPORT_CATEGORY_KEYS, { error: "Catégorie requise" }),
  priority: z.enum(SUPPORT_PRIORITY_KEYS, { error: "Priorité requise" }),
  courseId: z.string().uuid().optional().or(z.literal("")).transform((v) => v || null),
  subject: z.string().trim().min(3, "Sujet requis (3 caractères au moins)").max(SUBJECT_MAX, `${SUBJECT_MAX} caractères au maximum`),
  description: z.string().trim().max(DESCRIPTION_MAX, `${DESCRIPTION_MAX} caractères au maximum`).optional().transform((v) => v || null),
});

export type SupportRow = {
  ord: number; id: string; reference: string; subject: string; category: SupportCategory; priority: SupportPriority; status: SupportStatus;
  created_at: string; updated_at: string; requester_id: string; requester_name: string; requester_avatar: string | null; requester_code: string | null;
  assigned_to: string | null; assignee_name: string | null;
};
export type SupportStats = {
  total: number; total_month: number; total_prev: number; new: number; in_progress: number; waiting: number; resolved: number; archived: number;
  tabs: Record<SupportTab, number>; avg_seconds: number | null; avg_month: number | null; avg_prev: number | null;
  sla: number | null; sla_month: number | null; sla_prev: number | null; categories: { category: string; count: number }[];
};
export type SupportRequester = { id: string; name: string; email: string; code: string | null };

export const MESSAGE_MAX = 5000;
export const messageSchema = z.object({
  ticketId: z.string().uuid("Ticket invalide"),
  body: z.string().trim().min(1, "Écrivez un message").max(MESSAGE_MAX, `${MESSAGE_MAX} caractères au maximum`),
  internal: z.enum(["0", "1"]).optional().transform((v) => v === "1"),
});

export const FILE_MAX_MB = 10;
export const FILE_TYPES = ["application/pdf", "image/jpeg", "image/png", "image/webp", "text/plain"] as const;
export const isAllowedFile = (type: string, size: number) => (FILE_TYPES as readonly string[]).includes(type) && size > 0 && size <= FILE_MAX_MB * 1024 * 1024;

/** Taille affichée : « 504 Ko », « 1,2 Mo ». */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} Ko`;
  return `${(bytes / (1024 * 1024)).toLocaleString("fr-FR", { maximumFractionDigits: 1 })} Mo`;
}

export type SupportMessage = { id: string; author_id: string; author_name: string; author_avatar: string | null; internal: boolean; body: string; created_at: string; is_requester: boolean };
export type SupportFile = { id: string; name: string; size: number; mime: string | null; created_at: string; uploader_name: string | null; uploader_avatar: string | null; is_requester: boolean | null };
export type SupportDetail = {
  ticket: {
    id: string; reference: string; subject: string; description: string | null; category: SupportCategory; priority: SupportPriority; status: SupportStatus;
    created_at: string; updated_at: string; resolved_at: string | null; assigned_to: string | null; course_id: string | null; course_title: string | null;
  };
  requester: { id: string; name: string; email: string; phone: string | null; avatar_url: string | null; code: string | null };
  messages: SupportMessage[];
  files: SupportFile[];
};
export type SupportStaff = { id: string; name: string };

// ---------------------------------------------------------------------------------------------------------------------
// Historique

export const HISTORY_FILTERS = {
  all: "Tous les événements", creation: "Création", statut: "Statut", priorite: "Priorité", assignation: "Assignation",
  messages: "Messages et notes", categorie: "Catégorie", fichiers: "Pièces jointes",
} as const;
export type HistoryFilter = keyof typeof HISTORY_FILTERS;
export type HistoryKind = Exclude<HistoryFilter, "all">;
export const parseHistoryFilter = (v: string | undefined): HistoryFilter => (v && Object.hasOwn(HISTORY_FILTERS, v) ? (v as HistoryFilter) : "all");

export type HistoryEvent = {
  id: number; action: string; occurred_at: string; metadata: Record<string, unknown>;
  actor_id: string | null; actor_name: string | null; actor_avatar: string | null; actor_is_requester: boolean;
  from_name: string | null; to_name: string | null; excerpt: string | null;
};
export type HistoryIcon = "plus" | "copy" | "check" | "chat" | "note" | "refresh" | "user" | "tag" | "paperclip" | "archive" | "reopen";
export type HistoryEntry = {
  id: number; kind: HistoryKind; icon: HistoryIcon; tone: "success" | "brand" | "purple" | "orange" | "muted"; highlight: boolean; title: string; detail: string;
  at: string; actorName: string; actorAvatar: string | null; actorBadge: "Support" | "Demandeur" | "Système";
};

const statusLabel = (v: unknown) => (typeof v === "string" && Object.hasOwn(SUPPORT_STATUS, v) ? SUPPORT_STATUS[v as SupportStatus].label : String(v ?? "—"));
const priorityLabel = (v: unknown) => (typeof v === "string" && Object.hasOwn(SUPPORT_PRIORITIES, v) ? SUPPORT_PRIORITIES[v as SupportPriority].label : String(v ?? "—"));
const categoryLabel = (v: unknown) => (typeof v === "string" && Object.hasOwn(SUPPORT_CATEGORIES, v) ? SUPPORT_CATEGORIES[v as SupportCategory] : String(v ?? "—"));
const excerptOf = (s: string | null, fallback: string) => (s ? (s.length >= 140 ? `${s}…` : s) : fallback);
const CLOSED = ["resolved", "archived"];

/** Traduit une ligne du journal d'audit du ticket en événement lisible : titre, détail, pictogramme et auteur. */
export function describeEvent(e: HistoryEvent): HistoryEntry {
  const m = e.metadata ?? {};
  const base = {
    id: e.id, at: e.occurred_at, actorName: e.actor_name ?? "Système", actorAvatar: e.actor_avatar,
    actorBadge: (e.actor_is_requester ? "Demandeur" : e.actor_id ? "Support" : "Système") as HistoryEntry["actorBadge"], highlight: false,
  };
  const entry = (kind: HistoryKind, icon: HistoryIcon, tone: HistoryEntry["tone"], title: string, detail: string, highlight = false): HistoryEntry => ({ ...base, kind, icon, tone, title, detail, highlight });
  switch (e.action) {
    case "support.create": return entry("creation", "plus", "success", "Ticket créé", "Demande initiale de l’utilisateur.");
    case "support.duplicate": return entry("creation", "copy", "success", "Ticket dupliqué", `Copie du ticket ${String(m.from ?? "")}.`.replace(" .", "."));
    case "support.priority": return entry("priorite", "note", "purple", "Priorité mise à jour", `La priorité est passée de « ${priorityLabel(m.from)} » à « ${priorityLabel(m.to)} ».`);
    case "support.category": return entry("categorie", "tag", "purple", "Catégorie mise à jour", `La catégorie est passée de « ${categoryLabel(m.from)} » à « ${categoryLabel(m.to)} ».`);
    case "support.status": {
      if (m.to === "resolved") return entry("statut", "check", "success", "Ticket résolu", "Le ticket a été marqué comme « Résolu ».", true);
      if (m.to === "archived") return entry("statut", "archive", "muted", "Ticket archivé", "Le ticket a été archivé.");
      if (CLOSED.includes(String(m.from))) return entry("statut", "reopen", "orange", "Ticket rouvert", `Le ticket est repassé à « ${statusLabel(m.to)} ».`);
      return entry("statut", "refresh", "orange", "Statut mis à jour", `Le statut est passé de « ${statusLabel(m.from)} » à « ${statusLabel(m.to)} ».`);
    }
    case "support.assign": return entry("assignation", "user", "brand", "Ticket pris en charge", `Ticket affecté à ${e.actor_name ?? "un membre de l’équipe"}.`);
    case "support.unassign": return entry("assignation", "user", "brand", "Assignation retirée", e.from_name ? `Le ticket n’est plus assigné à ${e.from_name}.` : "Le ticket n’est plus assigné.");
    case "support.reassign": return e.to_name
      ? entry("assignation", "user", "brand", "Ticket réassigné", `Ticket affecté à ${e.to_name}.`)
      : entry("assignation", "user", "brand", "Assignation retirée", e.from_name ? `Le ticket n’est plus assigné à ${e.from_name}.` : "Le ticket n’est plus assigné.");
    case "support.reply": return entry("messages", "chat", "brand", "Réponse envoyée à l’utilisateur", excerptOf(e.excerpt, "Message de réponse ajouté dans la conversation."));
    case "support.note": return entry("messages", "note", "purple", "Note interne ajoutée", excerptOf(e.excerpt, "Note ajoutée à la conversation."));
    case "support.note.edit": return entry("messages", "note", "purple", "Note interne modifiée", excerptOf(e.excerpt, "Une note interne a été modifiée."));
    case "support.note.delete": return entry("messages", "note", "muted", "Note interne supprimée", "Une note interne a été supprimée.");
    case "support.file.add": return entry("fichiers", "paperclip", "brand", "Pièce jointe ajoutée", String(m.name ?? "Fichier"));
    case "support.file.remove": return entry("fichiers", "paperclip", "muted", "Pièce jointe retirée", String(m.name ?? "Fichier"));
    default: return entry("statut", "refresh", "muted", e.action.replace(/^support\./, ""), "");
  }
}

export const filterHistory = (entries: HistoryEntry[], f: HistoryFilter) => (f === "all" ? entries : entries.filter((e) => e.kind === f));

/** Conversation affichée : la description du ticket est le premier message du demandeur, suivie des réponses et des notes internes dans l'ordre d'envoi. */
export function conversationOf(d: SupportDetail): SupportMessage[] {
  const first: SupportMessage[] = d.ticket.description
    ? [{ id: "description", author_id: d.requester.id, author_name: d.requester.name, author_avatar: d.requester.avatar_url, internal: false, body: d.ticket.description, created_at: d.ticket.created_at, is_requester: true }]
    : [];
  return [...first, ...d.messages];
}
/** Nombre affiché sur l'onglet « Conversation » : messages du demandeur et réponses, sans les notes internes. */
export const conversationCount = (d: SupportDetail) => conversationOf(d).filter((m) => !m.internal).length;
