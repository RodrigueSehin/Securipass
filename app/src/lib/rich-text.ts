/**
 * Texte enrichi minimal (gras, italique, souligné, titres, listes, liens https) stocké en texte simple.
 * Aucun HTML n'est jamais stocké ni injecté : le texte est analysé en blocs puis affiché par des éléments React.
 *
 *   **gras**   *italique*   ++souligné++   [texte](https://lien)
 *   ## Titre   ### Sous-titre   - puce   1. numéro   (ligne vide = nouveau paragraphe)
 */

export type Inline =
  | { t: "text"; v: string }
  | { t: "bold" | "italic" | "underline"; v: string }
  | { t: "link"; v: string; href: string };

export type Block =
  | { t: "p"; lines: Inline[][] }
  | { t: "h"; level: 3 | 4; inline: Inline[] }
  | { t: "ul"; items: Inline[][] }
  | { t: "ol"; items: Inline[][] };

const INLINE = /(\*\*[^*\n]+\*\*|\*[^*\n]+\*|\+\+[^+\n]+\+\+|\[[^\]\n]+\]\(https:\/\/[^)\s]+\))/g;

export function parseInline(source: string): Inline[] {
  const out: Inline[] = [];
  for (const part of source.split(INLINE)) {
    if (!part) continue;
    let m: RegExpMatchArray | null;
    if (part.startsWith("**") && part.endsWith("**") && part.length > 4) out.push({ t: "bold", v: part.slice(2, -2) });
    else if (part.startsWith("++") && part.endsWith("++") && part.length > 4) out.push({ t: "underline", v: part.slice(2, -2) });
    else if (part.startsWith("*") && part.endsWith("*") && part.length > 2) out.push({ t: "italic", v: part.slice(1, -1) });
    else if ((m = part.match(/^\[([^\]]+)\]\((https:\/\/[^)\s]+)\)$/))) out.push({ t: "link", v: m[1], href: m[2] });
    else out.push({ t: "text", v: part });
  }
  return out;
}

export function parseRichText(text: string | null | undefined): Block[] {
  const blocks: Block[] = [];
  const lines = (text ?? "").replace(/\r\n?/g, "\n").split("\n");
  let para: Inline[][] = [];
  let list: { t: "ul" | "ol"; items: Inline[][] } | null = null;
  const flush = () => {
    if (para.length) blocks.push({ t: "p", lines: para });
    if (list) blocks.push(list as Block);
    para = [];
    list = null;
  };
  for (const raw of lines) {
    const line = raw.trimEnd();
    let m: RegExpMatchArray | null;
    if (!line.trim()) { flush(); continue; }
    if ((m = line.match(/^(#{2,3})\s+(.+)$/))) {
      flush();
      blocks.push({ t: "h", level: m[1].length === 2 ? 3 : 4, inline: parseInline(m[2]) });
    } else if ((m = line.match(/^[-•]\s+(.+)$/))) {
      if (list?.t !== "ul") { flush(); list = { t: "ul", items: [] }; }
      list.items.push(parseInline(m[1]));
    } else if ((m = line.match(/^\d+[.)]\s+(.+)$/))) {
      if (list?.t !== "ol") { flush(); list = { t: "ol", items: [] }; }
      list.items.push(parseInline(m[1]));
    } else {
      if (list) flush();
      para.push(parseInline(line));
    }
  }
  flush();
  return blocks;
}

/** Texte brut sans marques : pour les résumés, les descriptions de page et la recherche. */
export function stripRichText(text: string | null | undefined): string {
  return (text ?? "")
    .replace(/\r\n?/g, "\n")
    .replace(/^#{2,3}\s+/gm, "")
    .replace(/^\s*[-•]\s+/gm, "")
    .replace(/^\s*\d+[.)]\s+/gm, "")
    .replace(/\[([^\]\n]+)\]\(https:\/\/[^)\s]+\)/g, "$1")
    .replace(/\*\*([^*\n]+)\*\*/g, "$1")
    .replace(/\+\+([^+\n]+)\+\+/g, "$1")
    .replace(/\*([^*\n]+)\*/g, "$1");
}

export type Edit = { value: string; start: number; end: number };

/** Entoure la sélection de marques (ex. **…**). Sans sélection, insère un texte d'exemple sélectionné. */
export function wrapSelection(value: string, start: number, end: number, before: string, after = before, placeholder = "texte"): Edit {
  const selected = value.slice(start, end) || placeholder;
  const next = value.slice(0, start) + before + selected + after + value.slice(end);
  return { value: next, start: start + before.length, end: start + before.length + selected.length };
}

/** Début et fin des lignes touchées par la sélection. */
function lineRange(value: string, start: number, end: number) {
  const from = value.lastIndexOf("\n", Math.max(0, start - 1)) + 1;
  const nl = value.indexOf("\n", end);
  return { from: start === 0 ? 0 : from, to: nl === -1 ? value.length : nl };
}

/** Préfixe chaque ligne de la sélection (puces, numéros). Si toutes ont déjà un préfixe de liste, le retire. */
export function toggleList(value: string, start: number, end: number, kind: "ul" | "ol"): Edit {
  const { from, to } = lineRange(value, start, end);
  const lines = value.slice(from, to).split("\n");
  const re = kind === "ul" ? /^[-•]\s+/ : /^\d+[.)]\s+/;
  const allPrefixed = lines.every((l) => !l.trim() || re.test(l));
  const next = lines.map((l, i) => (allPrefixed ? l.replace(re, "") : l.trim() ? `${kind === "ul" ? "- " : `${i + 1}. `}${l.replace(/^([-•]|\d+[.)])\s+/, "")}` : l));
  const replaced = next.join("\n");
  return { value: value.slice(0, from) + replaced + value.slice(to), start: from, end: from + replaced.length };
}

/** Définit le niveau de titre de la ligne courante ("" = paragraphe, "##" ou "###"). */
export function setHeading(value: string, start: number, prefix: "" | "##" | "###"): Edit {
  const { from, to } = lineRange(value, start, start);
  const line = value.slice(from, to).replace(/^#{2,3}\s+/, "");
  const replaced = prefix ? `${prefix} ${line}` : line;
  return { value: value.slice(0, from) + replaced + value.slice(to), start: from, end: from + replaced.length };
}
