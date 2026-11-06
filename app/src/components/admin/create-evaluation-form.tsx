"use client";

import { useActionState, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, BarChart3, CalendarDays, ClipboardList, FileText, Info, Paperclip, Plus, RotateCcw, Save, Settings, Upload, X, type LucideIcon } from "lucide-react";
import { Alert } from "@/components/ui/feedback";
import { Switch } from "@/components/ui/switch";
import { CREATABLE_KINDS, DESCRIPTION_MAX, FILE_MAX_MB, FILE_TYPES, GRADING_MODES } from "@/lib/admin/evaluations";
import { createEvaluation } from "@/lib/admin/evaluations-actions";
import type { FormState } from "@/lib/auth/actions";
import { createClient } from "@/lib/supabase/browser";
import { cn } from "@/lib/utils";

const input = "w-full rounded-lg border border-line bg-white px-3 py-2.5 text-sm text-brand-dark outline-none focus:border-brand focus:ring-2 focus:ring-brand/20";
const lbl = "mb-1 block text-sm font-semibold text-brand-dark";

export type CourseChoice = { id: string; title: string };
export type SessionChoice = { id: string; courseId: string; label: string; timezone: string; startDate: string; startTime: string; endDate: string; endTime: string };
type Doc = { path: string; name: string; size: number };

function Section({ icon: Icon, title, optional, children, className }: { icon: LucideIcon; title: string; optional?: boolean; children: React.ReactNode; className?: string }) {
  return (
    <section className={cn("rounded-2xl border border-line bg-white p-5 shadow-card", className)}>
      <h2 className="mb-4 flex items-center gap-3 text-base font-extrabold text-brand-dark">
        <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-soft text-brand"><Icon className="h-5 w-5" aria-hidden /></span>
        <span>{title}{optional && <span className="ml-1 text-sm font-normal text-muted">(optionnel)</span>}</span>
      </h2>
      {children}
    </section>
  );
}
const Err = ({ e }: { e?: string[] }) => (e?.[0] ? <p role="alert" className="mt-1 text-xs text-danger">{e[0]}</p> : null);
const Req = () => <span className="text-danger">*</span>;

/** Création d'une évaluation : informations, paramètres, planification, notation, questions (éditeur à part) et pièces jointes. */
export function CreateEvaluationForm({ courses, sessions }: { courses: CourseChoice[]; sessions: SessionChoice[] }) {
  const [state, action, pending] = useActionState<FormState, FormData>(createEvaluation, {});
  const [formKey, setFormKey] = useState(0);
  return <Inner key={formKey} state={state} action={action} pending={pending} reset={() => setFormKey((k) => k + 1)} courses={courses} sessions={sessions} />;
}

function Inner({ state, action, pending, reset, courses, sessions }: {
  state: FormState; action: (f: FormData) => void; pending: boolean; reset: () => void; courses: CourseChoice[]; sessions: SessionChoice[];
}) {
  const fe = state.fieldErrors ?? {};
  const sv = state.values ?? {};
  const [kind, setKind] = useState(sv.kind ?? "quiz");
  const [courseId, setCourseId] = useState(sv.courseId ?? "");
  const [sessionId, setSessionId] = useState(sv.sessionId ?? "");
  const [desc, setDesc] = useState(sv.description ?? "");
  const [dates, setDates] = useState({ startDate: sv.startDate ?? "", startTime: sv.startTime ?? "09:00", endDate: sv.endDate ?? "", endTime: sv.endTime ?? "10:00" });
  const [shuffleQ, setShuffleQ] = useState(sv.shuffleQuestions === "1");
  const [shuffleA, setShuffleA] = useState(sv.shuffleAnswers === "1");
  const [showResult, setShowResult] = useState(sv.showResult === "1");
  const [docs, setDocs] = useState<Doc[]>([]);
  const [docMsg, setDocMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const quiz = kind === "quiz";
  const courseSessions = sessions.filter((s) => s.courseId === courseId);
  const timezone = sessions.find((s) => s.id === sessionId)?.timezone ?? "Africa/Abidjan";

  function pickSession(id: string) {
    setSessionId(id);
    const s = sessions.find((x) => x.id === id);
    if (s && !dates.startDate) setDates({ startDate: s.startDate, startTime: dates.startTime, endDate: s.startDate, endTime: dates.endTime });
  }

  async function addFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const files = [...(e.target.files ?? [])];
    if (fileRef.current) fileRef.current.value = "";
    if (!files.length) return;
    setDocMsg(null);
    if (docs.length + files.length > 10) return setDocMsg("10 fichiers au maximum.");
    const bad = files.find((f) => !(FILE_TYPES as readonly string[]).includes(f.type) || f.size > FILE_MAX_MB * 1024 * 1024);
    if (bad) return setDocMsg(`« ${bad.name} » : PDF, DOC, PPT, XLS, JPG ou PNG de ${FILE_MAX_MB} Mo maximum.`);
    setBusy(true);
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("auth");
      const added: Doc[] = [];
      for (const f of files) {
        const path = `${user.id}/${crypto.randomUUID()}-${f.name.replace(/[^\w.-]+/g, "_").slice(-80)}`;
        const { error } = await supabase.storage.from("evaluation-files").upload(path, f, { contentType: f.type, upsert: false });
        if (error) throw error;
        added.push({ path, name: f.name.slice(0, 200), size: f.size });
      }
      setDocs((d) => [...d, ...added]);
    } catch {
      setDocMsg("Impossible d’envoyer un fichier. Réessayez.");
    } finally {
      setBusy(false);
    }
  }

  const setDate = (k: keyof typeof dates) => (e: React.ChangeEvent<HTMLInputElement>) => setDates((d) => ({ ...d, [k]: e.target.value }));

  return (
    <form action={action} noValidate className="space-y-6">
      {state.error && <Alert>{state.error}</Alert>}
      <input type="hidden" name="timezone" value={timezone} />
      {docs.map((d) => <input key={d.path} type="hidden" name="file" value={JSON.stringify(d)} />)}
      <div className="grid gap-6 xl:grid-cols-2">
        <Section icon={ClipboardList} title="Informations générales">
          <div className="grid gap-4 md:grid-cols-2">
            <div><label htmlFor="v-title" className={lbl}>Titre de l’évaluation <Req /></label><input id="v-title" name="title" maxLength={200} defaultValue={sv.title ?? ""} className={input} aria-invalid={!!fe.title} /><Err e={fe.title} /></div>
            <div><label htmlFor="v-course" className={lbl}>Formation associée <Req /></label>
              <select id="v-course" name="courseId" value={courseId} onChange={(e) => { setCourseId(e.target.value); setSessionId(""); }} className={input} aria-invalid={!!fe.courseId}>
                <option value="">Choisir une formation…</option>{courses.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}</select><Err e={fe.courseId} /></div>
            <div><label htmlFor="v-kind" className={lbl}>Type d’évaluation <Req /></label>
              <select id="v-kind" name="kind" value={kind} onChange={(e) => setKind(e.target.value)} className={input}>{Object.entries(CREATABLE_KINDS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select><Err e={fe.kind} /></div>
            <div><label htmlFor="v-session" className={lbl}>Session <Req /></label>
              <select id="v-session" name="sessionId" value={sessionId} onChange={(e) => pickSession(e.target.value)} disabled={!courseId} className={input} aria-invalid={!!fe.sessionId}>
                <option value="">{courseId && courseSessions.length === 0 ? "Aucune session disponible" : "Choisir une session…"}</option>{courseSessions.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}</select><Err e={fe.sessionId} /></div>
          </div>
          <div className="mt-4">
            <label htmlFor="v-desc" className={lbl}>Description <span className="font-normal text-muted">(optionnelle)</span></label>
            <textarea id="v-desc" name="description" rows={4} maxLength={DESCRIPTION_MAX} value={desc} onChange={(e) => setDesc(e.target.value)} className={input} />
            <p className="mt-1 text-right text-xs text-muted">{desc.length} / {DESCRIPTION_MAX}</p><Err e={fe.description} />
          </div>
        </Section>

        <Section icon={Settings} title="Paramètres de l’évaluation">
          <div className="grid gap-4 md:grid-cols-2">
            {quiz && <div><label htmlFor="v-planned" className={lbl}>Nombre de questions <Req /></label><input id="v-planned" name="plannedQuestions" type="number" min={1} max={500} defaultValue={sv.plannedQuestions ?? "10"} className={input} aria-invalid={!!fe.plannedQuestions} /><Err e={fe.plannedQuestions} /></div>}
            <div><label htmlFor="v-duration" className={lbl}>Durée (minutes) <Req /></label><input id="v-duration" name="duration" type="number" min={1} max={600} defaultValue={sv.duration ?? "60"} className={input} aria-invalid={!!fe.duration} /><Err e={fe.duration} /></div>
            <div><label htmlFor="v-pass" className={lbl}>Note minimale de réussite <Req /></label>
              <div className="flex"><input id="v-pass" name="passingScore" type="number" min={0} max={100} defaultValue={sv.passingScore ?? "70"} className={cn(input, "rounded-r-none")} aria-invalid={!!fe.passingScore} /><span className="flex items-center rounded-r-lg border border-l-0 border-line bg-surface px-3 text-sm text-muted">%</span></div><Err e={fe.passingScore} /></div>
            <div><label htmlFor="v-attempts" className={lbl}>Nombre de tentatives autorisées <Req /></label>
              <select id="v-attempts" name="attempts" defaultValue={sv.attempts ?? "1"} className={input}>{[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n} tentative{n > 1 ? "s" : ""}</option>)}</select><Err e={fe.attempts} /></div>
          </div>
          <div className="mt-5 space-y-4">
            {([["shuffleQuestions", "Mélanger l’ordre des questions", "Affiche les questions dans un ordre aléatoire pour chaque apprenant.", shuffleQ, setShuffleQ],
              ["shuffleAnswers", "Mélanger l’ordre des réponses", "Affiche les choix de réponses dans un ordre aléatoire.", shuffleA, setShuffleA],
              ["showResult", "Afficher le résultat immédiatement", "L’apprenant voit son score et la correction après soumission.", showResult, setShowResult]] as const).map(([name, label, hint, on, set]) => (
              <div key={name} className="flex items-start gap-3"><Switch name={name} label={label} on={on} onChange={set} className="pt-0.5" /><div><p className="text-sm font-semibold text-brand-dark">{label}</p><p className="text-xs text-muted">{hint}</p></div></div>
            ))}
          </div>
          <p className="mt-3 text-xs text-muted">Ces options sont enregistrées avec l’évaluation ; leur application au passage des apprenants viendra avec le module d’évaluation.</p>
        </Section>

        <Section icon={CalendarDays} title="Planification">
          <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_8rem]">
            <div><label htmlFor="v-sd" className={lbl}>Date de début <Req /></label><input id="v-sd" name="startDate" type="date" value={dates.startDate} onChange={setDate("startDate")} className={input} aria-invalid={!!fe.startDate} /><Err e={fe.startDate} /></div>
            <div><label htmlFor="v-st" className={lbl}>Heure <Req /></label><input id="v-st" name="startTime" type="time" value={dates.startTime} onChange={setDate("startTime")} className={input} aria-invalid={!!fe.startTime} /><Err e={fe.startTime} /></div>
            <div><label htmlFor="v-ed" className={lbl}>Date de fin <Req /></label><input id="v-ed" name="endDate" type="date" min={dates.startDate} value={dates.endDate} onChange={setDate("endDate")} className={input} aria-invalid={!!fe.endDate} /><Err e={fe.endDate} /></div>
            <div><label htmlFor="v-et" className={lbl}>Heure <Req /></label><input id="v-et" name="endTime" type="time" value={dates.endTime} onChange={setDate("endTime")} className={input} aria-invalid={!!fe.endTime} /><Err e={fe.endTime} /></div>
          </div>
          <p className="mt-3 text-xs text-muted">Heures dans le fuseau de la session ({timezone}).</p>
        </Section>

        <Section icon={BarChart3} title="Résultats et suivi">
          <div className="grid gap-4 md:grid-cols-2">
            <div><label htmlFor="v-grading" className={lbl}>Mode de notation <Req /></label>
              <select id="v-grading" name="gradingMode" defaultValue={sv.gradingMode ?? "points100"} className={input}>{Object.entries(GRADING_MODES).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select><Err e={fe.gradingMode} /></div>
            <div><label htmlFor="v-status" className={lbl}>Statut de publication <Req /></label>
              <select id="v-status" name="status" defaultValue={sv.status ?? "draft"} className={input}><option value="published">Publiée</option><option value="draft">Brouillon</option></select><Err e={fe.status} /></div>
          </div>
        </Section>
      </div>

      <Section icon={FileText} title="Questions">
        {quiz ? (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-brand-soft/60 p-4">
            <div className="flex items-start gap-3"><Info className="mt-0.5 h-5 w-5 shrink-0 text-brand" aria-hidden />
              <div><p className="text-sm font-bold text-brand-dark">Ajoutez les questions de l’évaluation.</p><p className="text-xs text-brand-dark/80">Vous pourrez définir le type, les choix de réponses et la bonne réponse. L’évaluation est alors enregistrée en brouillon.</p></div></div>
            <button type="submit" name="intent" value="questions" disabled={pending || busy} className="inline-flex items-center gap-2 rounded-lg border border-brand bg-white px-5 py-2.5 text-sm font-semibold text-brand hover:bg-brand-soft disabled:opacity-60"><Plus className="h-4 w-4" aria-hidden /> Ajouter des questions</button>
          </div>
        ) : <p className="rounded-xl bg-brand-soft/60 p-4 text-sm text-brand-dark">Ce type d’évaluation est noté par le formateur : il n’a pas de questions à choix. Les notes se saisissent après le passage.</p>}
      </Section>

      <Section icon={Paperclip} title="Pièces jointes" optional>
        <input ref={fileRef} id="v-files" type="file" multiple accept={FILE_TYPES.join(",")} onChange={addFiles} className="sr-only" />
        <label htmlFor="v-files" className="flex cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-line px-4 py-6 text-center hover:bg-brand-soft/40">
          <Upload className="h-6 w-6 text-brand" aria-hidden /><span className="text-sm font-bold text-brand-dark">{busy ? "Envoi…" : "Cliquer pour sélectionner vos fichiers"}</span>
          <span className="text-xs text-muted">PDF, DOC, PPT, XLS, JPG, PNG (max. {FILE_MAX_MB} Mo par fichier)</span>
        </label>
        {(docMsg || fe.files) && <p role="alert" className="mt-1 text-xs text-danger">{docMsg ?? fe.files?.[0]}</p>}
        {docs.length > 0 && (
          <ul className="mt-3 grid gap-1.5 md:grid-cols-2">
            {docs.map((d) => (
              <li key={d.path} className="flex items-center gap-2 rounded-lg border border-line px-3 py-1.5 text-sm text-brand-dark">
                <FileText className="h-4 w-4 shrink-0 text-brand" aria-hidden /><span className="min-w-0 flex-1 truncate">{d.name}</span><span className="text-xs text-muted">{Math.max(1, Math.round(d.size / 1024))} Ko</span>
                <button type="button" onClick={() => setDocs((x) => x.filter((y) => y.path !== d.path))} aria-label={`Retirer ${d.name}`} className="text-muted hover:text-danger"><X className="h-4 w-4" aria-hidden /></button>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link href="/admin/evaluations" className="inline-flex items-center gap-2 rounded-lg border border-brand bg-white px-5 py-2.5 text-sm font-semibold text-brand hover:bg-brand-soft"><ArrowLeft className="h-4 w-4" aria-hidden /> Retour à la liste</Link>
        <div className="flex gap-3">
          <button type="button" onClick={reset} className="inline-flex items-center gap-2 rounded-lg border border-brand bg-white px-5 py-2.5 text-sm font-semibold text-brand hover:bg-brand-soft"><RotateCcw className="h-4 w-4" aria-hidden /> Réinitialiser</button>
          <button type="submit" name="intent" value="save" disabled={pending || busy} className="inline-flex items-center gap-2 rounded-lg bg-brand px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-dark disabled:opacity-60"><Save className="h-4 w-4" aria-hidden /> {pending ? "Enregistrement…" : "Enregistrer l’évaluation"}</button>
        </div>
      </div>
    </form>
  );
}
