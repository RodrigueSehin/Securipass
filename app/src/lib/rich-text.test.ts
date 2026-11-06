import { describe, expect, it } from "vitest";
import { parseInline, parseRichText, setHeading, stripRichText, toggleList, wrapSelection } from "./rich-text";

describe("analyse du texte enrichi", () => {
  it("reconnaît gras, italique, souligné et liens https", () => {
    expect(parseInline("a **b** *c* ++d++ [e](https://x.ci/p)")).toEqual([
      { t: "text", v: "a " }, { t: "bold", v: "b" }, { t: "text", v: " " }, { t: "italic", v: "c" }, { t: "text", v: " " },
      { t: "underline", v: "d" }, { t: "text", v: " " }, { t: "link", v: "e", href: "https://x.ci/p" },
    ]);
  });

  it("n'accepte jamais un lien autre que https (pas de javascript:)", () => {
    expect(parseInline("[x](javascript:alert(1))")).toEqual([{ t: "text", v: "[x](javascript:alert(1))" }]);
    expect(parseInline("[x](http://x.ci)")).toEqual([{ t: "text", v: "[x](http://x.ci)" }]);
  });

  it("garde le HTML comme du texte : aucune balise n'est interprétée", () => {
    expect(parseInline("<script>alert(1)</script>")).toEqual([{ t: "text", v: "<script>alert(1)</script>" }]);
  });

  it("découpe en paragraphes, titres et listes", () => {
    const blocks = parseRichText("## Titre\nUne ligne\nSuite\n\n- un\n- deux\n\n1. a\n2. b");
    expect(blocks.map((b) => b.t)).toEqual(["h", "p", "ul", "ol"]);
    expect(blocks[1]).toMatchObject({ t: "p", lines: [[{ t: "text", v: "Une ligne" }], [{ t: "text", v: "Suite" }]] });
    expect(blocks[2]).toMatchObject({ t: "ul" });
    expect((blocks[2] as { items: unknown[] }).items).toHaveLength(2);
  });

  it("un texte vide ou absent ne donne aucun bloc", () => {
    expect(parseRichText(null)).toEqual([]);
    expect(parseRichText("  \n ")).toEqual([]);
  });
});

describe("texte brut", () => {
  it("retire les marques pour les résumés", () => {
    expect(stripRichText("## Titre\n**Gras** et *italique* et ++souligné++\n- puce\n1. num\n[lien](https://x.ci)"))
      .toBe("Titre\nGras et italique et souligné\npuce\nnum\nlien");
  });
});

describe("édition", () => {
  it("entoure la sélection ou insère un texte d'exemple", () => {
    expect(wrapSelection("un mot ici", 3, 6, "**")).toEqual({ value: "un **mot** ici", start: 5, end: 8 });
    expect(wrapSelection("", 0, 0, "*").value).toBe("*texte*");
  });

  it("transforme les lignes en puces, puis les rétablit", () => {
    const on = toggleList("a\nb", 0, 3, "ul");
    expect(on.value).toBe("- a\n- b");
    expect(toggleList(on.value, on.start, on.end, "ul").value).toBe("a\nb");
  });

  it("numérote les lignes sélectionnées", () => {
    expect(toggleList("a\nb", 0, 3, "ol").value).toBe("1. a\n2. b");
  });

  it("change le niveau de titre de la ligne courante", () => {
    expect(setHeading("avant\nLigne\naprès", 7, "##").value).toBe("avant\n## Ligne\naprès");
    expect(setHeading("## Ligne", 3, "").value).toBe("Ligne");
    expect(setHeading("## Ligne", 3, "###").value).toBe("### Ligne");
  });
});
