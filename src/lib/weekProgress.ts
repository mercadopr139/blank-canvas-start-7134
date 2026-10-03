// The week's four jobs, and whether each is done — the strip under the
// Practice Plan title. "Done" means the kids can see it on the wall: the
// practice plan published, the verse published, both lift plans locked.
// Pure functions so the rule is testable and the same wherever it's drawn.
// (Josh, 2026-10-03.)

export type StepState = "todo" | "doing" | "done";

export interface WeekStep {
  key: "plan" | "verse" | "battle" | "nbt";
  title: string;
  /** One short line under the title: where it stands. */
  status: string;
  state: StepState;
}

export interface WeekProgressInput {
  /** The practice week row, if started. */
  plan: { status: string; filled: number; total: number } | null;
  /** The Verse of the Week row, if any. */
  verse: { theme: string | null; is_published: boolean } | null;
  /** Battle Team S&C week, if built. */
  battle: { status: "draft" | "locked"; days: number } | null;
  /** NBT: whether this week is built (all three days) and whether it's locked. */
  nbt: { built: boolean; locked: boolean } | null;
}

export const weekSteps = (i: WeekProgressInput): WeekStep[] => {
  const plan: WeekStep = !i.plan
    ? { key: "plan", title: "Practice Plan", status: "Not started", state: "todo" }
    : i.plan.status === "published"
      ? { key: "plan", title: "Practice Plan", status: "Live on Gym Board", state: "done" }
      : { key: "plan", title: "Practice Plan", status: `${i.plan.filled} of ${i.plan.total} drills · draft`, state: "doing" };

  const verse: WeekStep = !i.verse || !i.verse.theme?.trim()
    ? { key: "verse", title: "Verse of the Week", status: "No theme yet", state: "todo" }
    : i.verse.is_published
      ? { key: "verse", title: "Verse of the Week", status: "Live on Gym Board", state: "done" }
      : { key: "verse", title: "Verse of the Week", status: "Theme set · not live yet", state: "doing" };

  const battle: WeekStep = !i.battle || i.battle.days === 0
    ? { key: "battle", title: "BT Workout Plan", status: "Not built", state: "todo" }
    : i.battle.status === "locked"
      ? { key: "battle", title: "BT Workout Plan", status: "Live on Gym Board", state: "done" }
      : { key: "battle", title: "BT Workout Plan", status: `${i.battle.days} of 3 days · draft`, state: "doing" };

  const nbt: WeekStep = !i.nbt || !i.nbt.built
    ? { key: "nbt", title: "NBT Workout Plan", status: "Not built", state: "todo" }
    : i.nbt.locked
      ? { key: "nbt", title: "NBT Workout Plan", status: "Live on Gym Board", state: "done" }
      : { key: "nbt", title: "NBT Workout Plan", status: "Built · draft", state: "doing" };

  return [plan, verse, battle, nbt];
};

export const weekReady = (steps: WeekStep[]) => steps.every((s) => s.state === "done");
