import { describe, it, expect } from "vitest";
import { isEdit, parseRules, mergeRules } from "@/lib/grantCoach/corrections";

describe("learning from Josh's edits", () => {
  it("counts a real change as an edit, not spacing or punctuation", () => {
    expect(isEdit("It is a free, year around program.", "It is a free, year-round program.")).toBe(true); // around → round is a real word change
    expect(isEdit("free, year-round program", "free year-round program.")).toBe(false); // only punctuation differs
    expect(isEdit("It services the children.", "It serves the children.")).toBe(true);
    expect(isEdit("Same words.", "  same words  ")).toBe(false);
    expect(isEdit(null, "Anything")).toBe(false);
    expect(isEdit("Draft", "")).toBe(false);
  });

  it("reads the rules on file one per line, bullets or not", () => {
    expect(parseRules("• Write year-round\n- Say serves, not services\n\n3. Never total a young log")).toEqual([
      "Write year-round", "Say serves, not services", "Never total a young log",
    ]);
    expect(parseRules(null)).toEqual([]);
  });

  it("adds only rules not already there", () => {
    expect(mergeRules(["Write year-round, never year around"], ["write year-round never year around.", "Say serves, not services"]))
      .toEqual(["Write year-round, never year around", "Say serves, not services"]);
  });
});
