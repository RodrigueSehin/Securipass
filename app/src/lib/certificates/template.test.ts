import { describe, expect, it } from "vitest";
import { renderTemplateText, unknownVariables } from "./template";

describe("rendu des modèles", () => {
  it("remplace les variables connues", () => {
    expect(renderTemplateText("{{apprenant}} a suivi « {{formation}} ».", { apprenant: "Awa K.", formation: "SST" }))
      .toBe("Awa K. a suivi « SST ».");
  });
  it("laisse intact le texte sans variable et ne touche pas aux inconnues", () => {
    expect(renderTemplateText("Texte {{inconnue}}", { apprenant: "x" })).toBe("Texte {{inconnue}}");
  });
  it("une valeur absente devient vide, jamais « undefined »", () => {
    expect(renderTemplateText("[{{session}}]", {})).toBe("[{{session}}]");
    expect(renderTemplateText("[{{session}}]", { session: undefined })).toBe("[]");
  });
  it("signale les variables inconnues", () => {
    expect(unknownVariables("{{apprenant}} {{note}} {{ note }} {{autre}}")).toEqual(["note", "autre"]);
  });
});
