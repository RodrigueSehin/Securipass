"use client";

import { useActionState, useState } from "react";
import { Info, Rocket } from "lucide-react";
import { saveCourseStep } from "@/lib/courses/actions";
import type { FormState } from "@/lib/auth/actions";
import { Alert } from "@/components/ui/feedback";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

type Publication = "draft" | "publish" | "scheduled";

/** Paramètres de publication (étape 5) : moment de publication, mise en avant et ouverture des inscriptions. */
export function PublicationPanel({ courseId, initialValues }: { courseId: string; initialValues: Record<string, string> }) {
  const [state, action, pending] = useActionState<FormState, FormData>(saveCourseStep, {});
  const v = (key: string) => state.values?.[key] ?? initialValues[key] ?? "";
  const [mode, setMode] = useState<Publication>((v("publicationMode") as Publication) || "publish");
  const [date, setDate] = useState(v("publishAt").split("T")[0] ?? "");
  const [time, setTime] = useState(v("publishAt").split("T")[1] ?? "08:00");
  const [featured, setFeatured] = useState(v("featured") === "1");
  const [open, setOpen] = useState(v("registrationsOpen") !== "0");
  const fe = state.fieldErrors;

  const options: [Publication, string, string][] = [
    ["publish", "Publier dès la validation", "La formation sera visible dans le catalogue dès sa validation."],
    ["scheduled", "Planifier la publication", "La formation sera visible à une date ultérieure, après validation."],
    ["draft", "Garder en brouillon", "La formation ne sera pas soumise ni visible des apprenants."],
  ];

  return (
    <form action={action} noValidate className="space-y-4">
      <input type="hidden" name="courseId" value={courseId} />
      <input type="hidden" name="step" value="5" />
      <input type="hidden" name="publicationMode" value={mode} />
      <input type="hidden" name="publishAt" value={mode === "scheduled" && date ? `${date}T${time || "00:00"}` : ""} />
      {state.error && <Alert>{state.error}</Alert>}
      {state.message && <Alert tone="success">{state.message}</Alert>}

      <fieldset className="space-y-2">
        <legend className="mb-1 text-sm font-semibold text-brand-dark">Statut de la formation</legend>
        {options.map(([key, title, text]) => (
          <label key={key} className={cn("flex cursor-pointer items-start gap-3 rounded-lg border p-3 text-sm", mode === key ? "border-brand bg-brand-soft/50" : "border-line")}>
            <input type="radio" name="publicationChoice" checked={mode === key} onChange={() => setMode(key)} className="mt-1" />
            <span><span className="font-semibold text-brand-dark">{title}</span><br /><span className="text-muted">{text}</span></span>
          </label>
        ))}
      </fieldset>

      {mode === "scheduled" && (
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

      <div className="space-y-3">
        <div>
          <Switch name="featured" label="Mettre en avant dans le catalogue" on={featured} onChange={setFeatured} />
          <p className="ml-14 text-xs text-muted">Affiche cette formation en priorité (tri par pertinence et accueil).</p>
        </div>
        <div>
          <Switch name="registrationsOpen" label="Autoriser les inscriptions" on={open} onChange={setOpen} />
          <p className="ml-14 text-xs text-muted">Les apprenants peuvent s’inscrire dès la publication.</p>
        </div>
      </div>

      <Button type="submit" variant="outline" disabled={pending} className="w-full">{pending ? "Enregistrement…" : "Enregistrer les paramètres de publication"}</Button>
      <p className="flex items-start gap-2 rounded-lg bg-brand-soft p-3 text-xs text-brand-dark">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-brand" aria-hidden />
        <span><Rocket className="mr-1 inline h-3.5 w-3.5" aria-hidden />En soumettant cette formation, elle sera examinée par l’équipe pédagogique puis visible dans le catalogue ; les apprenants pourront alors s’y inscrire.</span>
      </p>
    </form>
  );
}
