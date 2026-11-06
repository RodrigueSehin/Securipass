import { describe, expect, it } from "vitest";
import { createTestDb } from "./pg-harness";

describe("migrations", () => {
  it("se rejouent de bout en bout sur une base vierge", async () => {
    const db = await createTestDb();
    const { rows } = await db.query<{ slug: string }>(`select slug from public.categories order by slug`);
    expect(rows.map((r) => r.slug)).toEqual([
      "prevention-risques", "secourisme", "securite-incendie", "securite-privee", "situations-urgence",
    ]);
    await db.close();
  }, 60_000);
});
