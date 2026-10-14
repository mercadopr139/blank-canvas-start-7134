import { describe, it, expect } from "vitest";
import { moveWorkout, weekDays, dayMeta, WEEKDAY_KEYS, type DayWorkout, type WeekRow } from "@/lib/strength";

const w = (focus: string, extra: Partial<DayWorkout> = {}): DayWorkout => ({ focus, ...extra });

describe("Battle Team workout — pushed to another night", () => {
  it("moves Wednesday's workout to an empty Thursday and remembers where it came from", () => {
    const days: WeekRow["days"] = { monday: w("Bench"), wednesday: w("Squat"), friday: w("Deadlift") };
    const next = moveWorkout(days, "wednesday", "thursday")!;
    expect(next.wednesday).toBeUndefined();
    expect(next.thursday).toEqual({ focus: "Squat", movedFrom: "wednesday" });
    expect(next.monday).toEqual(w("Bench"));
    expect(next.friday).toEqual(w("Deadlift"));
    // The week it was given is untouched.
    expect(days.wednesday).toEqual(w("Squat"));
    expect(days.thursday).toBeUndefined();
  });

  it("swaps when tomorrow already has a workout, and each remembers its home", () => {
    const days: WeekRow["days"] = { thursday: w("Squat", { movedFrom: "wednesday" }), friday: w("Deadlift") };
    const next = moveWorkout(days, "thursday", "friday")!;
    expect(next.friday).toEqual({ focus: "Squat", movedFrom: "wednesday" });
    expect(next.thursday).toEqual({ focus: "Deadlift", movedFrom: "friday" });
  });

  it("moving a workout back home forgets that it was ever moved", () => {
    const days: WeekRow["days"] = { thursday: w("Squat", { movedFrom: "wednesday" }) };
    const next = moveWorkout(days, "thursday", "wednesday")!;
    expect(next.wednesday).toEqual({ focus: "Squat" });
    expect(next.thursday).toBeUndefined();
  });

  it("nothing to move, or no move at all, is null", () => {
    expect(moveWorkout({ monday: w("Bench") }, "wednesday", "thursday")).toBeNull();
    expect(moveWorkout({ monday: w("Bench") }, "monday", "monday")).toBeNull();
  });

  it("the week's tabs are the programme days plus any day a workout was moved onto, in order", () => {
    expect(weekDays({ monday: w("Bench") }).map((d) => d.key)).toEqual(["monday", "wednesday", "friday"]);
    expect(weekDays({ monday: w("Bench"), thursday: w("Squat", { movedFrom: "wednesday" }) }).map((d) => d.key)).toEqual([
      "monday", "wednesday", "thursday", "friday",
    ]);
    expect(weekDays(undefined).map((d) => d.key)).toEqual(["monday", "wednesday", "friday"]);
  });

  it("a programme day keeps its lift; any other day is named alone", () => {
    expect(dayMeta("wednesday")).toEqual({ key: "wednesday", label: "Wednesday", lift: "Back Squat", weekday: 3 });
    expect(dayMeta("thursday")).toEqual({ key: "thursday", label: "Thursday", lift: "", weekday: 4 });
    expect(WEEKDAY_KEYS[4]).toBe("thursday");
    expect(WEEKDAY_KEYS[6]).toBeUndefined();
  });
});
