import { describe, it, expect } from "vitest";
import { diffWords, differs } from "@/lib/grantCoach/diffWords";

describe("the change marked in a draft (Josh, 2026-10-29: amber, not a needle in a haystack)", () => {
  it("marks an added sentence and keeps the rest the same", () => {
    const before = "NLA serves youth in Cape May County. The program is safety-first.";
    const after = "NLA serves youth in Cape May County. The 47 Battle Team youth are drawn from these districts. The program is safety-first.";
    const parts = diffWords(before, after);
    expect(parts.filter((p) => p.kind === "removed")).toHaveLength(0);
    expect(parts.filter((p) => p.kind === "added").map((p) => p.text.trim()).join(" ")).toBe("The 47 Battle Team youth are drawn from these districts.");
    expect(parts.map((p) => (p.kind === "removed" ? "" : p.text)).join("")).toBe(after);
  });
  it("marks a changed word as removed then added", () => {
    const parts = diffWords("the program is safety-first, with 95% of youth", "the program is safety-first; 95% of youth");
    expect(parts.some((p) => p.kind === "removed" && p.text.includes("safety-first,"))).toBe(true);
    expect(parts.some((p) => p.kind === "added" && p.text.includes("safety-first;"))).toBe(true);
  });
  it("keeps the draft's paragraph breaks", () => {
    const parts = diffWords("one two", "one two\n\nthree");
    expect(parts.map((p) => (p.kind === "removed" ? "" : p.text)).join("")).toBe("one two\n\nthree");
  });
  it("knows when nothing but spacing changed", () => {
    expect(differs("a  b", "a b")).toBe(false);
    expect(differs("a b", "a c")).toBe(true);
  });
});
