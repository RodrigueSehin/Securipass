"use client";

import { useActionState, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, CalendarClock, FileText, Image as ImageIcon, Info, Paperclip, RotateCcw, Save, Search, Tag, Upload, X, type LucideIcon } from "lucide-react";
import { Alert } from "@/components/ui/feedback";
import { FileUpload } from "@/components/ui/file-upload";
import { RichTextEditor } from "@/components/ui/rich-text-editor";
import { Switch } from "@/components/ui/switch";
import { BLOG_KINDS, BODY_MAX, CATEGORY_LABEL, EXCERPT_MAX, LANGUAGES, MEDIA_MAX_MB, MEDIA_TYPES, SEO_DESCRIPTION_MAX, SEO_TITLE_MAX, VISIBILITIES } from "@/lib/admin/blog";
import { createBlogPost } from "@/lib/admin/blog-actions";
import type { FormState } from "@/lib/auth/actions";
import { createClient } from "@/lib/supabase/browser";
import { cn } from "@/lib/utils";

const input = "w-full rounded-lg border border-line bg-white px-3 py-2.5 text-sm text-brand-dark outline-none focus:border-brand focus:ring-2 focus:ring-brand/20";
const lbl = "mb-1 block text-sm font-semibold text-brand-dark";
const Err = ({ e }: { e?: string[] }) => (e?.[0] ? <p role="alert" className="mt-1 text-xs text-danger">{e[0]}</p> : null);
const Req = () => <span className="text-danger">*</span>;
type Media = { path: string; name: string; type: string; size: number };

function Section({ icon: Icon, title, children, className }: { icon: LucideIcon; title: string; children: React.ReactNode; className?: string }) {
  return (
    <section className={cn("rounded-2xl border border-line bg-white p-5 shadow-card", className)}>
      <h2 className="mb-4 flex items-center gap-3 text-base font-extrabold text-brand-dark"><Icon className="h-5 w-5 text-brand" aria-hidden />{title}</h2>
      {children}
    </section>
  );
}

const size = (bytes: number) => (bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1).replace(".", ",")} Mo` : `${Math.max(1, Math.round(bytes / 1024))} Ko`);

/** Création d'un contenu du blog : informations, texte, médias joints, publication (programmable), mots-clés, couverture et référencement. */
export function CreateBlogForm({ today, nowTime }: { today: string; nowTime: string }) {
  const [state, action, pending] = useActionState<FormState, FormData>(createBlogPost, {});
  const [formKey, setFormKey] = useState(0);
  return <Inner key={formKey} state={state} action={action} pending={pending} reset={() => setFormKey((k) => k + 1)} today={today} nowTime={nowTime} />;
}

function Inner({ state, action, pending, reset, today, nowTime }: { state: FormState; action: (f: FormData) => void; pending: boolean; reset: () => void; today: string; nowTime: string }) {
  const fe = state.fieldErrors ?? {};
  const sv = state.values ?? {};
  const [excerpt, setExcerpt] = useState(sv.excerpt ?? "");
  const [seoTitle, setSeoTitle] = useState(sv.seoTitle ?? "");
  const [seoDesc, setSeoDesc] = useState(sv.seoDescription ?? "");
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");
  const [schedule, setSchedule] = useState(sv.schedule === "1");
  const [media, setMedia] = useState<Media[]>([]);
  const [mediaMsg, setMediaMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  function addTag(raw: string) {
    const t = raw.trim().toLowerCase().replace(/,+$/, "").slice(0, 30);
    if (t && !tags.includes(t) && tags.length < 10) setTags([...tags, t]);
    setTagInput("");
  }

  async function addMedia(e: React.ChangeEvent<HTMLInputElement>) {
    const files = [...(e.target.files ?? [])];
    if (fileRef.current) fileRef.current.value = "";
    if (!files.length) return;
    setMediaMsg(null);
    if (media.length + files.length > 10) return setMediaMsg("10 fichiers au maximum.");
    const bad = files.find((f) => !(MEDIA_TYPES as readonly string[]).includes(f.type) || f.size > MEDIA_MAX_MB * 1024 * 1024);
    if (bad) return setMediaMsg(`« ${bad.name} » : images (JPG, PNG, WebP), vidéos MP4 ou PDF de ${MEDIA_MAX_MB} Mo maximum.`);
    setBusy(true);
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("auth");
      const added: Media[] = [];
      for (const f of files) {
        const path = `${user.id}/${crypto.randomUUID()}-${f.name.replace(/[^\w.-]+/g, "_").slice(-80)}`;
        const { error } = await supabase.storage.from("blog-media").upload(path, f, { contentType: f.type, upsert: false });
        if (error) throw error;
        added.push({ path, name: f.name.slice(0, 200), type: f.type, size: f.size });
      }
      setMedia((m) => [...m, ...added]);
    } catch {
      setMediaMsg("Impossible d’envoyer un fichier. Réessayez.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form action={action} noValidate className="space-y-6">
      {state.error && <Alert>{state.error}</Alert>}
      {tags.map((t) => <input key={t} type="hidden" name="tag" value={t} />)}
      {media.map((m) => <input key={m.path} type="hidden" name="file" value={JSON.stringify(m)} />)}
      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <div className="space-y-6">
          <Section icon={Info} title="Informations sur le contenu">
            <div className="grid gap-4 md:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
              <div><label htmlFor="b-title" className={lbl}>Titre du contenu <Req /></label><input id="b-title" name="title" maxLength={200} defaultValue={sv.title ?? ""} className={input} aria-invalid={!!fe.title} /><Err e={fe.title} /></div>
              <div><label htmlFor="b-kind" className={lbl}>Type de contenu <Req /></label>
                <select id="b-kind" name="kind" defaultValue={sv.kind ?? "article"} className={input}>{Object.entries(BLOG_KINDS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select><Err e={fe.kind} /></div>
            </div>
            <div className="mt-4 grid gap-4 md:grid-cols-3">
              <div><label htmlFor="b-cat" className={lbl}>Catégorie <Req /></label>
                <select id="b-cat" name="category" defaultValue={sv.category ?? ""} className={input} aria-invalid={!!fe.category}><option value="">Choisir…</option>{Object.entries(CATEGORY_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select><Err e={fe.category} /></div>
              <div><label htmlFor="b-vis" className={lbl}>Niveau de visibilité <Req /></label>
                <select id="b-vis" name="visibility" defaultValue={sv.visibility ?? "public"} className={input}>{Object.entries(VISIBILITIES).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select><Err e={fe.visibility} /></div>
              <div><label htmlFor="b-lang" className={lbl}>Langue <Req /></label>
                <select id="b-lang" name="language" defaultValue={sv.language ?? "fr"} className={input}>{Object.entries(LANGUAGES).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select><Err e={fe.language} /></div>
            </div>
            <div className="mt-4"><label htmlFor="b-excerpt" className={lbl}>Résumé / Extrait <Req /></label>
              <textarea id="b-excerpt" name="excerpt" rows={3} maxLength={EXCERPT_MAX} value={excerpt} onChange={(e) => setExcerpt(e.target.value)} className={input} aria-invalid={!!fe.excerpt} />
              <p className="mt-1 text-right text-xs text-muted">{excerpt.length} / {EXCERPT_MAX}</p><Err e={fe.excerpt} /></div>
            <div className="mt-4">
              <p className={lbl}>Contenu <Req /></p>
              <RichTextEditor name="body" label="Contenu" max={BODY_MAX} rows={12} defaultValue={sv.body ?? ""} error={fe.longBody?.[0]} />
              <p className="mt-1 text-xs text-muted">Titres, gras, italique, souligné, listes et liens. Les images, vidéos et documents s’ajoutent dans « Médias joints ».</p>
            </div>
          </Section>

          <Section icon={Paperclip} title="Médias joints">
            <input ref={fileRef} id="b-media" type="file" multiple accept={MEDIA_TYPES.join(",")} onChange={addMedia} className="sr-only" />
            <div className="grid gap-4 md:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
              <label htmlFor="b-media" className="flex cursor-pointer items-center gap-4 rounded-xl border-2 border-dashed border-line px-4 py-5 hover:bg-brand-soft/40">
                <Upload className="h-8 w-8 shrink-0 text-brand" aria-hidden />
                <span><span className="block text-sm font-bold text-brand-dark">{busy ? "Envoi…" : "Glissez-déposez des fichiers ici ou cliquez pour sélectionner"}</span>
                  <span className="block text-xs text-muted">Images (JPG, PNG, WebP), vidéos (MP4), documents (PDF). Taille max : {MEDIA_MAX_MB} Mo par fichier.</span></span>
              </label>
              {media.length > 0 && (
                <ul className="grid gap-2">
                  {media.map((m) => (
                    <li key={m.path} className="flex items-center gap-2 rounded-lg border border-line px-3 py-2 text-sm text-brand-dark">
                      <FileText className="h-5 w-5 shrink-0 text-brand" aria-hidden /><span className="min-w-0 flex-1"><span className="block truncate font-semibold">{m.name}</span><span className="text-xs text-muted">{size(m.size)}</span></span>
                      <button type="button" onClick={() => setMedia((x) => x.filter((y) => y.path !== m.path))} aria-label={`Retirer ${m.name}`} className="text-muted hover:text-danger"><X className="h-4 w-4" aria-hidden /></button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            {(mediaMsg || fe.files) && <p role="alert" className="mt-2 text-xs text-danger">{mediaMsg ?? fe.files?.[0]}</p>}
          </Section>
        </div>

        <div className="space-y-6">
          <Section icon={CalendarClock} title="Publication">
            <div><label htmlFor="b-status" className={lbl}>Statut <Req /></label>
              <select id="b-status" name="status" defaultValue={sv.status ?? "published"} className={input}><option value="published">Publié</option><option value="draft">Brouillon</option></select><Err e={fe.status} /></div>
            <div className="mt-4 grid grid-cols-[minmax(0,1fr)_8rem] gap-3">
              <div><label htmlFor="b-date" className={lbl}>Date de publication <Req /></label><input id="b-date" name="publishDate" type="date" defaultValue={sv.publishDate ?? today} className={input} aria-invalid={!!fe.publishDate} /><Err e={fe.publishDate} /></div>
              <div><label htmlFor="b-time" className={lbl}>Heure</label><input id="b-time" name="publishTime" type="time" defaultValue={sv.publishTime ?? nowTime} className={input} aria-invalid={!!fe.publishTime} /><Err e={fe.publishTime} /></div>
            </div>
            <div className="mt-4 flex items-center gap-3"><Switch name="schedule" label="Programmer la publication" on={schedule} onChange={setSchedule} /><span className="text-sm font-semibold text-brand-dark">Programmer la publication</span></div>
            <p className="mt-2 text-xs text-muted">Pour une date future, activez la programmation : le contenu devient visible à cette date. Un brouillon n’a pas de date.</p>
          </Section>

          <Section icon={Tag} title="Mots-clés (tags)">
            <div className="flex flex-wrap items-center gap-2 rounded-lg border border-line bg-white px-2.5 py-2">
              {tags.map((t) => (
                <span key={t} className="inline-flex items-center gap-1 rounded-md bg-brand-soft px-2 py-1 text-xs font-semibold text-brand-dark">{t}
                  <button type="button" onClick={() => setTags(tags.filter((x) => x !== t))} aria-label={`Retirer ${t}`}><X className="h-3 w-3" aria-hidden /></button></span>
              ))}
              <input value={tagInput} onChange={(e) => setTagInput(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" || e.key === ",") { e.preventDefault(); addTag(tagInput); } }} onBlur={() => addTag(tagInput)}
                placeholder="Ajouter un mot-clé…" aria-label="Ajouter un mot-clé" disabled={tags.length >= 10} className="min-w-28 flex-1 bg-transparent text-sm outline-none" />
            </div>
            <Err e={fe.tags} /><p className="mt-1 text-xs text-muted">Entrée ou virgule pour valider. 10 mots-clés au maximum.</p>
          </Section>

          <Section icon={ImageIcon} title="Image de couverture">
            <FileUpload name="coverUrl" label="Image de couverture" bucket="blog-covers" accept={["image/jpeg", "image/png", "image/webp"]} maxMb={2} store="url" variant="cover" hint="Format recommandé : 1200 × 630 px (JPG, PNG, WebP)." />
            <Err e={fe.coverUrl} />
          </Section>

          <Section icon={Search} title="Référencement (SEO)">
            <div><label htmlFor="b-seo-t" className={lbl}>Titre SEO</label><input id="b-seo-t" name="seoTitle" maxLength={SEO_TITLE_MAX} value={seoTitle} onChange={(e) => setSeoTitle(e.target.value)} className={input} />
              <p className="mt-1 text-right text-xs text-muted">{seoTitle.length} / {SEO_TITLE_MAX}</p><Err e={fe.seoTitle} /></div>
            <div className="mt-3"><label htmlFor="b-seo-d" className={lbl}>Description SEO</label><textarea id="b-seo-d" name="seoDescription" rows={3} maxLength={SEO_DESCRIPTION_MAX} value={seoDesc} onChange={(e) => setSeoDesc(e.target.value)} className={input} />
              <p className="mt-1 text-right text-xs text-muted">{seoDesc.length} / {SEO_DESCRIPTION_MAX}</p><Err e={fe.seoDescription} /></div>
          </Section>
        </div>
      </div>

      <p className="text-xs text-muted">Le site public n’affiche pas encore les contenus créés ici : il lit toujours sa liste actuelle.</p>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link href="/admin/blog" className="inline-flex items-center gap-2 rounded-lg border border-brand bg-white px-5 py-2.5 text-sm font-semibold text-brand hover:bg-brand-soft"><ArrowLeft className="h-4 w-4" aria-hidden /> Retour à la liste</Link>
        <div className="flex gap-3">
          <button type="button" onClick={reset} className="inline-flex items-center gap-2 rounded-lg border border-brand bg-white px-5 py-2.5 text-sm font-semibold text-brand hover:bg-brand-soft"><RotateCcw className="h-4 w-4" aria-hidden /> Réinitialiser</button>
          <button type="submit" disabled={pending || busy} className="inline-flex items-center gap-2 rounded-lg bg-brand px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-dark disabled:opacity-60"><Save className="h-4 w-4" aria-hidden /> {pending ? "Enregistrement…" : "Publier le contenu"}</button>
        </div>
      </div>
    </form>
  );
}
