/**
 * Rendu des textes de modèle. Doit rester identique à `public._render_text` (migration 10) : l'aperçu montré au
 * formateur est celui qui sera figé à l'émission. Seules les variables connues sont substituées.
 */
export const TEMPLATE_VARIABLES = ["apprenant", "formation", "session", "date", "numero", "validite"] as const;
export type TemplateVariable = (typeof TEMPLATE_VARIABLES)[number];
export type TemplateVars = Partial<Record<TemplateVariable, string>>;

export function renderTemplateText(body: string, vars: TemplateVars): string {
  let out = body;
  for (const [key, value] of Object.entries(vars)) {
    out = out.split(`{{${key}}}`).join(value ?? "");
  }
  return out;
}

/** Variables utilisées dans un texte qui ne sont pas connues (à signaler au formateur). */
export function unknownVariables(body: string): string[] {
  const found = [...body.matchAll(/\{\{\s*([a-z_]+)\s*\}\}/g)].map((m) => m[1]);
  return [...new Set(found.filter((v) => !(TEMPLATE_VARIABLES as readonly string[]).includes(v)))];
}

export const LAYOUTS = {
  classic: "Classique",
  modern: "Moderne",
  minimal: "Minimaliste",
  professional: "Professionnel",
} as const;
export type Layout = keyof typeof LAYOUTS;
