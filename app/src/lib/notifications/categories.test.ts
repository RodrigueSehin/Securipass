import { describe, expect, it } from "vitest";
import { categoryOf, countByCategory } from "./categories";

describe("catégories de notifications", () => {
  it("range chaque type dans sa catégorie", () => {
    expect(categoryOf("session_changed")).toBe("formations");
    expect(categoryOf("evaluation_result")).toBe("evaluations");
    expect(categoryOf("certificate_revoked")).toBe("certificats");
    expect(categoryOf("message_received")).toBe("messages");
    expect(categoryOf("inconnue")).toBeNull();
  });
  it("compte par catégorie", () => {
    expect(countByCategory([{ kind: "session_changed" }, { kind: "enrollment_confirmed" }, { kind: "message_received" }]))
      .toEqual({ formations: 2, evaluations: 0, certificats: 0, messages: 1 });
  });
});
