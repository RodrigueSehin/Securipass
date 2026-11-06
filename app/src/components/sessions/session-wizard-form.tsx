"use client";

import { useActionState, useState } from "react";
import { BookOpen, CalendarClock, Eye, Globe, GraduationCap, Monitor, Plus, Users, X, Check, Clock } from "lucide-react";
import Image from "next/image";
import type { FormState } from "@/lib/auth/actions";
import { Alert } from "@/components/ui/feedback";
import { Card } from "@/components/sessions/session-ui";
import { PlanningStep } from "@/components/sessions/session-planning";
import { Field, SelectField } from "@/components/ui/field";
import { RichTextEditor } from "@/components/ui/rich-text-editor";
import { REQUIRED_LEVELS } from "@/lib/courses/labels";
import { formatDuration } from "@/lib/utils";
import { saveSessionStep } from "@/lib/sessions/wizard-actions";
import { DEFAULT_CAPACITY, MAX_OBJECTIVES, type SessionDraft } from "@/lib/sessions/wizard";
import type { WizardCourse } from "@/lib/sessions/wizard-queries";
import { cn } from "@/lib/utils";

export const SESSION_FORM_ID = "session-step-form";

export type CourseOption = WizardCourse & { cover: string | null };

function Objectives({ initial, error }: { initial: string[]; error?: string }) {
  const [items, setItems] = useState(initial);
  const [adding, setAdding] = useState(false);
  const [text, setText] = useState("");
  const add = () => {
    const t = text.trim();
    if (t && items.length < MAX_OBJECTIVES) setItems([...items, t.slice(0, 150)]);
    setText("");
    setAdding(false);
  };
  return (
    <div>
      <p className="mb-2 text-sm font-semibold text-brand-dark">Objectifs de la session (optionnel)</p>
      <div className="flex flex-wrap items-center gap-2 rounded-lg border border-line p-3">
        {items.map((o, i) => (
          <span key={`${o}-${i}`} className="inline-flex items-center gap-2 rounded-lg bg-brand-soft px-3 py-1.5 text-sm text-brand-dark">
            <input type="hidden" name="objective" value={o} />
            {o}
            <button type="button" aria-label={`Retirer l’objectif : ${o}`} onClick={() => setItems(items.filter((_, j) => j !== i))} className="text-brand-dark hover:text-danger"><X className="h-3.5 w-3.5" aria-hidden /></button>
          </span>
        ))}
        {adding ? (
          <input autoFocus value={text} maxLength={150} onChange={(e) => setText(e.target.value)} aria-label="Nouvel objectif"
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(); } if (e.key === "Escape") { setAdding(false); setText(""); } }}
            onBlur={add} placeholder="Saisissez l’objectif, puis Entrée" className="min-w-64 flex-1 rounded-lg border border-brand px-3 py-1.5 text-sm" />
        ) : items.length < MAX_OBJECTIVES && (
          <button type="button" onClick={() => setAdding(true)} className="inline-flex items-center gap-2 rounded-lg border border-brand bg-white px-3 py-1.5 text-sm font-semibold text-brand hover:bg-brand-soft">
            <Plus className="h-4 w-4" aria-hidden /> Ajouter un objectif
          </button>
        )}
      </div>
      {error && <p role="alert" className="mt-1 text-xs text-danger">{error}</p>}
    </div>
  );
}

const MODE_CARDS = [
  { value: "online", label: "En ligne", hint: "Visioconférence (Teams, Zoom, etc.)", icon: Monitor },
  { value: "onsite", label: "Présentiel", hint: "(au centre de formation)", icon: Users },
] as const;

function Preview({ course }: { course?: CourseOption }) {
  return (
    <section className="rounded-2xl border border-line bg-white p-5 shadow-card">
      <h3 className="mb-3 flex items-center gap-3 text-base font-bold text-brand-dark">
        <span className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-soft text-brand"><Eye className="h-5 w-5" aria-hidden /></span>
        Aperçu de la formation
      </h3>
      {course ? (
        <>
          <div className="relative h-40 overflow-hidden rounded-xl bg-brand-dark">
            {course.cover
              ? <Image src={course.cover} alt="" fill sizes="22rem" className="object-cover" unoptimized={course.cover.startsWith("http")} />
              : <div className="flex h-full items-center justify-center"><BookOpen className="h-10 w-10 text-white/80" aria-hidden /></div>}
          </div>
          <h4 className="mt-3 text-lg font-extrabold leading-snug text-brand-dark">{course.title}</h4>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
            <span className="inline-flex items-center gap-1 rounded-lg border border-line px-2.5 py-1 text-brand-dark"><Clock className="h-3.5 w-3.5 text-brand" aria-hidden />{formatDuration(course.duration_minutes)}</span>
            <span className="rounded-lg bg-success/15 px-2.5 py-1 font-semibold text-success">{REQUIRED_LEVELS[course.level as keyof typeof REQUIRED_LEVELS] ?? course.level}</span>
          </div>
          {course.description && (
            <>
              <h5 className="mt-4 font-bold text-brand-dark">À propos de cette formation</h5>
              <p className="mt-1 line-clamp-8 whitespace-pre-line text-sm text-brand-dark/80">{course.description}</p>
            </>
          )}
        </>
      ) : <p className="text-sm text-muted">Choisissez une formation pour la prévisualiser.</p>}
    </section>
  );
}

/** Étapes 1 à 3 de l'assistant de création de session ; le pied de page agit sur ce formulaire par l'attribut « form ». */
export function SessionWizardForm({ step, draftId, initial, courses, busyDates = [], nowMs = 0 }: {
  step: 1 | 2 | 3; draftId?: string; initial: SessionDraft; courses: CourseOption[]; busyDates?: string[]; nowMs?: number;
}) {
  const [state, action, pending] = useActionState<FormState, FormData>(saveSessionStep, {});
  const v = (k: keyof SessionDraft) => (state.values?.[k] ?? (initial[k] as string | undefined) ?? "");
  const errs = state.fieldErrors ?? {};
  const [courseId, setCourseId] = useState(initial.courseId ?? "");
  const [title, setTitle] = useState(initial.title ?? "");
  const [mode, setMode] = useState<string>(initial.deliveryMode ?? "online");
  const course = courses.find((c) => c.id === courseId);
  const monthName = new Intl.DateTimeFormat("fr-FR", { month: "long", year: "numeric" }).format(new Date());

  function pickCourse(id: string) {
    setCourseId(id);
    const c = courses.find((x) => x.id === id);
    if (c && !title.trim()) setTitle(`Session ${monthName.charAt(0).toUpperCase()}${monthName.slice(1)} - ${c.title}`.slice(0, 200));
  }

  return (
    <form id={SESSION_FORM_ID} action={action} noValidate className="space-y-6">
      <input type="hidden" name="step" value={step} />
      {draftId && <input type="hidden" name="draftId" value={draftId} />}
      {(state.error || state.message) && <Alert tone={state.error ? "error" : "success"}>{state.error ?? state.message}</Alert>}
      {pending && <span className="sr-only" role="status">Enregistrement…</span>}

      {step === 1 && (
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)_minmax(0,0.9fr)]">
          <Card icon={CalendarClock} title="Informations générales" hint="Sélectionnez la formation et renseignez les informations de la session.">
            <SelectField label="Formation *" name="courseId" value={courseId} onChange={(e) => pickCourse(e.target.value)} errors={errs.courseId}>
              <option value="" disabled>Choisir une formation…</option>
              {courses.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
            </SelectField>
            <Field label="Titre de la session *" name="title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} errors={errs.title} />
            <div>
              <p className="mb-1 text-sm font-semibold text-brand-dark">Description (optionnelle)</p>
              <RichTextEditor name="description" label="Description de la session" defaultValue={v("description")} max={1000} rows={5} error={errs.description?.[0]} />
            </div>
            <Objectives initial={initial.objectives ?? []} error={errs.objectives?.[0]} />
          </Card>

          <div className="space-y-6">
            <Card icon={Monitor} title="Mode de livraison *" hint="Choisissez le mode de réalisation de cette session.">
              <div className="grid grid-cols-2 gap-3" role="radiogroup" aria-label="Mode de livraison">
                {MODE_CARDS.map((m) => {
                  const on = mode === m.value;
                  return (
                    <label key={m.value} className={cn("relative flex cursor-pointer flex-col items-center gap-1 rounded-xl border p-4 text-center", on ? "border-brand bg-brand-soft" : "border-line hover:bg-brand-soft/50")}>
                      <input type="radio" name="deliveryMode" value={m.value} checked={on} onChange={() => setMode(m.value)} className="sr-only" />
                      {on && <span className="absolute left-2 top-2 flex h-6 w-6 items-center justify-center rounded-full bg-brand text-white"><Check className="h-4 w-4" aria-hidden /></span>}
                      <m.icon className="h-7 w-7 text-brand" aria-hidden />
                      <span className="font-semibold text-brand-dark">{m.label}</span>
                      <span className="text-xs text-muted">{m.hint}</span>
                    </label>
                  );
                })}
              </div>
              {errs.deliveryMode && <p role="alert" className="text-xs text-danger">{errs.deliveryMode[0]}</p>}
            </Card>
            <Card icon={GraduationCap} title="Niveau et prérequis">
              <SelectField label="Niveau requis" name="requiredLevel" defaultValue={v("requiredLevel") || "beginner"} errors={errs.requiredLevel}>
                {Object.entries(REQUIRED_LEVELS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
              </SelectField>
              <SelectField label="Prérequis (optionnel)" name="prerequisiteCourseId" defaultValue={v("prerequisiteCourseId")} errors={errs.prerequisiteCourseId}>
                <option value="">Aucun prérequis</option>
                {courses.filter((c) => c.id !== courseId).map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
              </SelectField>
            </Card>
            <Card icon={Globe} title="Langue de la session *">
              <SelectField label="Langue" name="language" defaultValue={v("language") || course?.language || "fr"} errors={errs.language} className="[&>label]:sr-only">
                <option value="fr">Français</option>
                <option value="en">Anglais</option>
              </SelectField>
            </Card>
            <Card icon={Users} title="Capacité maximale *">
              <div className="flex items-stretch overflow-hidden rounded-lg border border-line">
                <input name="capacity" type="number" min={1} step={1} aria-label="Capacité maximale" defaultValue={v("capacity") || String(course?.default_capacity ?? DEFAULT_CAPACITY)} className="w-full px-3 py-2 text-sm outline-none" />
                <span className="flex items-center border-l border-line bg-surface px-3 text-sm text-muted">participants</span>
              </div>
              {errs.capacity && <p role="alert" className="text-xs text-danger">{errs.capacity[0]}</p>}
            </Card>
          </div>

          <Preview course={course} />
        </div>
      )}

      {step === 2 && <PlanningStep initial={{ ...initial, deliveryMode: initial.deliveryMode ?? "online" }} errs={errs} course={course} busyDates={busyDates} nowMs={nowMs} />}

      {step === 3 && (
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
          <Card icon={Users} title="Participants et options" hint="Réglez l’ouverture des inscriptions et la liste d’attente.">
            <Field label="Date limite d’inscription (facultatif)" name="registrationDeadline" type="datetime-local" defaultValue={v("registrationDeadline")} errors={errs.registrationDeadline}
              hint="Par défaut, les inscriptions ferment au début de la session." />
            <label className="flex items-center gap-2 text-sm text-brand-dark">
              <input type="checkbox" name="waitlistEnabled" defaultChecked={v("waitlistEnabled") === "on"} /> Activer la liste d’attente lorsque la session est complète
            </label>
          </Card>
          <Preview course={course} />
        </div>
      )}
    </form>
  );
}
