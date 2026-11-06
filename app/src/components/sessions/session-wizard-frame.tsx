import { Fragment } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowRight, Check, Save, X } from "lucide-react";
import { SESSION_FORM_ID } from "@/components/sessions/session-wizard-form";
import { discardSessionDraft } from "@/lib/sessions/wizard-actions";
import { SESSION_STEPS } from "@/lib/sessions/wizard";
import { cn } from "@/lib/utils";

const base = "inline-flex items-center justify-center gap-2 rounded-lg px-5 py-2.5 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50";
const outline = `${base} border border-brand bg-white text-brand hover:bg-brand-soft`;
const primary = `${base} bg-brand text-white hover:bg-brand-dark`;

const stepHref = (id: string, n: number) => `/formateur/sessions/nouvelle/${id}?etape=${n}`;

export function SessionWizardFrame({ draftId, step, hasForm = true, children, lastAction }: {
  draftId?: string; step: number; hasForm?: boolean; children: React.ReactNode; lastAction?: React.ReactNode;
}) {
  const last = SESSION_STEPS.length;
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start gap-4">
        <Link href={step === 1 || !draftId ? "/formateur/sessions" : stepHref(draftId, step - 1)} className={`${outline} px-4`}>
          <ArrowLeft className="h-4 w-4" aria-hidden /> Retour
        </Link>
        <div>
          <h1 className="text-3xl font-extrabold text-brand-dark">Créer une session</h1>
          <p className="mt-1 text-brand-dark/80">Planifiez une nouvelle session pour votre formation.</p>
        </div>
      </div>

      <nav aria-label="Étapes de création de la session" className="overflow-x-auto rounded-2xl border border-line bg-white px-5 py-4 shadow-card">
        <ol className="flex min-w-max items-center gap-3">
          {SESSION_STEPS.map((label, i) => {
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
                  {draftId && !active
                    ? <Link href={stepHref(draftId, n)} className={text}>{circle}<span>{label}</span></Link>
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
        {step === 1 ? (
          draftId ? (
            <form action={discardSessionDraft}>
              <input type="hidden" name="draftId" value={draftId} />
              <button className={outline}><X className="h-4 w-4" aria-hidden /> Annuler</button>
            </form>
          ) : <Link href="/formateur/sessions" className={outline}><X className="h-4 w-4" aria-hidden /> Annuler</Link>
        ) : (
          <Link href={stepHref(draftId!, step - 1)} className={outline}><ArrowLeft className="h-4 w-4" aria-hidden /> Précédent</Link>
        )}
        {step < last && hasForm && (
          <div className="flex flex-wrap items-center gap-3">
            {step > 1 && (
              <button type="submit" form={SESSION_FORM_ID} name="next" value="list" className={`${base} text-brand hover:bg-brand-soft`}>
                <Save className="h-4 w-4" aria-hidden /> Enregistrer comme brouillon
              </button>
            )}
            <button type="submit" form={SESSION_FORM_ID} name="next" value={String(step + 1)} className={primary}>Suivant <ArrowRight className="h-4 w-4" aria-hidden /></button>
          </div>
        )}
        {step === last && lastAction}
      </div>
    </div>
  );
}
