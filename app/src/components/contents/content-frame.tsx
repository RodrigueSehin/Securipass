import { Fragment } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowRight, Check, Save } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { CONTENT_STEPS } from "@/lib/contents/wizard";
import { cn } from "@/lib/utils";

export const CONTENT_FORM_ID = "content-step-form";

const DESCRIPTIONS = [
  "Créez un nouveau contenu pour votre formation. Choisissez le type, complétez les informations et publiez.",
  "Créez un nouveau contenu pour votre formation. Choisissez le type, complétez les informations et publiez.",
  "Créez un nouveau contenu pour votre formation. Choisissez le type, complétez les informations et publiez.",
  "Créez un nouveau contenu pour votre formation. Choisissez le type, complétez les informations et publiez.",
];

const base = "inline-flex items-center justify-center gap-2 rounded-lg px-5 py-2.5 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50";
const outline = `${base} border border-brand bg-white text-brand hover:bg-brand-soft`;
const primary = `${base} bg-brand text-white hover:bg-brand-dark`;
const ghost = `${base} text-brand hover:bg-brand-soft`;

const stepHref = (id: string, n: number) => `/formateur/contenus/nouveau/${id}?etape=${n}`;

function Nav({ contentId, step, hasForm, kind }: { contentId?: string; step: number; hasForm: boolean; kind: "header" | "footer" }) {
  const last = CONTENT_STEPS.length;
  const draftClass = kind === "header" ? outline : ghost;
  const draft = hasForm ? (
    <button type="submit" form={CONTENT_FORM_ID} name="next" value="list" className={draftClass}>
      <Save className="h-4 w-4" aria-hidden /> Enregistrer comme brouillon
    </button>
  ) : (
    <Link href="/formateur/contenus" className={draftClass}><Save className="h-4 w-4" aria-hidden /> Enregistrer comme brouillon</Link>
  );

  if (kind === "header") {
    return step === 1 ? (
      <ButtonLink href="/formateur/contenus" variant="outline"><ArrowLeft className="h-4 w-4" aria-hidden /> Retour aux contenus</ButtonLink>
    ) : (
      <div className="flex flex-wrap gap-2">
        <Link href={stepHref(contentId!, step - 1)} className={outline}><ArrowLeft className="h-4 w-4" aria-hidden /> Retour</Link>
        {draft}
      </div>
    );
  }
  return (
    <>
      {step === 1
        ? <Link href="/formateur/contenus" className={outline}>Annuler</Link>
        : <Link href={stepHref(contentId!, step - 1)} className={outline}><ArrowLeft className="h-4 w-4" aria-hidden /> Précédent</Link>}
      <div className="flex flex-wrap items-center gap-3">
        {step > 1 && draft}
        {step < last && <button type="submit" form={CONTENT_FORM_ID} name="next" value={String(step + 1)} className={primary}>Suivant <ArrowRight className="h-4 w-4" aria-hidden /></button>}
      </div>
    </>
  );
}

export function ContentFrame({ contentId, step, hasForm = true, children, lastAction }: {
  contentId?: string; step: number; hasForm?: boolean; children: React.ReactNode; lastAction?: React.ReactNode;
}) {
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start gap-4">
        <Link href={step === 1 || !contentId ? "/formateur/contenus" : stepHref(contentId, step - 1)} className={`${outline} px-4`}>
          <ArrowLeft className="h-4 w-4" aria-hidden /> Retour
        </Link>
        <div>
          <h1 className="text-2xl font-extrabold text-brand-dark">Ajouter un contenu pédagogique</h1>
          <p className="mt-1 text-sm text-muted">{DESCRIPTIONS[step - 1]}</p>
        </div>
      </div>

      <nav aria-label="Étapes de création du contenu" className="overflow-x-auto rounded-2xl border border-line bg-white px-5 py-4 shadow-card">
        <ol className="flex min-w-max items-center gap-3">
          {CONTENT_STEPS.map((label, i) => {
            const n = i + 1;
            const done = n < step;
            const active = n === step;
            const circle = (
              <span className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-bold",
                done ? "bg-success text-white" : active ? "bg-brand text-white" : "bg-surface text-muted")}>
                {done ? <Check className="h-4 w-4" aria-hidden /> : n}
              </span>
            );
            const text = cn("flex items-center gap-3 text-sm", active ? "font-bold text-brand" : done ? "font-semibold text-brand-dark" : "text-muted");
            return (
              <Fragment key={label}>
                <li>
                  {contentId && !active
                    ? <Link href={stepHref(contentId, n)} className={text}>{circle}<span>{label}</span></Link>
                    : <span aria-current={active ? "step" : undefined} className={text}>{circle}<span>{label}</span></span>}
                </li>
                {i < CONTENT_STEPS.length - 1 && <li aria-hidden className="h-px w-10 flex-1 bg-line" />}
              </Fragment>
            );
          })}
        </ol>
      </nav>

      {children}

      <div className="sticky bottom-0 -mx-4 flex items-center justify-between gap-3 border-t border-line bg-surface/95 px-4 py-4 backdrop-blur md:-mx-6 md:px-6">
        <Nav contentId={contentId} step={step} hasForm={hasForm} kind="footer" />
        {step === CONTENT_STEPS.length && lastAction}
      </div>
    </div>
  );
}
