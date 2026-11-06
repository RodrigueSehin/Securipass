import { describe, expect, it } from "vitest";
import { attachmentProblem, messagingErrorMessage, safeFileName } from "./rules";

describe("pièces jointes", () => {
  it("accepte les types autorisés dans la limite de taille", () => {
    expect(attachmentProblem({ size: 1200, type: "application/pdf" })).toBeNull();
    expect(attachmentProblem({ size: 500, type: "image/png" })).toBeNull();
  });
  it("refuse les autres types et les fichiers trop lourds ou vides", () => {
    expect(attachmentProblem({ size: 10, type: "application/x-msdownload" })).toMatch(/Type/);
    expect(attachmentProblem({ size: 11 * 1024 * 1024, type: "application/pdf" })).toMatch(/10 Mo/);
    expect(attachmentProblem({ size: 0, type: "application/pdf" })).toMatch(/10 Mo/);
  });
  it("nettoie le nom de fichier", () => {
    expect(safeFileName("../../etc/Module 3 – Surveillance.pdf")).toBe("Module_3_Surveillance.pdf");
    expect(safeFileName("Rapport final (v2).docx")).toBe("Rapport_final_v2_.docx");
    expect(safeFileName("...")).toBe("fichier");
  });
});

describe("erreurs", () => {
  it("traduit les refus connus", () => {
    expect(messagingErrorMessage("ERROR: forbidden")).toMatch(/accès/);
    expect(messagingErrorMessage("empty_message")).toMatch(/Écrivez/);
    expect(messagingErrorMessage("boom")).toMatch(/pas pu être envoyé/);
  });
});
