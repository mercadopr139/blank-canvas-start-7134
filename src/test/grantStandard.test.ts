// The standard paragraphs (Josh, 2026-11-19): approved boilerplate a question
// takes verbatim — offered by the picker, matched by the classifier, filled
// like a Vault fact under a "standard:" key.
import { describe, expect, it } from "vitest";
import { bodyForAnswer, isStandardKey, purposeOf, standardParagraphs, STANDARD_PREFIX } from "@/lib/grantCoach/snapshot";
import { isFactRow, vaultAnswer, vaultCatalog } from "@/lib/grantCoach/answers";
import { ORG_SECTIONS } from "@/lib/grantCoach/orgProfile";

const snapshot = {
  year: "2025-2026",
  sections: [
    { key: "intro", title: "The Introduction", body: "THE INTRODUCTION · 2025–26\n\nNo Limits Academy (NLA) is a 501(c)(3) nonprofit youth development center.\n\nIn 2025–26, 518 youth registered." },
    { key: "capacity", title: "Partners and capacity", body: "Two full-time staff lead NLA." },
  ],
};

describe("the standard paragraphs", () => {
  it("drop the ALL-CAPS heading line and keep the rest as written", () => {
    expect(bodyForAnswer(snapshot.sections[0].body)).toBe("No Limits Academy (NLA) is a 501(c)(3) nonprofit youth development center.\n\nIn 2025–26, 518 youth registered.");
    expect(bodyForAnswer("Two full-time staff lead NLA.")).toBe("Two full-time staff lead NLA.");
  });

  it("carry a key a question row can keep, the purpose line, and a word count", () => {
    const ps = standardParagraphs(snapshot);
    expect(ps.map((p) => p.key)).toEqual(["standard:intro", "standard:capacity"]);
    expect(ps[0].purpose).toBe(purposeOf("intro"));
    expect(ps[0].purpose).toMatch(/tell us about your organization/);
    expect(ps[0].words).toBe(16);
    expect(standardParagraphs(null)).toEqual([]);
    expect(isStandardKey(`${STANDARD_PREFIX}intro`)).toBe(true);
    expect(isStandardKey("mission")).toBe(false);
    expect(isStandardKey(null)).toBe(false);
  });

  it("fill a matched row verbatim like a Vault fact, but keep it a prose card, not a fact row", () => {
    const saved = { mission: "Free, year-round.", "standard:intro": "No Limits Academy (NLA) is a 501(c)(3)…" };
    expect(vaultAnswer("standard:intro", null, saved)).toBe("No Limits Academy (NLA) is a 501(c)(3)…");
    expect(vaultAnswer("standard:sustainability", null, saved)).toBeNull();
    expect(isFactRow({ vault_key: "standard:intro", kind: "narrative" })).toBe(false);
    expect(isFactRow({ vault_key: "ein", kind: "narrative" })).toBe(true);
  });

  it("are shown to the classifier with their length and purpose", () => {
    const cat = vaultCatalog(standardParagraphs(snapshot));
    expect(cat.paragraphs).toEqual([
      { key: "standard:intro", title: "The Introduction", purpose: purposeOf("intro"), words: 16 },
      { key: "standard:capacity", title: "Partners and capacity", purpose: purposeOf("capacity"), words: 5 },
    ]);
    expect(vaultCatalog().paragraphs).toEqual([]);
  });

  it("open the Vault: the Introduction first, sustainability under Funding history", () => {
    expect(ORG_SECTIONS[0]).toMatchObject({ key: "intro", snapshot: "intro", fields: [] });
    expect(ORG_SECTIONS.find((s) => s.key === "funding")?.snapshot).toBe("sustainability");
  });
});
