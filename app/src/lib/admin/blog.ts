import { z } from "zod";
import { BLOG_CATEGORIES } from "@/content/blog";

/** Blog et contenus publics gérés par l'administration : filtres, libellés et validation (pur : testé unitairement). */

export const BLOG_KINDS = { article: "Article", news: "Actualité", resource: "Ressource", video: "Vidéo" } as const;
export type BlogKind = keyof typeof BLOG_KINDS;
export const BLOG_KIND_TABS: Record<BlogKind, string> = { article: "Articles", news: "Actualités", resource: "Ressources", video: "Vidéos" };

export const BLOG_STATUS_UI = {
  published: { label: "Publié", tone: "bg-success/15 text-success" },
  draft: { label: "Brouillon", tone: "bg-brand-soft text-brand" },
  archived: { label: "Archivé", tone: "bg-line text-muted" },
} as const;
export type BlogStatus = keyof typeof BLOG_STATUS_UI;

export const CATEGORY_LABEL: Record<string, string> = Object.fromEntries(BLOG_CATEGORIES.map((c) => [c.slug, c.label]));
export const CATEGORY_TONE: Record<string, string> = Object.fromEntries(BLOG_CATEGORIES.map((c) => [c.slug, c.tone]));
export const categoryLabel = (slug: string) => CATEGORY_LABEL[slug] ?? slug;

export type BlogFilters = { q: string; kind: string; category: string; status: string; from: string; to: string };

const DAY = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;

/** Valeurs de filtre acceptées : tout le reste est ignoré ; une période inversée est remise dans l'ordre. */
export function parseBlogFilters(sp: { q?: string; type?: string; categorie?: string; statut?: string; du?: string; au?: string }): BlogFilters {
  let from = sp.du && DAY.test(sp.du) ? sp.du : "";
  let to = sp.au && DAY.test(sp.au) ? sp.au : "";
  if (from && to && from > to) [from, to] = [to, from];
  return {
    q: sp.q?.trim().slice(0, 100) ?? "",
    kind: sp.type && sp.type in BLOG_KINDS ? sp.type : "",
    category: sp.categorie && sp.categorie in CATEGORY_LABEL ? sp.categorie : "",
    status: sp.statut && sp.statut in BLOG_STATUS_UI ? sp.statut : "",
    from, to,
  };
}

export type BlogRow = {
  id: string; slug: string; title: string; category: string; kind: BlogKind; status: BlogStatus; published_at: string | null; updated_at: string;
  image: string | null; views: number; author_name: string | null;
};
export type BlogStats = {
  published: { count: number; month: number; prev: number }; drafts: number; views: number; total: number;
  kinds: Partial<Record<BlogKind, number>>; categories: Record<string, number>;
};
export type BlogDraft = { id: string; title: string; updated_at: string };

/** Lien de l'image : adresse complète (visuel téléversé) ou chemin sous public/images/. */
export const isRemoteImage = (image: string) => /^https:\/\//.test(image);

/** Identifiant d'URL : minuscules, sans accents, tirets. */
export function slugify(title: string): string {
  return title.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 100);
}

export const EXCERPT_MAX = 300;
export const BODY_MAX = 20000;
export const SEO_TITLE_MAX = 70;
export const SEO_DESCRIPTION_MAX = 160;
export const VISIBILITIES = { public: "Public (accessible à tous)", members: "Membres connectés" } as const;
export const LANGUAGES = { fr: "Français (FR)", en: "English (EN)" } as const;
export const MEDIA_MAX_MB = 50;
export const MEDIA_TYPES = ["image/jpeg", "image/png", "image/webp", "video/mp4", "application/pdf"] as const;

const tag = z.string().trim().toLowerCase().min(1).max(30, "30 caractères au maximum par mot-clé");

export const createBlogPostSchema = z.object({
  title: z.string().trim().min(2, "Titre requis (2 caractères au minimum)").max(200, "200 caractères au maximum"),
  kind: z.enum(Object.keys(BLOG_KINDS) as [BlogKind, ...BlogKind[]], { error: "Type requis" }),
  category: z.enum(BLOG_CATEGORIES.map((c) => c.slug) as [string, ...string[]], { error: "Catégorie requise" }),
  visibility: z.enum(["public", "members"], { error: "Visibilité requise" }),
  language: z.enum(["fr", "en"], { error: "Langue requise" }),
  excerpt: z.string().trim().min(2, "Résumé requis").max(EXCERPT_MAX, `${EXCERPT_MAX} caractères au maximum`),
  longBody: z.string().trim().min(2, "Contenu requis").max(BODY_MAX, `${BODY_MAX} caractères au maximum`),
  tags: z.array(tag).max(10, "10 mots-clés au maximum"),
  coverUrl: z.string().trim().min(1, "Image de couverture requise").refine((v) => /^https:\/\/\S+$/.test(v), "Visuel invalide"),
  status: z.enum(["draft", "published"], { error: "Statut requis" }),
  publishDate: z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/, "Date requise"),
  publishTime: z.string().trim().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Heure requise"),
  schedule: z.enum(["0", "1"]).optional().transform((v) => v === "1"),
  seoTitle: z.string().trim().max(SEO_TITLE_MAX, `${SEO_TITLE_MAX} caractères au maximum`).optional().transform((v) => v || null),
  seoDescription: z.string().trim().max(SEO_DESCRIPTION_MAX, `${SEO_DESCRIPTION_MAX} caractères au maximum`).optional().transform((v) => v || null),
  files: z.array(z.object({ path: z.string().max(300), name: z.string().max(200), type: z.string().max(100), size: z.number().int().positive().max(MEDIA_MAX_MB * 1024 * 1024) })).max(10, "10 fichiers au maximum"),
}).transform((d) => ({
  ...d, body: d.longBody, slug: slugify(d.title), readMinutes: Math.max(1, Math.round(d.longBody.split(/\s+/).length / 200)),
  publishAt: new Date(`${d.publishDate}T${d.publishTime}:00Z`),
})).superRefine((d, ctx) => {
  if (d.slug.length < 2) ctx.addIssue({ code: "custom", path: ["title"], message: "Le titre doit contenir des lettres ou des chiffres" });
  if (Number.isNaN(d.publishAt.getTime())) ctx.addIssue({ code: "custom", path: ["publishDate"], message: "Date de publication invalide" });
});
