"use client";

import { useActionState, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, Award, BookOpen, CalendarClock, FileCheck2, FileText, Image as ImageIcon, RotateCcw, Save, Settings, ShieldCheck, type LucideIcon } from "lucide-react";
import { Alert } from "@/components/ui/feedback";
import { FileUpload } from "@/components/ui/file-upload";
import { Switch } from "@/components/ui/switch";
import { DELIVERY_MODES, DESCRIPTION_MAX, EVALUATION_TYPES, LEVELS, type CertificationOptions } from "@/lib/admin/certifications";
import { createCertification } from "@/lib/admin/certifications-actions";
import type { FormState } from "@/lib/auth/actions";
import { cn } from "@/lib/utils";

const input = "w-full rounded-lg border border-line bg-white px-3 py-2.5 text-sm text-brand-dark outline-none focus:border-brand focus:ring-2 focus:ring-brand/20";
const lbl = "mb-1 block text-sm font-semibold text-brand-dark";
const Err = ({ e }: { e?: string[] }) => (e?.[0] ? <p role="alert" className="mt-1 text-xs text-danger">{e[0]}</p> : null);
const Req = () => <span className="text-danger">*</span>;

function Section({ icon: Icon, title, children, className }: { icon: LucideIcon; title: string; children: React.ReactNode; className?: string }) {
  return (
    <section className={cn("rounded-2xl border border-line bg-white p-5 shadow-card", className)}>
      <h2 className="mb-4 flex items-center gap-3 text-base font-extrabold text-brand-dark"><span className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-soft text-brand"><Icon className="h-5 w-5" aria-hidden /></span>{title}</h2>
      {children}
    </section>
  );
}

function Option({ name, label, on, setOn }: { name: string; label: string; on: boolean; setOn: (v: boolean) => void }) {
  return <div className="flex items-center gap-3"><Switch name={name} label={label} on={on} onChange={setOn} /><span className="text-sm font-semibold text-brand-dark">{label}</span></div>;
}

/** Création d'une certification : informations, visuel, formation et évaluation, validité, modèle d'attestation et options. */
export function CreateCertificationForm({ options }: { options: CertificationOptions }) {
  const [state, action, pending] = useActionState<FormState, FormData>(createCertification, {});
  const [formKey, setFormKey] = useState(0);
  return <Inner key={formKey} state={state} action={action} pending={pending} reset={() => setFormKey((k) => k + 1)} options={options} />;
}

function Inner({ state, action, pending, reset, options }: { state: FormState; action: (f: FormData) => void; pending: boolean; reset: () => void; options: CertificationOptions }) {
  const fe = state.fieldErrors ?? {};
  const sv = state.values ?? {};
  const [desc, setDesc] = useState(sv.description ?? "");
  const [cover, setCover] = useState("");
  const [templateId, setTemplateId] = useState(sv.templateId ?? options.templates[0]?.id ?? "");
  const [prefix, setPrefix] = useState(sv.numberPrefix ?? "");
  const [autoPdf, setAutoPdf] = useState(sv.autoPdf !== "0");
  const [showPublic, setShowPublic] = useState(sv.showPublic !== "0");
  const [verify, setVerify] = useState(sv.allowVerification !== "0");
  const [proof, setProof] = useState(sv.requireProof === "1");
  const template = options.templates.find((t) => t.id === templateId);

  return (
    <form action={action} noValidate className="space-y-6">
      {state.error && <Alert>{state.error}</Alert>}
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <Section icon={BookOpen} title="Informations générales">
          <div className="grid gap-4 md:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
            <div><label htmlFor="c-name" className={lbl}>Titre de la certification <Req /></label><input id="c-name" name="name" maxLength={200} defaultValue={sv.name ?? ""} className={input} aria-invalid={!!fe.name} /><Err e={fe.name} /></div>
            <div><label htmlFor="c-code" className={lbl}>Code <Req /></label><input id="c-code" name="code" maxLength={30} defaultValue={sv.code ?? ""} placeholder="CERT-SEC-001" className={cn(input, "uppercase")} aria-invalid={!!fe.code} /><Err e={fe.code} /></div>
            <div><label htmlFor="c-cat" className={lbl}>Catégorie <Req /></label>
              <select id="c-cat" name="categoryId" defaultValue={sv.categoryId ?? ""} className={input} aria-invalid={!!fe.categoryId}><option value="">Choisir…</option>{options.all_categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select><Err e={fe.categoryId} /></div>
            <div><label htmlFor="c-level" className={lbl}>Niveau <Req /></label>
              <select id="c-level" name="level" defaultValue={sv.level ?? "professional"} className={input}>{Object.entries(LEVELS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select><Err e={fe.level} /></div>
          </div>
          <div className="mt-4"><label htmlFor="c-desc" className={lbl}>Description <Req /></label>
            <textarea id="c-desc" name="description" rows={4} maxLength={DESCRIPTION_MAX} value={desc} onChange={(e) => setDesc(e.target.value)} className={input} aria-invalid={!!fe.description} />
            <p className="mt-1 text-right text-xs text-muted">{desc.length} / {DESCRIPTION_MAX}</p><Err e={fe.description} /></div>
        </Section>

        <Section icon={ImageIcon} title="Visuel de la certification">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-1">
            <div className="flex aspect-[3/2] items-center justify-center overflow-hidden rounded-xl border border-line bg-gradient-to-br from-brand-soft to-white">
              {cover ? <Image src={cover} alt="Aperçu du visuel" width={600} height={400} className="h-full w-full object-cover" unoptimized /> : <div className="text-center"><Award className="mx-auto h-12 w-12 text-brand" aria-hidden /><p className="mt-1 text-xs font-bold tracking-wide text-brand-dark">CERTIFICATION</p></div>}
            </div>
            <div><FileUpload name="coverUrl" label="Téléverser un visuel" bucket="certification-covers" accept={["image/jpeg", "image/png"]} maxMb={2} store="url" onValueChange={setCover} hint="PNG, JPG (max. 2 Mo). Recommandé : 1200 × 800 px." /><Err e={fe.coverUrl} /></div>
          </div>
        </Section>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <Section icon={FileCheck2} title="Formation et évaluation">
          <div className="grid gap-4 md:grid-cols-2">
            <div><label htmlFor="c-course" className={lbl}>Formation associée <Req /></label>
              <select id="c-course" name="courseId" defaultValue={sv.courseId ?? ""} className={input} aria-invalid={!!fe.courseId}><option value="">Choisir une formation…</option>{options.courses.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}</select><Err e={fe.courseId} /></div>
            <div><label htmlFor="c-evtype" className={lbl}>Type d’évaluation <Req /></label>
              <select id="c-evtype" name="evaluationType" defaultValue={sv.evaluationType ?? "qcm_practical"} className={input}>{Object.entries(EVALUATION_TYPES).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select><Err e={fe.evaluationType} /></div>
            <div><label htmlFor="c-score" className={lbl}>Score minimal de réussite <Req /></label>
              <div className="flex"><input id="c-score" name="passingScore" type="number" min={0} max={100} defaultValue={sv.passingScore ?? "70"} className={cn(input, "rounded-r-none")} aria-invalid={!!fe.passingScore} /><span className="flex items-center rounded-r-lg border border-l-0 border-line bg-surface px-3 text-sm text-muted">%</span></div><Err e={fe.passingScore} /></div>
            <div><label htmlFor="c-attempts" className={lbl}>Nombre de tentatives autorisées <Req /></label><input id="c-attempts" name="maxAttempts" type="number" min={1} max={10} defaultValue={sv.maxAttempts ?? "2"} className={input} aria-invalid={!!fe.maxAttempts} /><Err e={fe.maxAttempts} /></div>
          </div>
          <p className="mt-3 text-xs text-muted">Une formation n’a qu’une certification : celles déjà associées ne sont pas proposées.</p>
        </Section>

        <Section icon={CalendarClock} title="Validité et délivrance">
          <div className="grid gap-4 sm:grid-cols-2">
            <div><label htmlFor="c-validity" className={lbl}>Durée de validité</label>
              <div className="flex gap-2"><input id="c-validity" name="validityValue" type="number" min={1} max={240} defaultValue={sv.validityValue ?? "3"} placeholder="Illimitée" className={input} aria-invalid={!!fe.validityValue} />
                <select name="validityUnit" defaultValue={sv.validityUnit ?? "years"} aria-label="Unité" className={cn(input, "w-28 shrink-0")}><option value="years">an(s)</option><option value="months">mois</option></select></div><Err e={fe.validityValue} /></div>
            <div><label htmlFor="c-delivery" className={lbl}>Mode de délivrance <Req /></label>
              <select id="c-delivery" name="deliveryMode" defaultValue={sv.deliveryMode ?? "automatic"} className={input}>{Object.entries(DELIVERY_MODES).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select><Err e={fe.deliveryMode} /></div>
          </div>
          <div className="mt-4 rounded-xl bg-brand-soft/60 p-3"><Option name="autoPdf" label="Générer automatiquement l’attestation (PDF)" on={autoPdf} setOn={setAutoPdf} /></div>
          <p className="mt-2 text-xs text-muted">Laissez la durée vide pour une validité illimitée.</p>
        </Section>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <Section icon={FileText} title="Personnalisation de l’attestation">
          <div className="grid gap-4 md:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
            <div className="space-y-4">
              <div><label htmlFor="c-template" className={lbl}>Modèle d’attestation <Req /></label>
                <select id="c-template" name="templateId" value={templateId} onChange={(e) => setTemplateId(e.target.value)} className={input} aria-invalid={!!fe.templateId}>
                  <option value="">Choisir un modèle…</option>{options.templates.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select><Err e={fe.templateId} /></div>
              <div><label htmlFor="c-prefix" className={lbl}>Préfixe du numéro de certification</label>
                <input id="c-prefix" name="numberPrefix" value={prefix} onChange={(e) => setPrefix(e.target.value)} maxLength={10} placeholder="SEC" className={cn(input, "uppercase")} aria-invalid={!!fe.numberPrefix} /><Err e={fe.numberPrefix} /></div>
            </div>
            <div className="rounded-xl border-2 border-brand/30 bg-gradient-to-br from-brand-soft to-white p-4 text-center" aria-label="Aperçu du modèle">
              <p className="text-xs font-bold tracking-wide text-brand">SECURIPASS</p>
              <p className="mt-2 text-sm font-extrabold text-brand-dark">{template?.title ?? "Certificat"}</p>
              <div className="mx-auto mt-3 space-y-1.5"><span className="block h-1.5 rounded bg-brand/20" /><span className="mx-auto block h-1.5 w-3/4 rounded bg-brand/20" /></div>
              <p className="mt-3 text-[11px] text-muted">N° {(prefix || "SEC").toUpperCase()}-AAAA-00001</p>
            </div>
          </div>
        </Section>

        <Section icon={Settings} title="Paramètres complémentaires">
          <div className="space-y-4">
            <Option name="showPublic" label="Afficher la certification sur le catalogue public" on={showPublic} setOn={setShowPublic} />
            <Option name="allowVerification" label="Permettre la vérification de la certification en ligne" on={verify} setOn={setVerify} />
            <Option name="requireProof" label="Exiger une pièce justificative avant délivrance" on={proof} setOn={setProof} />
          </div>
          <p className="mt-4 flex items-start gap-2 text-xs text-muted"><ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />Ces paramètres sont enregistrés avec la certification ; leur application à l’émission des certificats viendra avec le module de délivrance.</p>
          <input type="hidden" name="status" value="active" />
        </Section>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link href="/admin/certifications" className="inline-flex items-center gap-2 rounded-lg border border-brand bg-white px-5 py-2.5 text-sm font-semibold text-brand hover:bg-brand-soft"><ArrowLeft className="h-4 w-4" aria-hidden /> Retour à la liste</Link>
        <div className="flex gap-3">
          <button type="button" onClick={reset} className="inline-flex items-center gap-2 rounded-lg border border-brand bg-white px-5 py-2.5 text-sm font-semibold text-brand hover:bg-brand-soft"><RotateCcw className="h-4 w-4" aria-hidden /> Réinitialiser</button>
          <button type="submit" disabled={pending} className="inline-flex items-center gap-2 rounded-lg bg-brand px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-dark disabled:opacity-60"><Save className="h-4 w-4" aria-hidden /> {pending ? "Enregistrement…" : "Enregistrer la certification"}</button>
        </div>
      </div>
    </form>
  );
}
