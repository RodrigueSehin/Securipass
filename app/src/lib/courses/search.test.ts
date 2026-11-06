import { describe, expect, it } from "vitest";
import { escapeLike } from "./search";

describe("escapeLike", () => {
  it("échappe les jokers LIKE", () => {
    expect(escapeLike("100%_sûr")).toBe("100\\%\\_sûr");
    expect(escapeLike("a\\b")).toBe("a\\\\b");
  });
  it("laisse le texte normal intact", () => {
    expect(escapeLike("secourisme")).toBe("secourisme");
  });
});
