// Dates for the Juniors Aftercare journal (Smile Lab / Life Lab).
//
// Aftercare meets on Tuesdays, and a session report always belongs to its
// Tuesday no matter which day it is written on (Josh, 2026-10-15: a report
// written on a Thursday was saved under the Thursday, and the 8 PM reminder
// kept asking for the Tuesday). Everything here is calendar-date math in
// America/New_York; see CLAUDE.md on dates.

/** Today's calendar date in Eastern time, YYYY-MM-DD. */
export const todayNY = (): string => new Date().toLocaleDateString("en-CA", { timeZone: "America/New_York" });

/** A date plus/minus some days, as YYYY-MM-DD, with no timezone drift. */
export const shiftDate = (isoStr: string, days: number): string => {
  const d = new Date(isoStr + "T00:00:00");
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

/** "Thu, Oct 8" — the day a half of the report was submitted, in Eastern time. */
export const filedOn = (iso: string): string =>
  new Date(iso).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "America/New_York" });

/** The session a report written on `isoStr` belongs to: the Tuesday on or before it. */
export const sessionDateFor = (isoStr: string): string => {
  const dow = new Date(isoStr + "T00:00:00").getDay(); // 0 Sun … 6 Sat
  return shiftDate(isoStr, -((dow - 2 + 7) % 7));
};
