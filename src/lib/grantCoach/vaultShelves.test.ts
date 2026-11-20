// Every Vault field sits on exactly one card, and every card names real fields
// (Josh, 2026-11-20: one subject per card, one card per subject).
import { describe, expect, it } from "vitest";
import { ORG_FIELDS } from "@/lib/grantCoach/orgProfile";
import { ALL_VAULT_CARDS, FACT_CARDS, BACKGROUND_CARDS, WRITER_CARDS } from "@/lib/grantCoach/vaultShelves";

describe("the Vault's cards", () => {
  const placed = ALL_VAULT_CARDS.flatMap((c) => c.fields);
  const known = new Set(ORG_FIELDS.map((f) => f.key));

  it("name only fields that exist", () => {
    expect(placed.filter((k) => !known.has(k))).toEqual([]);
  });

  it("place every field once", () => {
    const counts = new Map<string, number>();
    placed.forEach((k) => counts.set(k, (counts.get(k) ?? 0) + 1));
    expect([...counts].filter(([, n]) => n !== 1)).toEqual([]);
    expect(ORG_FIELDS.map((f) => f.key).filter((k) => !counts.has(k))).toEqual([]);
  });

  it("have distinct keys and a gist each", () => {
    const keys = ALL_VAULT_CARDS.map((c) => c.key);
    expect(new Set(keys).size).toBe(keys.length);
    ALL_VAULT_CARDS.forEach((c) => expect(c.gist.length).toBeGreaterThan(10));
  });

  it("keep the writer's settings off the facts and background shelves", () => {
    const people = [...FACT_CARDS, ...BACKGROUND_CARDS].flatMap((c) => c.fields);
    expect(people).not.toContain("writing_examples");
    expect(people).not.toContain("corrections");
    expect(WRITER_CARDS.flatMap((c) => c.fields)).toEqual(["writing_examples", "corrections"]);
  });

  it("start the facts with NLA on paper, the first screen of every portal", () => {
    expect(FACT_CARDS[0].title).toBe("NLA on paper");
    expect(FACT_CARDS[0].fields).toContain("ein");
    expect(FACT_CARDS[0].fields).toContain("mission");
  });
});
