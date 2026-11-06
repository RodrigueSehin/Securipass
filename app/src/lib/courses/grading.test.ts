import { describe, expect, it } from "vitest";
import { fromScale, formatGrade, toScale, totalWeight, weightWarning } from "./grading";
import { buildCertificateConditions, buildEvaluationModalities, type SummarySettings } from "./evaluation-summary";

describe("notes et échelles", () => {
  it("convertit un pourcentage en note sur l'échelle, selon l'arrondi", () => {
    expect(toScale(62, 20, "none")).toBe(12.4);
    expect(toScale(62, 20, "up")).toBe(13);
    expect(toScale(62, 20, "down")).toBe(12);
    expect(toScale(62, 20, "nearest")).toBe(12);
    expect(toScale(60, 20, "up")).toBe(12); // pas d'arrondi parasite sur une valeur exacte
    expect(toScale(75, 100, "none")).toBe(75);
  });

  it("convertit une note saisie en pourcentage borné", () => {
    expect(fromScale(12, 20)).toBe(60);
    expect(fromScale(25, 20)).toBe(100);
    expect(fromScale(-3, 20)).toBe(0);
    expect(fromScale(Number.NaN, 20)).toBe(0);
  });

  it("affiche « note / échelle »", () => {
    expect(formatGrade(60, 20)).toBe("12 / 20");
    expect(formatGrade(62, 20, "none")).toBe("12,4 / 20");
  });
});

describe("pondérations", () => {
  const a = (weight_percent: number, status = "published") => ({ weight_percent, status });
  it("additionne seulement les activités actives", () => {
    expect(totalWeight([a(50), a(30), a(20, "draft")])).toBe(80);
  });
  it("avertit tant que le total n'est pas de 100 %, sauf sans pondération", () => {
    expect(weightWarning([a(50), a(30)])).toContain("80 %");
    expect(weightWarning([a(60), a(40)])).toBeNull();
    expect(weightWarning([a(0), a(0)])).toBeNull();
    expect(weightWarning([])).toBeNull();
  });
});

describe("textes déduits des réglages", () => {
  const s: SummarySettings = { evaluation_enabled: true, pass_mark_percent: 70, grading_scale: 20, grade_rounding: "none", certificate_enabled: true };
  it("décrit les activités actives", () => {
    const text = buildEvaluationModalities(s, [
      { title: "Quiz : notions", kind: "quiz", weight_percent: 40, passing_score: 60, status: "published" },
      { title: "Brouillon", kind: "assignment", weight_percent: 60, passing_score: 50, status: "draft" },
    ]);
    expect(text).toContain("Note minimale de réussite : 70 %");
    expect(text).toContain("Quiz : notions (quiz) : pondération 40 %, note minimale 12 / 20");
    expect(text).not.toContain("Brouillon");
  });
  it("gère l'absence d'évaluation", () => {
    expect(buildEvaluationModalities({ ...s, evaluation_enabled: false }, [])).toContain("pas d’évaluation notée");
    expect(buildEvaluationModalities(s, [])).toContain("seront précisées");
  });
  it("décrit les conditions du certificat, ou aucune sans certificat", () => {
    expect(buildCertificateConditions(s)).toContain("moyenne pondérée d’au moins 70 %");
    expect(buildCertificateConditions({ ...s, evaluation_enabled: false })).not.toContain("moyenne");
    expect(buildCertificateConditions({ ...s, certificate_enabled: false })).toBeNull();
  });
});
