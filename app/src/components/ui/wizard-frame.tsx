import { Fragment } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowRight, Check, X } from "lucide-react";
import { cn } from "@/lib/utils";

const base = "inline-flex items-center justify-center gap-2 rounded-lg px-5 py-2.5 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50";
const outline = `${base} border border-brand bg-white text-brand hover:bg-brand-soft`;
const primary = `${base} bg-brand text-white hover:bg-brand-dark`;

/**
 * Cadre commun des assistants en étapes : retour, titre, étapes numérotées et pied de page collant.
 * Les boutons du pied de page agissent sur le formulaire d'étape par l'attribut HTML « form ».
 */
export function WizardFrame({ title, subtitle, steps, step, stepHref, listHref, formId, hasForm = true, discard, lastAction, children }: {
  title: string; subtitle: string; steps: readonly string[]; step: number;
  /** Adresse d'une étape (absente tant que rien n'est enregistré : les étapes ne sont alors pas cliquables). */
  stepHref?: (n: number) => string;
  listHref: string; formId: string; hasForm?: boolean;
  /** Formulaire d'annulation (supprime le brouillon) ; à défaut, simple lien vers la liste. */
  discard?: React.ReactNode;
  lastAction?: React.ReactNode; children: React.ReactNode;
}) {
  const last = steps.length;
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start gap-4">
        <Link href={step === 1 || !stepHref ? listHref : stepHref(step - 1)} className={`${outline} px-4`}><ArrowLeft className="h-4 w-4" aria-hidden /> Retour</Link>
        <div>
          <h1 className="text-3xl font-extrabold text-brand-dark">{title}</h1>
          <p className="mt-1 text-brand-dark/80">{subtitle}</p>
        </div>
      </div>

      <nav aria-label="Étapes" className="overflow-x-auto rounded-2xl border border-line bg-white px-5 py-4 shadow-card">
        <ol className="flex min-w-max items-center gap-3">
          {steps.map((label, i) => {
            const n = i + 1;
            const done = n < step;
            const active = n === step;
            const circle = (
              <span className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-bold",
                done ? "bg-success text-white" : active ? "bg-brand text-white" : "bg-surface text-brand-dark")}>
                {done ? <Check className="h-4 w-4" aria-hidden /> : n}
              </span>
            );
            const text = cn("flex items-center gap-3 text-sm", active ? "font-bold text-brand" : "text-brand-dark");
            return (
              <Fragment key={label}>
                <li>
                  {stepHref && !active
                    ? <Link href={stepHref(n)} className={text}>{circle}<span>{label}</span></Link>
                    : <span aria-current={active ? "step" : undefined} className={text}>{circle}<span>{label}</span></span>}
                </li>
                {i < last - 1 && <li aria-hidden className="h-px w-10 flex-1 bg-line" />}
              </Fragment>
            );
          })}
        </ol>
      </nav>

      {children}

      <div className="sticky bottom-0 -mx-4 flex items-center justify-between gap-3 border-t border-line bg-surface/95 px-4 py-4 backdrop-blur md:-mx-6 md:px-6">
        {step === 1
          ? (discard ?? <Link href={listHref} className={outline}><X className="h-4 w-4" aria-hidden /> Annuler</Link>)
          : <Link href={stepHref!(step - 1)} className={outline}><ArrowLeft className="h-4 w-4" aria-hidden /> Précédent</Link>}
        {step < last && hasForm && (
          <button type="submit" form={formId} name="next" value={String(step + 1)} className={primary}>Suivant <ArrowRight className="h-4 w-4" aria-hidden /></button>
        )}
        {step === last && lastAction}
      </div>
    </div>
  );
}
