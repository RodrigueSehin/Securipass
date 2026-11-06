"use client";

import { useActionState, useState } from "react";
import { Bell, Coins, Eye, Info, Settings, Tag, Users } from "lucide-react";
import { saveCourseStep } from "@/lib/courses/actions";
import type { FormState } from "@/lib/auth/actions";
import { AUDIENCE_LABELS, PAYMENT_METHOD_LABELS, PAYMENT_METHODS } from "@/lib/courses/schemas";
import { Alert } from "@/components/ui/feedback";
import { Field, SelectField, TextareaField } from "@/components/ui/field";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { TagInput } from "../tag-input";
import { WIZARD_FORM_ID } from "./wizard-frame";

type Mode = "free" | "approval" | "code";
type Publication = "draft" | "publish" | "scheduled";

const list = (value: string | undefined, sep = ",") => (value ?? "").split(sep).filter(Boolean);

function Card({ icon: Icon, title, hint, children }: { icon: typeof Eye; title: string; hint: string; children: React.ReactNode }) {
  return (
    <section className="min-w-0 space-y-4 rounded-2xl border border-line bg-white p-5 shadow-card">
      <div className="flex items-start gap-3">
        <Icon className="mt-0.5 h-6 w-6 shrink-0 text-brand" aria-hidden />
        <div>
          <h2 className="text-lg font-bold text-brand-dark">{title}</h2>
          <p className="text-sm text-muted">{hint}</p>
        </div>
      </div>
      {children}
    </section>
  );
}

function Radio({ name, value, checked, onChange, title, text, disabled }: {
  name: string; value: string; checked: boolean; onChange: () => void; title: string; text: string; disabled?: boolean;
}) {
  return (
    <label className={cn("flex items-start gap-3 rounded-lg border p-3 text-sm", checked ? "border-brand bg-brand-soft/50" : "border-line", disabled ? "cursor-not-allowed opacity-60" : "cursor-pointer")}>
      <input type="radio" name={name} value={value} checked={checked} onChange={onChange} disabled={disabled} className="mt-1" />
      <span><span className="font-semibold text-brand-dark">{title}</span><br /><span className="text-muted">{text}</span></span>
    </label>
  );
}

/** Option présentée mais pas encore disponible : l'explication est affichée, jamais un interrupteur factice actif. */
function Unavailable({ label, reason }: { label: string; reason: string }) {
  return (
    <div className="flex items-start justify-between gap-3 text-sm text-muted">
      <span>{label}<span className="block text-xs">{reason}</span></span>
      <span aria-hidden className="mt-0.5 h-6 w-11 shrink-0 rounded-full bg-line opacity-50" />
    </div>
  );
}

/** Étape 4 : publication, inscription, tarification, options pédagogiques, notifications, mots-clés. */
export function SettingsStep({ courseId, initialValues, otherCourses, aside }: {
  courseId: string; initialValues: Record<string, string>;
  otherCourses: { id: string; title: string }[]; aside: React.ReactNode;
}) {
  const [state, action] = useActionState<FormState, FormData>(saveCourseStep, {});
  const v = (key: string) => state.values?.[key] ?? initialValues[key] ?? "";
  const fe = state.fieldErrors;
  const flag = (key: string) => v(key) === "1";

  const [publication, setPublication] = useState<Publication>((v("publicationMode") as Publication) || "publish");
  const [date, setDate] = useState(v("publishAt").split("T")[0] ?? "");
  const [time, setTime] = useState(v("publishAt").split("T")[1] ?? "08:00");
  const [paid, setPaid] = useState(Number(v("priceAmount") || 0) > 0);
  const [price, setPrice] = useState(Number(v("priceAmount") || 0) > 0 ? v("priceAmount") : "");
  const [mode, setMode] = useState<Mode>((v("enrollmentMode") as Mode) || "free");
  const [code, setCode] = useState(v("accessCode"));
  const [installments, setInstallments] = useState(flag("allowInstallments"));
  const [downloads, setDownloads] = useState(flag("allowDownloads"));
  const [discussions, setDiscussions] = useState(flag("allowDiscussions"));
  const [forum, setForum] = useState(flag("forumEnabled"));
  const [progress, setProgress] = useState(flag("showProgress"));
  const [notifyTrainer, setNotifyTrainer] = useState(flag("notifyInstructor"));
  const [autoCertificate, setAutoCertificate] = useState(flag("autoCertificate"));
  const audiences = list(v("audienceTypes"));
  const methods = list(v("paymentMethods"));

  return (
    <form id={WIZARD_FORM_ID} action={action} noValidate onKeyDown={(e) => { if (e.key === "Enter" && e.target instanceof HTMLInputElement) e.preventDefault(); }}>
      <input type="hidden" name="courseId" value={courseId} />
      <input type="hidden" name="step" value="4" />
      <input type="hidden" name="publicationMode" value={publication} />
      <input type="hidden" name="publishAt" value={publication === "scheduled" && date ? `${date}T${time || "00:00"}` : ""} />
      <input type="hidden" name="priceMode" value={paid ? "paid" : "free"} />
      <input type="hidden" name="priceAmount" value={paid ? price || "0" : "0"} />
      <input type="hidden" name="enrollmentMode" value={mode} />
      <input type="hidden" name="accessCode" value={mode === "code" ? code : ""} />

      <div className="mb-4 space-y-3 empty:hidden">
        {state.error && <Alert>{state.error}</Alert>}
        {state.fieldErrors && <Alert>Certaines informations sont invalides ou incomplètes. Corrigez les champs signalés.</Alert>}
        {state.message && <Alert tone="success">{state.message}</Alert>}
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="min-w-0 space-y-6">
          <div className="grid gap-6 lg:grid-cols-3">
            <Card icon={Eye} title="Visibilité et publication" hint="Définissez la visibilité et les conditions de publication de votre formation.">
              <div className="space-y-2">
                <Radio name="publicationChoice" value="draft" checked={publication === "draft"} onChange={() => setPublication("draft")} title="Brouillon" text="La formation n’est pas visible des apprenants et n’est pas soumise." />
                <Radio name="publicationChoice" value="publish" checked={publication === "publish"} onChange={() => setPublication("publish")} title="Publiée" text="Visible dans le catalogue dès sa validation par l’équipe pédagogique." />
                <Radio name="publicationChoice" value="scheduled" checked={publication === "scheduled"} onChange={() => setPublication("scheduled")} title="Planifiée" text="Visible à la date choisie, après validation." />
              </div>
              {publication === "scheduled" && (
                <div>
                  <p className="mb-1 text-sm font-medium text-brand-dark">Date de publication *</p>
                  <div className="grid grid-cols-2 gap-2">
                    <input type="date" aria-label="Date de publication" value={date} onChange={(e) => setDate(e.target.value)} className="rounded-lg border border-line bg-white px-3 py-2.5 text-sm" />
                    <input type="time" aria-label="Heure de publication" value={time} onChange={(e) => setTime(e.target.value)} className="rounded-lg border border-line bg-white px-3 py-2.5 text-sm" />
                  </div>
                  {fe?.publishAt && <p role="alert" className="mt-1 text-xs text-danger">{fe.publishAt[0]}</p>}
                  <p className="mt-1 text-xs text-muted">Heure d’Abidjan.</p>
                </div>
              )}
              <p className="flex items-start gap-2 rounded-lg bg-brand-soft p-3 text-xs text-brand-dark">
                <Info className="mt-0.5 h-4 w-4 shrink-0 text-brand" aria-hidden />
                {publication === "scheduled" ? "Après validation, la formation reste invisible jusqu’à cette date." : "La formation est soumise à la validation pédagogique avant d’apparaître au catalogue."}
              </p>
            </Card>

            <Card icon={Users} title="Conditions d’inscription" hint="Configurez les règles d’accès et d’inscription.">
              <fieldset className="space-y-2">
                <legend className="mb-1 text-sm font-medium text-brand-dark">Public cible</legend>
                <input type="hidden" name="audienceTypes" value="" />
                {Object.entries(AUDIENCE_LABELS).map(([key, text]) => (
                  <label key={key} className="flex items-center gap-2 text-sm text-brand-dark">
                    <input type="checkbox" name="audienceTypes" value={key} defaultChecked={audiences.includes(key)} className="h-4 w-4 accent-brand" /> {text}
                  </label>
                ))}
                {fe?.audienceTypes && <p role="alert" className="text-xs text-danger">{fe.audienceTypes[0]}</p>}
              </fieldset>
              <fieldset className="space-y-2">
                <legend className="mb-1 text-sm font-medium text-brand-dark">Mode d’inscription</legend>
                <Radio name="enrollmentChoice" value="free" checked={mode === "free"} onChange={() => setMode("free")} title="Inscription libre" text="Toute personne peut s’inscrire." />
                <Radio name="enrollmentChoice" value="approval" checked={mode === "approval"} onChange={() => setMode("approval")} title="Sur validation" text="L’inscription nécessite la validation du formateur." />
                <Radio name="enrollmentChoice" value="code" checked={mode === "code"} onChange={() => setMode("code")} title="Par code d’accès" text="L’accès se fait avec un code fourni aux apprenants." />
                {mode === "code" && (
                  <Field label="Code d’accès *" name="accessCodeInput" id="f-accessCodeInput" value={code} onChange={(e) => setCode(e.target.value)} maxLength={40} autoComplete="off" errors={fe?.accessCode}
                    hint="4 à 40 caractères, sans tenir compte de la casse." />
                )}
                {fe?.enrollmentMode && <p role="alert" className="text-xs text-danger">{fe.enrollmentMode[0]}</p>}
              </fieldset>
              <SelectField label="Formation à avoir terminée (prérequis d’accès)" name="prerequisiteCourseId" defaultValue={v("prerequisiteCourseId")} errors={fe?.prerequisiteCourseId}
                hint="L’inscription est refusée tant que cette formation n’est pas terminée.">
                <option value="">Aucune</option>
                {otherCourses.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
              </SelectField>
            </Card>

            <Card icon={Coins} title="Tarification" hint="Définissez le prix et les modalités de paiement.">
              <div className="space-y-2">
                <Radio name="priceChoice" value="free" checked={!paid} onChange={() => setPaid(false)} title="Gratuite" text="Accessible gratuitement." />
                <Radio name="priceChoice" value="paid" checked={paid} onChange={() => setPaid(true)} title="Payante" text="Définissez un prix pour cette formation." />
              </div>
              {paid && (
                <Field label="Prix (FCFA) *" name="priceInput" id="f-priceInput" type="number" min="1" step="1" value={price} onChange={(e) => setPrice(e.target.value)} errors={fe?.priceAmount} />
              )}
              <fieldset className={cn("space-y-2", !paid && "opacity-50")} disabled={!paid}>
                <legend className="mb-1 text-sm font-medium text-brand-dark">Modalités de paiement</legend>
                <input type="hidden" name="paymentMethods" value="" />
                {PAYMENT_METHODS.map((m) => (
                  <label key={m} className="flex items-center gap-2 text-sm text-brand-dark">
                    <input type="checkbox" name="paymentMethods" value={m} defaultChecked={methods.includes(m)} className="h-4 w-4 accent-brand" /> {PAYMENT_METHOD_LABELS[m]}
                  </label>
                ))}
                {fe?.paymentMethods && <p role="alert" className="text-xs text-danger">{fe.paymentMethods[0]}</p>}
              </fieldset>
              <Switch name="allowInstallments" label="Autoriser les paiements en plusieurs fois" on={installments} onChange={setInstallments} disabled={!paid} />
              {paid && <p className="rounded-lg bg-surface p-3 text-xs text-muted">Ces informations sont affichées sur la fiche de la formation. L’inscription en ligne aux formations payantes ouvrira avec le paiement sécurisé.</p>}
            </Card>
          </div>

          <div className="grid gap-6 lg:grid-cols-3">
            <Card icon={Settings} title="Paramètres pédagogiques" hint="Configurez les options d’apprentissage.">
              <div className="space-y-3">
                <Switch name="allowDownloads" label="Autoriser le téléchargement des supports" on={downloads} onChange={setDownloads} />
                <Switch name="allowDiscussions" label="Permettre les discussions entre apprenants" on={discussions} onChange={setDiscussions} />
                <Switch name="forumEnabled" label="Activer le forum de questions" on={forum} onChange={setForum} />
                <Switch name="showProgress" label="Afficher la progression aux apprenants" on={progress} onChange={setProgress} />
                <Unavailable label="Autoriser l’accès hors ligne" reason="Non disponible pour le moment." />
              </div>
            </Card>

            <Card icon={Bell} title="Notifications" hint="Configurez les notifications automatiques.">
              <div className="space-y-3">
                <Switch name="notifyInstructor" label="Notifier le formateur à chaque nouvelle inscription" on={notifyTrainer} onChange={setNotifyTrainer} />
                <Switch name="autoCertificate" label="Envoyer un certificat automatiquement" on={autoCertificate} onChange={setAutoCertificate} />
                <Unavailable label="Envoyer un e-mail de bienvenue aux apprenants" reason="Disponible avec l’envoi d’e-mails (fournisseur à choisir)." />
                <Unavailable label="Rappeler les apprenants avant le début de la session" reason="Disponible avec l’envoi d’e-mails et les rappels planifiés." />
                <Unavailable label="Notifier en cas d’abandon" reason="Disponible avec les rappels planifiés." />
              </div>
              <p className="rounded-lg bg-surface p-3 text-xs text-muted">Les notifications dans l’application fonctionnent déjà. Le certificat automatique est émis dès que l’apprenant est éligible ; il requiert un modèle choisi à l’étape 3.</p>
            </Card>

            <Card icon={Tag} title="Labels et options avancées" hint="Ajoutez des informations complémentaires.">
              <TagInput name="keywords" mode="multi" label="Mots-clés" initial={list(v("keywords"), "\n")} placeholder="Ex. Sécurité privée" max={20} errors={fe?.keywords} />
              <SelectField label="Formation parent (facultatif)" name="parentCourseId" defaultValue={v("parentCourseId")} errors={fe?.parentCourseId}
                hint="Parcours auquel cette formation se rattache ; affiché sur la fiche.">
                <option value="">Aucune</option>
                {otherCourses.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
              </SelectField>
              <Field label="Références externes (facultatif)" name="externalReference" maxLength={120} placeholder="Code interne, référence organisme" defaultValue={v("externalReference")} errors={fe?.externalReference} />
              <TextareaField label="Conditions d’annulation" name="cancellationPolicy" rows={3} defaultValue={v("cancellationPolicy")} errors={fe?.cancellationPolicy} />
              <TextareaField label="Accessibilité" name="accessibility" rows={2} defaultValue={v("accessibility")} errors={fe?.accessibility} />
            </Card>
          </div>
        </div>
        {aside}
      </div>
    </form>
  );
}
