import { describe, it, expect } from "vitest";
import { moveWorkout, removeWorkout, weekDays, dayMeta, dateOfDay, type NbtDay, type NbtWeek } from "@/lib/nbt";
import { movedTo, isWeekdayKey } from "@/lib/programWeek";

const day = (focus: string, extra: Partial<NbtDay> = {}): NbtDay => ({
  focus,
  prep: [],
  lift: { pattern: "", bravo: { name: "", detail: "" }, alpha: { name: "", detail: "" }, cues: [] },
  work: { emphasis: "", title: "", bravo: [], alpha: [], result_unit: "rounds" },
  reset: [],
  ...extra,
});

describe("NBT workout — pushed to another night", () => {
  it("moves Tuesday's workout to an empty Wednesday and remembers where it came from", () => {
    const days: NbtWeek["days"] = { monday: day("Squat + Push"), tuesday: day("Athletic"), thursday: day("Hinge") };
    const next = moveWorkout(days, "tuesday", "wednesday")!;
    expect(next.tuesday).toBeUndefined();
    expect(next.wednesday?.focus).toBe("Athletic");
    expect(next.wednesday?.movedFrom).toBe("tuesday");
    expect(movedTo(next, "tuesday")).toBe("wednesday");
  });

  it("swaps when the night already has a workout, and moving home forgets the move", () => {
    const days: NbtWeek["days"] = { wednesday: day("Athletic", { movedFrom: "tuesday" }), thursday: day("Hinge") };
    const swapped = moveWorkout(days, "wednesday", "thursday")!;
    expect(swapped.thursday?.movedFrom).toBe("tuesday");
    expect(swapped.wednesday?.movedFrom).toBe("thursday");
    const home = moveWorkout(days, "wednesday", "tuesday")!;
    expect(home.tuesday?.movedFrom).toBeUndefined();
    expect(home.wednesday).toBeUndefined();
  });

  it("removes a night and leaves the rest", () => {
    const days: NbtWeek["days"] = { monday: day("Squat"), thursday: day("Hinge") };
    expect(Object.keys(removeWorkout(days, "thursday")!)).toEqual(["monday"]);
    expect(removeWorkout(days, "friday")).toBeNull();
  });

  it("tabs are the programme days plus any moved-onto night, in order; a moved night has no title", () => {
    expect(weekDays({ monday: day("a") }).map((d) => d.key)).toEqual(["monday", "tuesday", "thursday"]);
    expect(weekDays({ wednesday: day("a", { movedFrom: "tuesday" }) }).map((d) => d.key)).toEqual([
      "monday", "tuesday", "wednesday", "thursday",
    ]);
    expect(dayMeta("wednesday")).toEqual({ key: "wednesday", label: "Wednesday", title: "", weekday: 3 });
    expect(dayMeta("thursday").title).toBe("Hinge + Pull");
  });

  it("dates any weekday, not only programme days", () => {
    expect(dateOfDay("2026-10-12", "wednesday")).toBe("2026-10-14");
    expect(dateOfDay("2026-10-12", "friday")).toBe("2026-10-16");
    expect(isWeekdayKey("friday")).toBe(true);
    expect(isWeekdayKey("saturday")).toBe(false);
  });
});
