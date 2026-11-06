/** Identifiant d'URL lisible : minuscules, sans accents, tirets. */
export function slugify(input: string): string {
  return input
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/œ/g, "oe")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "formation";
}

export function withSuffix(slug: string, attempt: number): string {
  if (attempt === 0) return slug;
  const rand = Math.random().toString(36).slice(2, 2 + 4);
  return `${slug.slice(0, 70)}-${rand}`;
}

/** Une ligne par élément ; lignes vides ignorées ; puces éventuelles retirées. */
export function splitLines(text: string | null | undefined): string[] {
  return (text ?? "")
    .split(/\r?\n/)
    .map((l) => l.replace(/^\s*[-•*]\s*/, "").trim())
    .filter(Boolean);
}
