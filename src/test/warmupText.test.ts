import { describe, it, expect } from "vitest";
import { warmupToText, textToWarmup } from "@/lib/warmupText";

describe("Battle Team warm-up ⇄ bullets", () => {
  it("writes each movement as a main bullet with its detail nested under it", () => {
    expect(warmupToText([{ name: "Empty bar", detail: "2 × 5" }, { name: "Band pull-aparts", detail: "" }])).toBe(
      "Empty bar\n- 2 × 5\nBand pull-aparts"
    );
    expect(warmupToText([])).toBeNull();
    expect(warmupToText(null)).toBeNull();
  });

  it("reads a main bullet as a movement and the bullets under it as its detail", () => {
    expect(textToWarmup("Empty bar\n- 2 × 5\nBand pull-aparts\n- 15 reps\n- slow")).toEqual([
      { name: "Empty bar", detail: "2 × 5" },
      { name: "Band pull-aparts", detail: "15 reps · slow" },
    ]);
  });

  it("still takes the old one-line form, Name — detail", () => {
    expect(textToWarmup("Empty bar — 2 × 5\n95 - x5")).toEqual([
      { name: "Empty bar", detail: "2 × 5" },
      { name: "95", detail: "x5" },
    ]);
  });

  it("a nested line with no movement above it becomes a movement rather than vanishing", () => {
    expect(textToWarmup("- 2 × 5")).toEqual([{ name: "2 × 5", detail: "" }]);
  });

  it("round-trips", () => {
    const w = [{ name: "Empty bar", detail: "2 × 5" }, { name: "Hip openers", detail: "" }, { name: "95", detail: "× 5 · × 3" }];
    expect(textToWarmup(warmupToText(w))).toEqual(w);
  });
});
