"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { CheckCircle2, Clock, Eye, GraduationCap, Info, Link as LinkIcon, ListOrdered, Lock, Settings, Target, type LucideIcon } from "lucide-react";
import { saveContentStep } from "@/lib/contents/actions";
import type { ContentLookups, Attachment } from "@/lib/contents/queries";
import type { FormState } from "@/lib/auth/actions";
import { TYPE_CARDS, displayFileName } from "@/lib/contents/wizard";
import { formatBytes, formatMinutes } from "@/lib/format";
import { CONTENT_TYPES, REQUIRED_LEVELS, type ContentType } from "@/lib/courses/labels";
import { CONTENT_TYPE_META } from "@/components/courses/content-type";
import { Alert } from "@/components/ui/feedback";
import { Field, SelectField } from "@/components/ui/field";
import { RichTextEditor } from "@/components/ui/rich-text-editor";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { CONTENT_FORM_ID } from "./content-frame";
import { ContentPreview, type PreviewData } from "./content-preview";
import { Attachments, MainFileUpload } from "./uploads";

function Section({ n, title, hint, children }: { n: number; title: string; hint?: string; children: React.ReactNode }) {
  return (
    <fieldset className="space-y-4 rounded-2xl border border-line bg-white p-6 shadow-card">
      <legend className="sr-only">{title}</legend>
      <div className="flex items-start gap-3">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand text-sm font-bold text-white">{n}</span>
        <div>
          <h3 className="text-lg font-bold text-brand-dark">{title}</h3>
          {hint && <p className="text-sm text-muted">{hint}</p>}
        </div>
      </div>
      {children}
    </fieldset>
  );
}

/** Case à cocher qui envoie « 1 » ou « 0 » (une case décochée n'enverrait rien, donc ne pourrait pas effacer un réglage). */
function Flag({ name, label, hint, defaultOn, onChange }: { name: string; label: string; hint?: string; defaultOn: boolean; onChange?: (on: boolean) => void }) {
  const [on, setOn] = useState(defaultOn);
  return (
    <label className="flex cursor-pointer items-start gap-2 text-sm text-brand-dark">
      <input type="hidden" name={name} value={on ? "1" : "0"} />
      <input type="checkbox" checked={on} onChange={(e) => { setOn(e.target.checked); onChange?.(e.target.checked); }} className="mt-0.5 h-4 w-4 accent-brand" />
      <span>{label}{hint && <span className="block text-xs text-muted">{hint}</span>}</span>
    </label>
  );
}

function Toggle({ name, label, hint, defaultOn, disabled, onChange, first = false }: {
  name?: string; label: string; hint?: string; defaultOn: boolean; disabled?: boolean; onChange?: (on: boolean) => void;
  /** Interrupteur placé avant le libellé (étape 3). */
  first?: boolean;
}) {
  const [on, setOn] = useState(defaultOn);
  const change = (x: boolean) => { setOn(x); onChange?.(x); };
  const text = <span className="text-sm text-brand-dark">{label}{hint && <span className="block text-xs text-muted">{hint}</span>}</span>;
  const sw = <Switch name={name} label={label} on={on} onChange={change} disabled={disabled} labelClassName="sr-only" />;
  return (
    <div className={cn("flex items-start gap-3", !first && "justify-between")}>
      {first ? sw : text}
      {first ? text : sw}
    </div>
  );
}

function Card({ icon: Icon, title, children }: { icon: LucideIcon; title: string; children: React.ReactNode }) {
  return (
    <fieldset className="space-y-3 rounded-xl border border-line p-4">
      <legend className="sr-only">{title}</legend>
      <h4 className="flex items-center gap-2 font-bold text-brand-dark"><Icon className="h-5 w-5 text-brand" aria-hidden /> {title}</h4>
      {children}
    </fieldset>
  );
}

function Step2Preview({ preview, mime, detailsLabel = "Détails du fichier" }: { preview: PreviewData; mime: string; detailsLabel?: string }) {
  const [tab, setTab] = useState<"apprenant" | "fichier" | "infos">("apprenant");
  const tabs = [["apprenant", "Vue apprenant"], ["fichier", detailsLabel], ["infos", "Informations"]] as const;
  const file = displayFileName(preview.filePath, preview.fileName);
  const rows: [string, string][] = tab === "fichier"
    ? [["Nom", file || "—"], ["Taille", preview.fileSize ? formatBytes(preview.fileSize) : "—"], ["Format", mime || "—"], ["Lien externe", preview.externalUrl || "—"]]
    : [["Formation", preview.courseTitle || "—"], ["Module", preview.moduleTitle || "—"], ["Durée", preview.durationMinutes ? formatMinutes(preview.durationMinutes) : "—"],
       ["Niveau", REQUIRED_LEVELS[(preview.level ?? "beginner") as keyof typeof REQUIRED_LEVELS] ?? "—"], ["Obligatoire", preview.required ? "Oui" : "Non"]];
  return (
    <section className="rounded-2xl border border-line bg-white p-5 shadow-card">
      <h3 className="flex items-center gap-2 text-base font-bold text-brand-dark"><Eye className="h-5 w-5 text-brand" aria-hidden /> Aperçu du contenu</h3>
      <p className="mb-3 text-sm text-muted">Voici un aperçu de la manière dont le contenu sera affiché aux apprenants.</p>
      <div role="tablist" className="mb-3 flex gap-1 border-b border-line">
        {tabs.map(([k, label]) => (
          <button key={k} type="button" role="tab" aria-selected={tab === k} onClick={() => setTab(k)}
            className={cn("whitespace-nowrap border-b-2 px-3 py-2 text-sm", tab === k ? "border-brand font-semibold text-brand" : "border-transparent text-muted hover:text-brand-dark")}>{label}</button>
        ))}
      </div>
      {tab === "apprenant" ? <ContentPreview data={preview} heading="Vue apprenant" /> : (
        <dl className="space-y-2 text-sm">
          {rows.map(([k, val]) => <div key={k} className="flex justify-between gap-4"><dt className="text-muted">{k}</dt><dd className="break-words text-right font-medium text-brand-dark">{val}</dd></div>)}
        </dl>
      )}
    </section>
  );
}

type Props = {
  step: 1 | 2 | 3;
  contentId?: string;
  initialValues: Record<string, string>;
  lookups: ContentLookups;
  attachments?: Attachment[];
  /** Formation de départ (contenu existant ou module reçu dans l'adresse). */
  initialCourseId?: string;
  status?: string;
};

/**
 * Formulaire des étapes 1 à 3 de l'assistant. Chaque étape enregistre le contenu (brouillon) puis passe à la suivante ;
 * les boutons du pied de page sont rattachés au formulaire par l'attribut `form`.
 */
export function ContentForm({ step, contentId, initialValues, lookups, attachments = [], initialCourseId = "" }: Props) {
  const [state, action] = useActionState<FormState, FormData>(saveContentStep, {});
  const values = state.values ?? initialValues;
  const v = (k: string) => values[k] ?? "";
  const errs = state.fieldErrors ?? {};

  const [courseId, setCourseId] = useState(initialCourseId || lookups.modules.find((m) => m.id === initialValues.moduleId)?.courseId || "");
  const [moduleId, setModuleId] = useState(initialValues.moduleId ?? "");
  const [type, setType] = useState(initialValues.contentType || "document");
  const [title, setTitle] = useState(initialValues.title ?? "");
  const [duration, setDuration] = useState(initialValues.durationMinutes ?? "");
  const [level, setLevel] = useState(initialValues.requiredLevel || "beginner");
  const [required, setRequired] = useState(initialValues.isRequired !== "0");
  const [file, setFile] = useState<{ path: string; name: string } | null>(initialValues.filePath ? { path: initialValues.filePath, name: initialValues.fileName } : null);
  const [url, setUrl] = useState(initialValues.externalUrl ?? "");
  const [position, setPosition] = useState(initialValues.position ?? "");
  const [visible, setVisible] = useState(initialValues.isVisible !== "0");
  const [download, setDownload] = useState(initialValues.allowDownload !== "0");
  const [availability, setAvailability] = useState<"always" | "until">(initialValues.availableUntil ? "until" : "always");

  const courseModules = lookups.modules.filter((m) => m.courseId === courseId);
  const course = lookups.courses.find((c) => c.id === courseId);
  const mod = lookups.modules.find((m) => m.id === moduleId);
  const currentType = (type in CONTENT_TYPES ? type : "document") as ContentType;
  const usesFile = ["document", "video", "case_study", "practice", "pdf", "presentation"].includes(currentType);
  const quizzes = lookups.quizzes.filter((q) => q.courseId === courseId);
  const prerequisites = lookups.contents.filter((c) => c.courseId === courseId && c.id !== contentId);

  const preview = (
    <ContentPreview data={{
      type, title, durationMinutes: Number(duration) || undefined, level, required,
      courseTitle: course?.title, moduleTitle: mod?.title, filePath: file?.path, fileName: file?.name, externalUrl: url || undefined,
    }} />
  );

  return (
    <form id={CONTENT_FORM_ID} action={action} noValidate className="space-y-6"
      onKeyDown={(e) => { if (e.key === "Enter" && e.target instanceof HTMLInputElement) e.preventDefault(); }}>
      <input type="hidden" name="step" value={step} />
      {contentId && <input type="hidden" name="contentId" value={contentId} />}
      {step !== 1 && <input type="hidden" name="contentType" value={type} />}

      {state.error && <Alert>{state.error}</Alert>}
      {state.fieldErrors && <Alert>Certaines informations sont incomplètes ou invalides. Corrigez les champs signalés.</Alert>}
      {state.message && <Alert tone="success">{state.message}</Alert>}

      {step === 1 && (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
          <div className="space-y-6">
            <Section n={1} title="Type et informations" hint="Choisissez le type de contenu et renseignez ses informations générales.">
              <div className="grid gap-4 sm:grid-cols-2">
                <SelectField label="Formation *" name="courseId_ui" value={courseId} errors={errs.moduleId && !courseId ? errs.moduleId : undefined}
                  onChange={(e) => { setCourseId(e.target.value); setModuleId(""); }}>
                  <option value="">Sélectionnez une formation</option>
                  {lookups.courses.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
                </SelectField>
                <SelectField label="Module *" name="moduleId" value={moduleId} disabled={!courseId} errors={errs.moduleId}
                  onChange={(e) => setModuleId(e.target.value)}>
                  <option value="">{courseId ? "Sélectionnez un module" : "Choisissez d’abord une formation"}</option>
                  {courseModules.map((m) => <option key={m.id} value={m.id}>{m.position}. {m.title}</option>)}
                </SelectField>
              </div>
              {courseId && courseModules.length === 0 && (
                <p className="text-sm text-muted">Cette formation n’a pas encore de module. <Link href={`/formateur/formations/${courseId}/programme`} className="font-semibold text-brand underline">Créez-en un dans le programme</Link>.</p>
              )}

              <fieldset>
                <legend className="mb-1 text-sm font-medium text-brand-dark">Type de contenu *</legend>
                <input type="hidden" name="contentType" value={type} />
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
                  {(Object.keys(TYPE_CARDS) as (keyof typeof TYPE_CARDS)[]).map((key) => {
                    const meta = CONTENT_TYPE_META[key];
                    const Icon = meta.icon;
                    const active = type === key;
                    return (
                      <button key={key} type="button" aria-pressed={active} onClick={() => setType(key)}
                        className={cn("flex flex-col items-center gap-1 rounded-xl border px-2 py-3 text-center transition-colors",
                          active ? "border-brand bg-brand-soft" : "border-line hover:border-brand/50")}>
                        <span className={cn("flex h-9 w-9 items-center justify-center rounded-lg", meta.chip)}><Icon className="h-5 w-5" aria-hidden /></span>
                        <span className="text-sm font-semibold text-brand-dark">{TYPE_CARDS[key].label}</span>
                        <span className="text-xs text-muted">{TYPE_CARDS[key].hint}</span>
                      </button>
                    );
                  })}
                </div>
                {errs.contentType?.[0] && <p role="alert" className="mt-1 text-xs text-danger">{errs.contentType[0]}</p>}
              </fieldset>

              <Field label="Titre du contenu *" name="title" maxLength={200} value={title} onChange={(e) => setTitle(e.target.value)}
                placeholder="Ex. Les obligations de l’agent de sécurité" errors={errs.title} />
              <div>
                <p className="mb-1 text-sm font-medium text-brand-dark">Description</p>
                <RichTextEditor name="description" label="Description" max={1000} rows={6} defaultValue={v("description")} error={errs.description?.[0]} />
              </div>
            </Section>

            {usesFile && (
              <Section n={2} title="Contenu et fichier" hint="Déposez le fichier principal, ou indiquez un lien. Vous pourrez compléter à l’étape suivante.">
                <MainFileUpload key={type} contentType={currentType}
                  initial={{ path: v("filePath"), name: v("fileName"), size: v("fileSize"), mime: v("fileMime") }} onChange={setFile} />
                <Field label="Ou lien externe (https://…)" name="externalUrl" inputMode="url" value={url} onChange={(e) => setUrl(e.target.value)}
                  placeholder="https://www.youtube.com/watch?v=…" errors={errs.externalUrl} />
              </Section>
            )}
            {!usesFile && <input type="hidden" name="externalUrl" value={url} />}
          </div>

          <aside className="space-y-6">
            <section className="space-y-4 rounded-2xl border border-line bg-white p-6 shadow-card">
              <h3 className="text-lg font-bold text-brand-dark">Paramètres pédagogiques</h3>
              <Field label="Durée estimée (minutes) *" name="durationMinutes" type="number" min="1" step="1" value={duration}
                onChange={(e) => setDuration(e.target.value)} errors={errs.durationMinutes} />
              <SelectField label="Niveau requis" name="requiredLevel" value={level} onChange={(e) => setLevel(e.target.value)} errors={errs.requiredLevel}>
                {Object.entries(REQUIRED_LEVELS).map(([k, label]) => <option key={k} value={k}>{label}</option>)}
              </SelectField>
              <div className="space-y-2">
                <Flag name="isRequired" label="Contenu obligatoire" defaultOn={required} onChange={setRequired} />
                <Flag name="allowDownload" label="Autoriser le téléchargement" defaultOn={v("allowDownload") !== "0"} />
                <Flag name="countsInProgress" label="Compter dans la progression" defaultOn={v("countsInProgress") !== "0"} />
              </div>
              <div className="space-y-3 border-t border-line pt-3">
                <Toggle name="isVisible" label="Visible par les apprenants" defaultOn={v("isVisible") !== "0"} />
                <Toggle name="allowComments" label="Autoriser les commentaires" defaultOn={v("allowComments") !== "0"} />
                <Toggle label="Disponible hors ligne" hint="Indisponible : l’accès hors ligne n’est pas encore géré." defaultOn={false} disabled />
              </div>
            </section>
            {preview}
          </aside>
        </div>
      )}

      {step === 2 && (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
          <div className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-line bg-white p-4 shadow-card">
              <div className="flex items-center gap-3">
                {(() => { const meta = CONTENT_TYPE_META[currentType]; const Icon = meta.icon; return <span className={cn("flex h-10 w-10 items-center justify-center rounded-lg", meta.chip)}><Icon className="h-5 w-5" aria-hidden /></span>; })()}
                <div>
                  <p className="text-sm font-bold text-brand-dark">Type de contenu : {CONTENT_TYPES[currentType]}</p>
                  <p className="text-xs text-muted">{title || "Sans titre"}</p>
                </div>
              </div>
              <Link href={`/formateur/contenus/nouveau/${contentId}?etape=1`} className="text-sm font-semibold text-brand underline">Changer de type</Link>
            </div>

            {currentType === "quiz" && (
              <Section n={1} title="Quiz associé" hint="Le quiz est une activité d’évaluation de la formation.">
                <SelectField label="Quiz *" name="evaluationId" defaultValue={v("evaluationId")} errors={errs.evaluationId}>
                  <option value="">Sélectionnez un quiz</option>
                  {quizzes.map((q) => <option key={q.id} value={q.id}>{q.title}{q.status !== "published" ? " (brouillon)" : ""}</option>)}
                </SelectField>
                {quizzes.length === 0 && (
                  <p className="text-sm text-muted">Aucun quiz dans cette formation. <Link href={`/formateur/formations/nouveau/${courseId}?etape=3`} className="font-semibold text-brand underline">Créez-en un dans les évaluations</Link>.</p>
                )}
              </Section>
            )}

            <Section n={currentType === "quiz" ? 2 : 1} title="Contenu textuel" hint="Facultatif : énoncé, consignes ou texte de la leçon.">
              <RichTextEditor name="body" label="Contenu textuel" max={2000} rows={10} defaultValue={v("body")} error={errs.body?.[0]} />
            </Section>

            {currentType !== "quiz" && (
              <Section n={2} title="Fichier principal" hint="Document, vidéo ou support du contenu.">
                <MainFileUpload contentType={currentType} initial={{ path: v("filePath"), name: v("fileName"), size: v("fileSize"), mime: v("fileMime") }} onChange={setFile} />
                <Field label="Ou lien externe (https://…)" name="externalUrl" inputMode="url" value={url} onChange={(e) => setUrl(e.target.value)} errors={errs.externalUrl} />
              </Section>
            )}

            {contentId && (
              <Section n={3} title="Fichiers complémentaires">
                <Attachments contentId={contentId} items={attachments} allowLinks={false} />
              </Section>
            )}
          </div>
          <aside className="space-y-6">
            <Step2Preview preview={{
              type, title, description: v("body") || v("description") || undefined, durationMinutes: Number(duration) || undefined, level, required,
              courseTitle: course?.title, moduleTitle: mod?.title, filePath: file?.path, fileName: file?.name, fileSize: Number(v("fileSize")) || null, externalUrl: url || undefined,
            }} mime={v("fileMime")} />
            <section className="space-y-1 rounded-2xl border border-brand/20 bg-brand-soft p-5 text-sm">
              <h3 className="flex items-center gap-2 font-bold text-brand"><Info className="h-4 w-4" aria-hidden /> Formats acceptés</h3>
              <p className="text-muted">PDF, DOC, DOCX, PPT, PPTX, XLS, MP4, WebM, liens externes (max 100 Mo)</p>
            </section>
            <section className="space-y-2 rounded-2xl border border-success/30 bg-success/10 p-5 text-sm">
              <h3 className="flex items-center gap-2 font-bold text-success"><CheckCircle2 className="h-4 w-4" aria-hidden /> Bonnes pratiques</h3>
              <ul className="list-disc space-y-1 pl-5 text-brand-dark">
                <li>Utilisez un titre clair et descriptif</li>
                <li>Ajoutez un contenu textuel pour contextualiser le fichier</li>
                <li>Privilégiez des fichiers de bonne qualité et de taille raisonnable</li>
                <li>Vous pouvez ajouter plusieurs fichiers complémentaires</li>
              </ul>
            </section>
          </aside>
        </div>
      )}

      {step === 3 && (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
          <section className="space-y-4 rounded-2xl border border-line bg-white p-6 shadow-card">
            <div className="flex items-start gap-3">
              <Settings className="mt-0.5 h-7 w-7 shrink-0 text-brand" aria-hidden />
              <div>
                <h3 className="text-lg font-bold text-brand-dark">Paramètres pédagogiques</h3>
                <p className="text-sm text-muted">Configurez les options d’apprentissage et les règles d’accès à ce contenu.</p>
              </div>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <Card icon={ListOrdered} title="Position et séquence">
                <SelectField label="Module *" name="moduleId" value={moduleId} onChange={(e) => setModuleId(e.target.value)} errors={errs.moduleId}>
                  {courseModules.map((m) => <option key={m.id} value={m.id}>Module {m.position} : {m.title}</option>)}
                </SelectField>
                <Field label="Position dans le module *" name="position" type="number" min="1" step="1" value={position}
                  onChange={(e) => setPosition(e.target.value)} errors={errs.position} className="max-w-[10rem]" />
              </Card>
              <Card icon={Clock} title="Durée et progression">
                <Field label="Durée estimée (minutes) *" name="durationMinutes" type="number" min="1" step="1" value={duration} onChange={(e) => setDuration(e.target.value)} errors={errs.durationMinutes} />
                <p className="flex items-start gap-2 rounded-lg bg-brand-soft p-3 text-xs text-brand-dark"><Info className="mt-0.5 h-4 w-4 shrink-0 text-brand" aria-hidden /> Cette durée sera prise en compte dans le temps total de la formation.</p>
              </Card>
              <Card icon={GraduationCap} title="Niveau et prérequis">
                <SelectField label="Niveau requis *" name="requiredLevel" value={level} onChange={(e) => setLevel(e.target.value)} errors={errs.requiredLevel}>
                  {Object.entries(REQUIRED_LEVELS).map(([k, label]) => <option key={k} value={k}>{label}</option>)}
                </SelectField>
                <SelectField label="Prérequis (optionnel)" name="prerequisiteContentId" defaultValue={v("prerequisiteContentId")} errors={errs.prerequisiteContentId}>
                  <option value="">Aucun prérequis</option>
                  {prerequisites.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
                </SelectField>
                <Toggle name="isRequired" label="Rendre ce contenu obligatoire" hint="Les apprenants doivent compléter ce contenu pour passer au suivant." defaultOn={required} onChange={setRequired} first />
              </Card>
              <Card icon={Lock} title="Disponibilité et accès">
                <Field label="Date de publication" name="publishAt" type="datetime-local" defaultValue={v("publishAt")} errors={errs.publishAt} />
                <SelectField label="Disponibilité" name="availability_ui" value={availability} onChange={(e) => setAvailability(e.target.value as "always" | "until")}>
                  <option value="always">Toujours disponible</option>
                  <option value="until">Disponible jusqu’à une date</option>
                </SelectField>
                {availability === "until"
                  ? <Field label="Disponible jusqu’au" name="availableUntil" type="datetime-local" defaultValue={v("availableUntil")} errors={errs.availableUntil} />
                  : <input type="hidden" name="availableUntil" value="" />}
                <div className="space-y-2">
                  <Toggle name="isVisible" label="Visible pour les apprenants" defaultOn={visible} onChange={setVisible} first />
                  <Toggle name="allowDownload" label="Autoriser le téléchargement du fichier" defaultOn={download} onChange={setDownload} first />
                  <Toggle label="Disponible hors ligne (si applicable)" hint="Indisponible : l’accès hors ligne n’est pas encore géré." defaultOn={false} disabled first />
                </div>
              </Card>
              <Card icon={Target} title="Options d’apprentissage">
                <div className="space-y-3">
                  <Toggle name="allowComments" label="Autoriser les commentaires" hint="Les apprenants peuvent poser des questions et échanger." defaultOn={v("allowComments") !== "0"} first />
                  <Toggle name="showInOutline" label="Afficher dans le sommaire" hint="Ce contenu apparaîtra dans la liste des contenus du module." defaultOn={v("showInOutline") !== "0"} first />
                  <Toggle name="countsInProgress" label="Ajouter à la progression des apprenants" hint="Ce contenu sera pris en compte dans le suivi de progression." defaultOn={v("countsInProgress") !== "0"} first />
                  <Toggle name="notifyLearners" label="Envoyer une notification aux apprenants" hint="Les apprenants seront informés de la disponibilité de ce contenu." defaultOn={v("notifyLearners") === "1"} first />
                </div>
              </Card>
              <Card icon={LinkIcon} title="Ressources et liens complémentaires">
                {contentId
                  ? <Attachments contentId={contentId} items={attachments} allowFiles={false} allowLinks />
                  : <p className="text-sm text-muted">Enregistrez le contenu pour ajouter des liens.</p>}
              </Card>
            </div>
          </section>
          <aside className="space-y-6">
            <Step2Preview detailsLabel="Détails" preview={{
              type, title, description: v("body") || v("description") || undefined, durationMinutes: Number(duration) || undefined, level, required,
              courseTitle: course?.title, moduleTitle: mod?.title, filePath: file?.path, fileName: file?.name, fileSize: Number(v("fileSize")) || null, externalUrl: url || undefined,
            }} mime={v("fileMime")} />
            <section className="rounded-2xl border border-success/30 bg-success/10 p-5">
              <h3 className="mb-3 flex items-center gap-2 text-base font-bold text-success"><CheckCircle2 className="h-5 w-5" aria-hidden /> Paramètres configurés</h3>
              <ul className="space-y-1.5 text-sm text-brand-dark">
                {[
                  mod ? `Module : Module ${mod.position} : ${mod.title}` : "Module : à choisir",
                  `Position : ${position || "fin du module"}`,
                  `Durée : ${Number(duration) > 0 ? `${duration} minutes` : "à renseigner"}`,
                  `Niveau : ${REQUIRED_LEVELS[level as keyof typeof REQUIRED_LEVELS] ?? level}`,
                  `Contenu obligatoire : ${required ? "Oui" : "Non"}`,
                  `Visible pour apprenants : ${visible ? "Oui" : "Non"}`,
                  `Autoriser le téléchargement : ${download ? "Oui" : "Non"}`,
                ].map((t) => <li key={t} className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 shrink-0 text-success" aria-hidden />{t}</li>)}
              </ul>
            </section>
          </aside>
        </div>
      )}
    </form>
  );
}
