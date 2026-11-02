import { describe, it, expect } from "vitest";
import { programDaysForNights, placeOnNight, weekDayKeys } from "@/lib/programWeek";
import { weekDays as btWeekDays } from "@/lib/strength";
import { weekDays as nbtWeekDays } from "@/lib/nbt";

// A modified week (Josh, 2026-11-02): the Battle Team lifts Monday and Thursday
// though the programme is Mon/Wed/Fri; NBT lifts Monday and Thursday though its
// programme is Mon/Tue/Thu. Each night takes a programme day — its own when it
// is one, otherwise the next unused in programme order.
describe("Lift nights on a modified week", () => {
  const BT = ["monday", "wednesday", "friday"] as const;
  const NBT = ["monday", "tuesday", "thursday"] as const;

  it("give the Battle Team Bench on Monday and Squat on Thursday", () => {
    expect(programDaysForNights(BT, ["thursday", "monday"])).toEqual([["monday", "monday"], ["thursday", "wednesday"]]);
  });

  it("keep NBT's own Monday and Thursday sessions on a Monday-and-Thursday week", () => {
    expect(programDaysForNights(NBT, ["monday", "thursday"])).toEqual([["monday", "monday"], ["thursday", "thursday"]]);
  });

  it("hand a night that is not a programme day the next unused programme day", () => {
    expect(programDaysForNights(NBT, ["wednesday", "friday"])).toEqual([["wednesday", "monday"], ["friday", "tuesday"]]);
    expect(programDaysForNights(BT, ["tuesday"])).toEqual([["tuesday", "monday"]]);
  });

  it("are the programme's own nights when nothing is picked", () => {
    expect(programDaysForNights(BT, ["monday", "wednesday", "friday"]).map(([, p]) => p)).toEqual([...BT]);
  });

  it("file a workout on its night and remember where it came from unless that is home", () => {
    expect(placeOnNight({ focus: "Squat", movedFrom: "friday" as const }, "wednesday", "thursday")).toEqual({ focus: "Squat", movedFrom: "wednesday" });
    expect(placeOnNight({ focus: "Bench", movedFrom: "friday" as const }, "monday", "monday")).toEqual({ focus: "Bench" });
  });

  it("show the week's nights, not the programme's, once a week says which nights it lifts", () => {
    expect(weekDayKeys(BT, { monday: {}, thursday: {} }, ["monday", "thursday"])).toEqual(["monday", "thursday"]);
    expect(btWeekDays({ monday: { focus: "Bench" }, thursday: { focus: "Squat", movedFrom: "wednesday" } }, ["monday", "thursday"]).map((d) => d.key)).toEqual(["monday", "thursday"]);
    expect(nbtWeekDays({}, ["monday", "thursday"]).map((d) => d.label)).toEqual(["Monday", "Thursday"]);
    // A week written before nights existed reads exactly as before.
    expect(btWeekDays({ monday: { focus: "Bench" } }, null).map((d) => d.key)).toEqual(["monday", "wednesday", "friday"]);
  });
});
