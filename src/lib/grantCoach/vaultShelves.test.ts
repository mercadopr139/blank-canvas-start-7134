// Every Vault field sits on exactly one card, every card names real fields, and
// the shelves read as subjects (Josh, 2026-11-20: one subject per card, one card
// per subject; "read a section and think, yup, that's where I will find it").
import { describe, expect, it } from "vitest";
import { ORG_FIELDS } from "@/lib/grantCoach/orgProfile";
import { ALL_VAULT_CARDS, VAULT_SHELVES, WRITER_CARDS, PARAGRAPHS_SHELF, shelfTitleKey, cardTitleKey } from "@/lib/grantCoach/vaultShelves";

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

  it("keep the writer's settings off the shelves", () => {
    const people = VAULT_SHELVES.flatMap((s) => s.cards).flatMap((c) => c.fields);
    expect(people).not.toContain("writing_examples");
    expect(people).not.toContain("corrections");
    expect(WRITER_CARDS.flatMap((c) => c.fields)).toEqual(["writing_examples", "corrections"]);
  });
});

describe("the Vault's shelves", () => {
  it("are four after the paragraphs, each with more than one card and its own key", () => {
    expect(VAULT_SHELVES).toHaveLength(4);
    VAULT_SHELVES.forEach((s) => expect(s.cards.length).toBeGreaterThan(1));
    const keys = [PARAGRAPHS_SHELF.key, ...VAULT_SHELVES.map((s) => s.key)];
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("start with NLA on paper, the first screen of every portal", () => {
    expect(VAULT_SHELVES[0].title).toBe("NLA on paper");
    expect(VAULT_SHELVES[0].cards[0].fields).toContain("ein");
    expect(VAULT_SHELVES[0].cards[0].fields).toContain("mission");
  });

  it("put the story of Josh and Dave on the people shelf", () => {
    const people = VAULT_SHELVES.find((s) => s.key === "people")!;
    expect(people.cards.flatMap((c) => c.fields)).toEqual(expect.arrayContaining(["story", "facility", "board", "partners"]));
  });

  it("keep a renamed shelf or card title under its own key in the Vault's table", () => {
    expect(shelfTitleKey("money")).toBe("shelf_title:money");
    expect(cardTitleKey("contacts")).toBe("card_title:contacts");
    expect(ORG_FIELDS.some((f) => f.key.startsWith("shelf_title:") || f.key.startsWith("card_title:"))).toBe(false);
    // A shelf and a card may share a key ("paper", "money"); their title rows never collide.
    expect(shelfTitleKey("paper")).not.toBe(cardTitleKey("paper"));
  });
});
