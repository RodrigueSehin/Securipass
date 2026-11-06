"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { FileText, FolderPlus, GraduationCap, Globe, Info, Palette, Settings, Tag, Users, FolderOpen, type LucideIcon } from "lucide-react";
import { CATEGORY_ICONS, CategoryBadge } from "@/components/admin/category-badge";
import { Alert } from "@/components/ui/feedback";
import { FileUpload } from "@/components/ui/file-upload";
import { RichTextEditor } from "@/components/ui/rich-text-editor";
import { Switch } from "@/components/ui/switch";
import { CATEGORY_STATUS, LONG_MAX, SHORT_MAX, type CategoryStatus } from "@/lib/admin/categories";
import { createCategory } from "@/lib/admin/categories-actions";
import type { FormState } from "@/lib/auth/actions";
import { cn } from "@/lib/utils";

const input = "w-full rounded-lg border border-line bg-white px-3 py-2.5 text-sm text-brand-dark outline-none focus:border-brand focus:ring-2 focus:ring-brand/20";
const lbl = "mb-1 block text-sm font-semibold text-brand-dark";
const PRESETS = ["#2563eb", "#10a875", "#f59e0b", "#7c3aed", "#ef4444", "#0d9488", "#e11d48", "#8b97aa"];
const STATUS_DOT: Record<CategoryStatus, string> = { active: "bg-success", pending: "bg-warning", inactive: "bg-danger" };

function Section({ icon: Icon, title, hint, children }: { icon: LucideIcon; title: string; hint: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-line bg-white p-5 shadow-card">
      <div className="mb-4 flex items-start gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-soft text-brand"><Icon className="h-5 w-5" aria-hidden /></span>
        <div><h2 className="text-base font-extrabold text-brand-dark">{title}</h2><p className="text-xs text-muted">{hint}</p></div>
      </div>
      {children}
    </section>
  );
}

const Err = ({ e }: { e?: string[] }) => (e?.[0] ? <p role="alert" className="mt-1 text-xs text-danger">{e[0]}</p> : null);
const Req = () => <span className="text-danger">*</span>;

/** Création d'une catégorie : informations, descriptions, icône et couleur, image de couverture, statut et visibilité. */
export function CreateCategoryForm({ parents, defaultParent }: { parents: { id: string; name: string }[]; defaultParent: string }) {
  const [state, action, pending] = useActionState<FormState, FormData>(createCategory, {});
  const fe = state.fieldErrors ?? {};
  const sv = state.values ?? {};
  const [f, setF] = useState({
    name: sv.name ?? "", code: sv.code ?? "", parentId: sv.parentId ?? defaultParent, order: sv.order ?? "", shortDescription: sv.shortDescription ?? "",
    icon: sv.icon ?? "shield", color: sv.color ?? "#ef4444", status: (sv.status ?? "active") as CategoryStatus,
  });
  const [visiblePlatform, setVisiblePlatform] = useState(sv.visiblePlatform !== "0");
  const [visibleCatalogue, setVisibleCatalogue] = useState(sv.visibleCatalogue !== "0");
  const [afterSub, setAfterSub] = useState(false);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setF((p) => ({ ...p, [k]: e.target.value }));
  const yes = (v: boolean) => (v ? "Oui" : "Non");

  return (
    <form action={action} noValidate className="space-y-6">
      {state.error && <Alert>{state.error}</Alert>}
      <input type="hidden" name="icon" value={f.icon} />
      <input type="hidden" name="afterSub" value={afterSub ? "1" : "0"} />
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="space-y-5">
          <Section icon={FolderOpen} title="Informations générales" hint="Définissez les informations principales de la catégorie.">
            <div className="grid gap-4 md:grid-cols-2">
              <div><label htmlFor="c-name" className={lbl}>Nom de la catégorie <Req /></label><input id="c-name" name="name" value={f.name} onChange={set("name")} maxLength={80} className={input} aria-invalid={!!fe.name} /><Err e={fe.name} /></div>
              <div><label htmlFor="c-code" className={lbl}>Code de la catégorie <Req /></label><input id="c-code" name="code" value={f.code} onChange={set("code")} maxLength={30} placeholder="CAT-INC-001" className={cn(input, "uppercase")} aria-invalid={!!fe.code} /><Err e={fe.code} /></div>
              <div><label htmlFor="c-parent" className={lbl}>Catégorie parente <span className="font-normal text-muted">(optionnelle)</span></label>
                <select id="c-parent" name="parentId" value={f.parentId} onChange={set("parentId")} className={input}>
                  <option value="">Aucune (catégorie principale)</option>
                  {parents.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select><Err e={fe.parentId} /></div>
              <div><label htmlFor="c-order" className={lbl}>Ordre d’affichage</label><input id="c-order" name="order" type="number" min={0} max={9999} inputMode="numeric" value={f.order} onChange={set("order")} placeholder="0" className={input} aria-invalid={!!fe.order} />
                <p className="mt-1 text-xs text-muted">Plus le numéro est petit, plus la catégorie s’affiche en premier.</p><Err e={fe.order} /></div>
            </div>
          </Section>

          <Section icon={FileText} title="Description" hint="Décrivez la catégorie et ses objectifs.">
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label htmlFor="c-short" className={lbl}>Description courte <Req /></label>
                <textarea id="c-short" name="shortDescription" rows={7} maxLength={SHORT_MAX} value={f.shortDescription} onChange={set("shortDescription")} aria-invalid={!!fe.shortDescription} className={input} />
                <p className="mt-1 text-right text-xs text-muted">{f.shortDescription.length}/{SHORT_MAX}</p><Err e={fe.shortDescription} />
              </div>
              <div>
                <p className={lbl}>Description détaillée <span className="font-normal text-muted">(optionnelle)</span></p>
                <RichTextEditor name="longDescription" label="Description détaillée" max={LONG_MAX} rows={6} error={fe.longDescription?.[0]} />
              </div>
            </div>
          </Section>

          <Section icon={Palette} title="Icône et visuel" hint="Choisissez une icône et une couleur pour identifier la catégorie.">
            <div className="grid gap-5 md:grid-cols-[auto_minmax(0,1fr)_minmax(0,1fr)]">
              <div>
                <p className={lbl}>Icône <Req /></p>
                <div className="flex items-start gap-3">
                  <CategoryBadge icon={f.icon} color={f.color} size={64} />
                  <details className="relative">
                    <summary className="flex cursor-pointer list-none items-center gap-2 rounded-lg border border-line px-3 py-2.5 text-sm font-semibold text-brand-dark hover:bg-brand-soft [&::-webkit-details-marker]:hidden"><Tag className="h-4 w-4" aria-hidden />Changer d’icône</summary>
                    <div className="absolute left-0 z-10 mt-1 grid w-64 grid-cols-4 gap-2 rounded-lg border border-line bg-white p-3 shadow-card" role="radiogroup" aria-label="Icône">
                      {Object.entries(CATEGORY_ICONS).map(([key, { icon: Icon, label }]) => (
                        <button key={key} type="button" role="radio" aria-checked={f.icon === key} aria-label={label} title={label} onClick={(e) => { setF((p) => ({ ...p, icon: key })); e.currentTarget.closest("details")?.removeAttribute("open"); }}
                          className={cn("flex h-12 items-center justify-center rounded-lg border", f.icon === key ? "border-brand bg-brand-soft text-brand" : "border-line text-brand-dark hover:bg-brand-soft/50")}><Icon className="h-5 w-5" aria-hidden /></button>
                      ))}
                    </div>
                  </details>
                </div>
                <Err e={fe.icon} />
              </div>
              <div>
                <label htmlFor="c-color" className={lbl}>Couleur principale <Req /></label>
                <div className="flex items-center gap-2">
                  <input type="color" aria-label="Choisir la couleur" value={f.color} onChange={set("color")} className="h-10 w-12 cursor-pointer rounded-lg border border-line bg-white p-1" />
                  <input id="c-color" name="color" value={f.color} onChange={set("color")} maxLength={7} className={cn(input, "font-mono uppercase")} aria-invalid={!!fe.color} />
                </div>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {PRESETS.map((c) => <button key={c} type="button" aria-label={`Couleur ${c}`} onClick={() => setF((p) => ({ ...p, color: c }))} style={{ backgroundColor: c }} className={cn("h-6 w-6 rounded-full border-2", f.color.toLowerCase() === c ? "border-brand-dark" : "border-white shadow")} />)}
                </div>
                <Err e={fe.color} />
              </div>
              <div>
                <FileUpload name="coverUrl" label="Image de couverture (optionnelle)" bucket="category-covers" accept={["image/jpeg", "image/png", "image/webp"]} maxMb={2} store="url" hint="PNG, JPG ou WebP (2 Mo max). Recommandé : 1200 × 400 px." />
                <Err e={fe.coverUrl} />
              </div>
            </div>
          </Section>

          <Section icon={Settings} title="Paramètres" hint="Configurez le statut et les options d’affichage de la catégorie.">
            <div className="grid gap-5 md:grid-cols-3">
              <div>
                <label htmlFor="c-status" className={lbl}>Statut <Req /></label>
                <div className="relative">
                  <span className={cn("pointer-events-none absolute left-3 top-1/2 h-2.5 w-2.5 -translate-y-1/2 rounded-full", STATUS_DOT[f.status])} aria-hidden />
                  <select id="c-status" name="status" value={f.status} onChange={set("status")} className={cn(input, "pl-8")}>
                    {(Object.keys(CATEGORY_STATUS) as CategoryStatus[]).map((k) => <option key={k} value={k}>{CATEGORY_STATUS[k].label}</option>)}
                  </select>
                </div>
                <Err e={fe.status} />
              </div>
              <div>
                <p className={lbl}>Visible sur la plateforme <Req /></p>
                <Switch name="visiblePlatform" label="Visible sur la plateforme" on={visiblePlatform} onChange={setVisiblePlatform} className="py-1.5" />
                <span className="ml-3 text-sm text-brand-dark">{visiblePlatform ? "Oui, afficher cette catégorie" : "Non, masquer cette catégorie"}</span>
              </div>
              <div>
                <p className={lbl}>Visible dans le catalogue public <Req /></p>
                <Switch name="visibleCatalogue" label="Visible dans le catalogue public" on={visibleCatalogue} onChange={setVisibleCatalogue} className="py-1.5" />
                <span className="ml-3 text-sm text-brand-dark">{visibleCatalogue ? "Oui, afficher dans le catalogue" : "Non, masquer du catalogue"}</span>
              </div>
            </div>
            <p className="mt-4 flex items-start gap-2 rounded-lg bg-brand-soft p-3 text-xs text-brand-dark"><Info className="mt-0.5 h-4 w-4 shrink-0 text-brand" aria-hidden />Une catégorie n’est visible du public que si son statut est « Active » et si elle est visible sur la plateforme.</p>
          </Section>
        </div>

        <aside className="space-y-5 xl:sticky xl:top-4 xl:self-start">
          <section className="rounded-2xl border border-line bg-white p-5 shadow-card">
            <h2 className="mb-4 text-lg font-extrabold text-brand-dark">Aperçu de la catégorie</h2>
            <div className="flex flex-col items-center text-center">
              <CategoryBadge icon={f.icon} color={f.color} size={80} />
              <p className="mt-3 text-xl font-extrabold text-brand-dark">{f.name || "Nouvelle catégorie"}</p>
              <p className="mt-1 text-sm text-brand-dark/80">{f.shortDescription || "La description courte apparaîtra ici."}</p>
            </div>
            <h3 className="mt-5 border-t border-line pt-4 text-sm font-extrabold text-brand-dark">Informations</h3>
            <dl className="mt-2 space-y-2 text-sm text-brand-dark">
              {([[Tag, "Code", f.code ? f.code.toUpperCase() : "—"], [GraduationCap, "Formations", "0"], [Users, "Apprenants", "0"], [Globe, "Visible sur la plateforme", yes(visiblePlatform)], [Globe, "Dans le catalogue public", yes(visibleCatalogue)]] as const).map(([I, l, v]) => (
                <div key={l} className="flex items-center justify-between gap-3"><dt className="flex items-center gap-2"><I className="h-4 w-4 text-muted" aria-hidden />{l}</dt><dd className="font-semibold">{v}</dd></div>
              ))}
            </dl>
          </section>

          <section className="rounded-2xl border border-line bg-white p-5 shadow-card">
            <h2 className="mb-3 flex items-center gap-2 text-base font-extrabold text-brand-dark"><Info className="h-5 w-5 text-brand" aria-hidden />Actions après création</h2>
            <label className="flex items-center gap-2 text-sm text-brand-dark"><input type="checkbox" checked={afterSub} onChange={(e) => setAfterSub(e.target.checked)} className="h-4 w-4" />Ajouter une sous-catégorie</label>
            <p className="mt-2 text-xs text-muted">{afterSub ? "Le formulaire se rouvre avec cette catégorie comme parente." : "Vous serez ramené à la liste des catégories."}</p>
          </section>

          <div className="flex gap-3">
            <Link href="/admin/categories" className="inline-flex flex-1 items-center justify-center rounded-lg border border-brand bg-white px-5 py-3 text-sm font-semibold text-brand hover:bg-brand-soft">Annuler</Link>
            <button type="submit" disabled={pending} className="inline-flex flex-[1.6] items-center justify-center gap-2 rounded-lg bg-brand px-5 py-3 text-sm font-semibold text-white hover:bg-brand-dark disabled:opacity-60">
              <FolderPlus className="h-4 w-4" aria-hidden /> {pending ? "Création…" : "Créer la catégorie"}
            </button>
          </div>
        </aside>
      </div>
    </form>
  );
}
